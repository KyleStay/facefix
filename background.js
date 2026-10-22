importScripts('diagnostics.js','connection.js');
const matches = url => FacefixConnection.matches(url);
async function protect(tab) {
  if (!tab.id || !matches(tab.url)) return;
  const {enabled = true} = await chrome.storage.local.get('enabled');
  const updated = await chrome.tabs.update(tab.id, {autoDiscardable: enabled ? false : true}).catch(() => {
    void writeDiagnosticEvents([{kind:'memory-protection-failed'}], {tab});
  });
  if (enabled && tab.autoDiscardable === true && updated?.autoDiscardable === false) void writeDiagnosticEvents([{kind:'memory-protection-restored'}],{tab});
  return updated?.autoDiscardable === !enabled;
}
async function refresh() {
  const tabs = await chrome.tabs.query({url: ['https://*.facebook.com/*', 'https://facebook.com/*']});
  await Promise.all(tabs.map(protect));
}
chrome.tabs.onUpdated.addListener((id, changes, tab) => {
  if (changes.status === 'loading' || changes.url || changes.autoDiscardable === true) void protect(tab);
  if (changes.status === 'complete' && matches(tab.url)) void checkConnection(tab);
  if (changes.discarded === true && matches(tab.url)) void writeDiagnosticEvents([{kind:'tab-discarded'}], {tab});
});
chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) void refresh();
});

const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
let counterQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !message) return;
  const increment = message.type === 'facefix-count' && sender.tab &&
    matches(sender.url) && kinds.includes(message.kind);
  const reset = message.type === 'facefix-reset' && !sender.tab &&
    sender.url === chrome.runtime.getURL('popup.html');
  if (!increment && !reset) return;
  // One writer serializes updates from every tab, including resets.
  counterQueue = counterQueue.then(async () => {
    const {counters = {}, enabled = true} = await chrome.storage.local.get(['counters', 'enabled']);
    if (increment && !enabled) return;
    const next = Object.fromEntries(kinds.map(kind => [kind,
      reset ? 0 : (Number.isSafeInteger(counters[kind]) && counters[kind] >= 0 ? counters[kind] : 0)
    ]));
    if (increment) next[message.kind] = Math.min(Number.MAX_SAFE_INTEGER, next[message.kind] + 1);
    await chrome.storage.local.set({counters: next});
  });
  counterQueue.then(() => reply({ok: true}), () => reply({ok: false}));
  counterQueue = counterQueue.catch(() => {});
  return true;
});

async function checkConnection(tab) {
  const result=await FacefixConnection.inspect(chrome,tab);
  await writeDiagnosticEvents([{kind:'connection-checked',details:{connection:result.kind,bridgeVersion:result.bridgeVersion,guardVersion:result.guardVersion}},
    ...(['bridge-missing','guard-missing','incompatible'].includes(result.kind) ? [{kind:'bridge-unavailable'}] : [])],{tab});
}

// A single diagnostic writer keeps simultaneous tabs and failure reports ordered.
let diagnosticQueue = Promise.resolve();
function diagnosticTask(work) {
  const result = diagnosticQueue.then(work);
  diagnosticQueue = result.catch(() => {});
  return result;
}
const eventBudgets = new Map();
function writeDiagnosticEvents(events, sender) {
  const key = sender.documentId || sender.tab?.id || 'worker';
  const time = Date.now();
  let budget = eventBudgets.get(key);
  if (!budget || time-budget.at >= 60000) { budget={at:time,count:0}; eventBudgets.set(key,budget); }
  const safeEvents = events.slice(0,50).map(event=>FacefixDiagnostics.sanitize(event)).filter(Boolean).slice(0,Math.max(0,120-budget.count));
  budget.count += safeEvents.length;
  if (eventBudgets.size > 64) eventBudgets.delete(eventBudgets.keys().next().value);
  if (!safeEvents.length) return Promise.resolve();
  return diagnosticTask(async () => {
    const {diagnosticsEnabled = true, diagnostics = {}} = await chrome.storage.local.get(['diagnosticsEnabled','diagnostics']);
    if (!diagnosticsEnabled) return;
    const data = FacefixDiagnostics.prune(diagnostics);
    const at = Date.now();
    for (const safe of safeEvents) {
      data.events.push({...safe,at,tabId:sender.tab?.id ?? null,
        documentId:/^[a-zA-Z0-9-]{1,80}$/.test(sender.documentId || '') ? sender.documentId : null});
    }
    await chrome.storage.local.set({diagnostics:FacefixDiagnostics.prune(data)});
  });
}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || !message) return;
  const fromPage = sender.tab && matches(sender.url);
  const fromUI = ['popup.html','diagnostics.html'].some(path => sender.url === chrome.runtime.getURL(path));
  if (message.type === 'facefix-diagnostic-events' && fromPage && Array.isArray(message.events)) {
    writeDiagnosticEvents(message.events,sender).then(() => reply({ok:true}),() => reply({ok:false}));
    return true;
  }
  if (message.type === 'facefix-diagnostic-read' && fromUI) {
    diagnosticTask(async () => {
      const {diagnostics = {}} = await chrome.storage.local.get('diagnostics');
      const data = FacefixDiagnostics.prune(diagnostics);
      await chrome.storage.local.set({diagnostics:data});
      return {ok:true,data};
    }).then(reply,()=>reply({ok:false}));
    return true;
  }
  if (message.type === 'facefix-diagnostic-clear' && fromUI) {
    diagnosticTask(() => chrome.storage.local.set({diagnostics:{events:[],reports:[]}})).then(() => reply({ok:true}),() => reply({ok:false}));
    return true;
  }
  if (message.type !== 'facefix-diagnostic-report' || !fromUI) return;
  const task = async () => {
    const tab = Number.isInteger(message.tabId) ? await chrome.tabs.get(message.tabId) : (await chrome.tabs.query({active:true,currentWindow:true}))[0];
    const connection = await FacefixConnection.inspect(chrome,tab);
    const snapshot = connection.snapshot;
    const {diagnostics = {},diagnosticsEnabled = true,counters = {}} = await chrome.storage.local.get(['diagnostics','diagnosticsEnabled','counters']);
    const data = FacefixDiagnostics.prune(diagnostics);
    const tabId = tab?.id ?? null;
    if (diagnosticsEnabled && matches(tab?.url) && ['bridge-missing','guard-missing','incompatible'].includes(connection.kind)) data.events.push({kind:'bridge-unavailable',details:{},at:Date.now(),tabId,documentId:null});
    const recent = data.events.filter(event => event.tabId === tabId && event.at >= Date.now()-30*60000).slice(-120);
    // Only known numeric/boolean status fields enter the report, never page payloads.
    const status = snapshot && snapshot.schema === 1 ? {
      schema:1,enabled:snapshot.enabled === true,away:snapshot.away === true,
      navigationMs:Math.min(4000,Math.max(0,Number(snapshot.navigationMs)||0)),
      recoveryMs:Math.min(15000,Math.max(0,Number(snapshot.recoveryMs)||0)),
      postMatched:snapshot.postMatched === true,wasDiscarded:typeof snapshot.wasDiscarded === 'boolean' ? snapshot.wasDiscarded : null,
      pageLoadType:['navigate','reload','back_forward','prerender'].includes(snapshot.pageLoadType)?snapshot.pageLoadType:'unknown',
      navigationAPI:typeof snapshot.navigationAPI === 'boolean' ? snapshot.navigationAPI : null,
      guardVersion:connection.guardVersion
    } : null;
    const findings = FacefixDiagnostics.analyze(recent,status);
    const version = chrome.runtime.getManifest().version;
    if (connection.kind !== 'connected') {
      const [title,action] = FacefixConnection.describe(connection.kind);
      findings.unshift({title,confidence:'observed',evidence:`Connection check: ${connection.kind}. Installed ${version}; bridge ${connection.bridgeVersion || 'unverified'}; guard ${connection.guardVersion || 'unverified'}.`,action});
    }
    let memoryRepair = null;
    if (status?.enabled && tab?.autoDiscardable === true) {
      memoryRepair = await protect(tab);
      findings.unshift({title:'Chrome memory protection had drifted',confidence:'observed',evidence:'The protected Facebook tab was auto-discardable when reported.',action:memoryRepair ? 'Facefix reapplied and verified its memory setting. Check for another extension changing this flag.' : 'Facefix could not verify the repair. Check extension permissions and other tab-management extensions.'});
    }
    const report = {at:Date.now(),tabId,version,
      recording:diagnosticsEnabled,connection:{kind:connection.kind,installedVersion:version,bridgeVersion:connection.bridgeVersion,guardVersion:connection.guardVersion},memoryRepair,status,autoDiscardable:tab?.autoDiscardable ?? null,findings,
      counters:Object.fromEntries(kinds.map(kind=>[kind,Number.isSafeInteger(counters[kind])?counters[kind]:0])),events:recent};
    data.reports.push(report);
    await chrome.storage.local.set({diagnostics:FacefixDiagnostics.prune(data)});
    return {ok:true,report};
  };
  diagnosticTask(task).then(reply,() => reply({ok:false}));
  return true;
});
