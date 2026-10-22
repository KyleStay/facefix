// Browser-only UI fixture. These synthetic APIs never access Facebook or real extension storage.
const fixtureChanges=[];
const fixturePageListeners=[];
const fixtureState={enabled:true,diagnosticsEnabled:true,counters:{returnEvents:0,reloads:0,homeRedirects:0,scrollRecoveries:0},diagnostics:{events:[],reports:[]}};
const fixtureStarted=Date.now();
const fixtureMode=new URLSearchParams(location.search).get('mode') || 'connected';
const fixtureStatus=()=>({schema:1,guardVersion:fixtureMode==='outdated'?'1.2.0':'1.4.0',enabled:fixtureState.enabled,away:false,navigationMs:Math.max(0,4000-(Date.now()-fixtureStarted)),recoveryMs:Math.max(0,15000-(Date.now()-fixtureStarted)),postMatched:true,wasDiscarded:false,pageLoadType:'navigate',navigationAPI:true,reason:Date.now()-fixtureStarted>15000?'finished':'running'});
const fixtureGet=async keys=>{
  const defaults=typeof keys==='string'?{[keys]:undefined}:Array.isArray(keys)?Object.fromEntries(keys.map(key=>[key,undefined])):keys;
  return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,key in fixtureState?fixtureState[key]:value]));
};
const fixtureSet=async values=>{
  const changes={};for(const [key,value]of Object.entries(values)){changes[key]={newValue:value,oldValue:fixtureState[key]};fixtureState[key]=value;}
  for(const fn of fixtureChanges)fn(changes,'local');
};
window.chrome={
 storage:{local:{get:fixtureGet,set:fixtureSet},onChanged:{addListener:fn=>fixtureChanges.push(fn)}},
 tabs:{query:async()=>[{id:7,url:fixtureMode==='wrong-tab'?'https://example.org/':'https://www.facebook.com/'}],reload:async()=>{document.querySelector('#reconnect-note').textContent='Fixture: refresh requested only after your click.';},sendMessage:async()=>{
   if(fixtureMode==='bridge-missing')throw Error('No receiver');
   return {bridge:true,bridgeVersion:'1.4.0',guard:fixtureMode==='guard-missing'?null:fixtureStatus()};
 }},
 runtime:{id:'fixture',getManifest:()=>({version:'1.4.0'}),onMessage:{addListener:fn=>fixturePageListeners.push(fn)},getURL:path=>path,sendMessage:async message=>{
   if(message.type==='facefix-reset'){await fixtureSet({counters:{returnEvents:0,reloads:0,homeRedirects:0,scrollRecoveries:0}});return {ok:true};}
   if(message.type==='facefix-diagnostic-read')return {ok:true,data:fixtureState.diagnostics};
   if(message.type==='facefix-diagnostic-clear'){await fixtureSet({diagnostics:{events:[],reports:[]}});return {ok:true};}
   if(message.type==='facefix-diagnostic-report'){
     const now=Date.now();
     const events=[{kind:'returned',at:now-8000,tabId:7,documentId:'fixture-document',details:{reason:'visibility',navigationMs:4000,recoveryMs:15000}},
       {kind:'anchor-missing',at:now-1500,tabId:7,documentId:'fixture-document',details:{}},
       {kind:'recovery-attempt',at:now-1000,tabId:7,documentId:'fixture-document',details:{success:false,mode:'pixel',deltaPx:900}}];
     const status={...fixtureStatus(),postMatched:false};
     const report={at:now,tabId:7,version:'1.4.0',recording:fixtureState.diagnosticsEnabled,connection:{kind:'connected',installedVersion:'1.4.0',bridgeVersion:'1.4.0',guardVersion:'1.4.0'},memoryRepair:null,status,autoDiscardable:false,findings:FacefixDiagnostics.analyze(events,status),counters:fixtureState.counters,events};
     await fixtureSet({diagnostics:{events,reports:[report]}});return {ok:true,report};
   }
   return {ok:true};
 }}
};
