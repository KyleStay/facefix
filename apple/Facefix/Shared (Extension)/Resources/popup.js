const toggle = document.querySelector('#enabled');
chrome.storage.local.get({enabled: true}).then(({enabled}) => { toggle.checked = enabled; });
toggle.addEventListener('change', () => chrome.storage.local.set({enabled: toggle.checked}));

const timerRoot = document.querySelector('#timers');
timerRoot.innerHTML = FacefixTimers.markup;
const timerStyle = document.createElement('style');
timerStyle.textContent = FacefixTimers.css;
document.head.append(timerStyle);
let checking = false;
let reconnectTabId = null;
const reconnect = document.querySelector('#reconnect');
async function updateTimers() {
  if (checking) return;
  checking = true;
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const connection = await FacefixConnection.inspect(chrome,tab);
    FacefixTimers.render(timerRoot,connection.snapshot,connection);
    document.querySelector('#version').textContent = `Installed ${connection.installedVersion} · Page ${connection.guardVersion || 'not verified'}`;
    reconnectTabId = FacefixConnection.matches(tab?.url) && ['bridge-missing','guard-missing','outdated','incompatible'].includes(connection.kind) ? tab.id : null;
    reconnect.hidden = !reconnectTabId;
    document.querySelector('#reconnect-note').hidden = !reconnectTabId;
  } catch { FacefixTimers.render(timerRoot,null); }
  finally { checking = false; }
}
reconnect.addEventListener('click',async () => {
  if (!reconnectTabId) return;
  reconnect.disabled=true;
  try { await chrome.tabs.reload(reconnectTabId); }
  catch { document.querySelector('#reconnect-note').textContent='Could not refresh this tab. Refresh Facebook in the browser, then reopen Facefix.'; }
  finally { reconnect.disabled=false; }
});
void updateTimers();
setInterval(updateTimers,250);

const recording = document.querySelector('#record-diagnostics');
chrome.storage.local.get({diagnosticsEnabled:true}).then(value => { recording.checked = value.diagnosticsEnabled; });
recording.addEventListener('change', () => chrome.storage.local.set({diagnosticsEnabled:recording.checked}));
document.querySelector('#report-failure').addEventListener('click', async event => {
  const button = event.currentTarget;
  const result = document.querySelector('#diagnostic-status');
  button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({type:'facefix-diagnostic-report'});
    result.textContent = response?.ok ? 'Report saved. ' + response.report.findings[0].title + '. Open the history for evidence and next steps.' : 'Could not capture a report. Open the history and try again.';
  } catch { result.textContent = 'Could not capture a report. Reload the extension and try again.'; }
  finally { button.disabled = false; }
});

const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
function render(counters = {}) {
  for (const kind of kinds) document.getElementById(kind).textContent = (counters[kind] || 0).toLocaleString();
}
chrome.storage.local.get('counters').then(({counters}) => render(counters));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.counters) render(changes.counters.newValue);
  if (changes.enabled) toggle.checked = changes.enabled.newValue !== false;
  if (changes.diagnosticsEnabled) recording.checked = changes.diagnosticsEnabled.newValue !== false;
});
document.querySelector('#reset').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const response = await chrome.runtime.sendMessage({type: 'facefix-reset'});
    status.textContent = response?.ok ? 'Counters reset.' : 'Could not reset. Try again.';
  } catch { status.textContent = 'Could not reset. Try again.'; }
});
