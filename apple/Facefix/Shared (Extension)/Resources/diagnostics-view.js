const $ = selector => document.querySelector(selector);
let data = {events:[],reports:[]};
const text = (tag,value,className) => { const node=document.createElement(tag); node.textContent=value; if(className)node.className=className; return node; };
async function load() {
  try {
    const response=await chrome.runtime.sendMessage({type:'facefix-diagnostic-read'});
    if(response?.ok) data=response.data;
    const {diagnosticsEnabled=true}=await chrome.storage.local.get('diagnosticsEnabled');
    $('#record').checked=diagnosticsEnabled;
    const tabs=await chrome.tabs.query({url:['https://*.facebook.com/*','https://facebook.com/*']});
    const selected=$('#tab').value;
    $('#tab').replaceChildren();
    for(const tab of tabs.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))) {
      const option=text('option',`Facebook tab ${tab.id}`); option.value=String(tab.id); $('#tab').append(option);
    }
    if(tabs.some(tab=>String(tab.id)===selected)) $('#tab').value=selected;
    render();
  } catch { $('#message').textContent='Could not read diagnostics. Reload the extension and reopen this page.'; }
}
function render() {
  const latest=data.reports.at(-1);
  $('#export').disabled=!latest;
  $('#findings').replaceChildren();
  if(latest) {
    $('#report-meta').textContent=`${new Date(latest.at).toLocaleString()} · Facebook tab ${latest.tabId ?? 'unavailable'} · Facefix ${latest.version} · ${latest.events.length} events`;
    for(const finding of latest.findings) {
      const card=text('article','','finding');
      card.append(text('div',finding.confidence,'tag'),text('h3',finding.title),text('p',finding.evidence),text('p',finding.action));
      $('#findings').append(card);
    }
    $('#snapshot').textContent=JSON.stringify({recording:latest.recording,version:latest.version,connection:latest.connection,memoryRepair:latest.memoryRepair,autoDiscardable:latest.autoDiscardable,status:latest.status,counters:latest.counters},null,2);
  } else {
    $('#report-meta').textContent='No report captured yet.';
    $('#findings').append(text('p','Capture a report immediately after a failure to preserve the evidence.','empty'));
    $('#snapshot').textContent='No snapshot yet.';
  }
  $('#timeline').replaceChildren();
  const tabId=Number($('#tab').value);
  const events=data.events.filter(event=>$('#all-tabs').checked || event.tabId===tabId).slice().reverse();
  for(const event of events) {
    const row=text('details','','event');
    const summary=text('summary','');
    summary.append(text('time',new Date(event.at).toLocaleTimeString()),text('b',FacefixDiagnostics.names[event.kind] || event.kind),text('small',`Tab ${event.tabId ?? 'unknown'}`));
    row.append(summary,text('pre',JSON.stringify({kind:event.kind,documentId:event.documentId,...event.details},null,2)));
    $('#timeline').append(row);
  }
  if(!events.length) $('#timeline').append(text('p','No matching events yet. Keep recording on before reproducing the issue.','empty'));
}
$('#record').addEventListener('change',()=>chrome.storage.local.set({diagnosticsEnabled:$('#record').checked}));
$('#tab').addEventListener('change',render);
$('#all-tabs').addEventListener('change',render);
$('#capture').addEventListener('click',async()=>{
  $('#capture').disabled=true;
  try {
    const tabId=Number($('#tab').value);
    if(!Number.isInteger(tabId)||!tabId) { $('#message').textContent='Open a Facebook tab first.'; return; }
    const response=await chrome.runtime.sendMessage({type:'facefix-diagnostic-report',tabId});
    $('#message').textContent=response?.ok?'Failure report saved. Review the findings below.':'Could not capture the report. The selected tab may have closed.';
    await load();
  } catch { $('#message').textContent='Could not capture the report. Try again.'; }
  finally { $('#capture').disabled=false; }
});
$('#export').addEventListener('click',()=>{
  const latest=data.reports.at(-1); if(!latest)return;
  const payload={schemaVersion:1,exportedAt:new Date().toISOString(),report:latest};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const link=document.createElement('a'); link.href=url; link.download=`facefix-report-${new Date(latest.at).toISOString().replace(/[:.]/g,'-')}.json`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('#message').textContent='Report downloaded. Review it before choosing to share it.';
});
$('#clear').addEventListener('click',async()=>{
  const response=await chrome.runtime.sendMessage({type:'facefix-diagnostic-clear'}).catch(()=>null);
  $('#message').textContent=response?.ok?'Local diagnostic history and reports cleared. Counters are unchanged.':'Could not clear diagnostics. Try again.';
  await load();
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  if(changes.diagnostics) { data=FacefixDiagnostics.prune(changes.diagnostics.newValue); render(); }
  if(changes.diagnosticsEnabled) $('#record').checked=changes.diagnosticsEnabled.newValue!==false;
});
void load();
