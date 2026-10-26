const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const read = name => fs.readFileSync(require.resolve('../' + name), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
class CustomEvent extends Event { constructor(name, options = {}) { super(name); this.detail = options.detail; } }
function configured(extra = {}) {
  const context = vm.createContext({URL, Event, CustomEvent, console, ...extra});
  vm.runInContext(read('messenger-config.js'), context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('desktop identity is limited to message routes, preserves touch/media, and restores on live pause', () => {
  const document = new EventTarget();
  const navigator = {userAgent:'iPhone native',appVersion:'native',platform:'iPhone',maxTouchPoints:5,mediaDevices:{}};
  const context = configured({document, navigator, location:new URL('https://www.facebook.com/messages/e2ee/t/123')});
  const media = navigator.mediaDevices;
  vm.runInContext(read('messenger-identity.js'), context);
  assert.equal(navigator.platform,'MacIntel');
  assert.equal(navigator.userAgent,context.FacefixMessenger.userAgent);
  assert.equal(navigator.maxTouchPoints,5);
  assert.equal(navigator.mediaDevices,media);
  context.location = new URL('https://www.facebook.com/groups/example');
  assert.equal(navigator.userAgent,'iPhone native','the feed keeps its native identity');
  context.location = new URL('https://www.facebook.com/messages/t/123');
  document.dispatchEvent(new CustomEvent('facefix-settings',{detail:false}));
  assert.equal(navigator.platform,'iPhone');
  document.dispatchEvent(new CustomEvent('facefix-settings',{detail:true}));
  assert.equal(navigator.platform,'MacIntel');
});

test('locked navigator properties and later website changes survive identity cleanup', () => {
  const navigator = {platform:'iPhone'};
  Object.defineProperty(navigator,'userAgent',{value:'locked',configurable:false});
  const document = new EventTarget();
  const context = configured({navigator,document,location:new URL('https://www.facebook.com/messages/')});
  vm.runInContext(read('messenger-identity.js'),context);
  assert.equal(navigator.userAgent,'locked');
  Object.defineProperty(navigator,'platform',{value:'page edit',configurable:true});
  document.dispatchEvent(new CustomEvent('facefix-settings',{detail:false}));
  assert.equal(navigator.platform,'page edit');
});

test('Facebook login.php preserves desktop identity only for the messaging return flow', () => {
  const config=configured().FacefixMessenger;
  assert.equal(config.isIdentityPage('https://www.facebook.com/login.php?next=https%3A%2F%2Fwww.facebook.com%2Fmessages%2F'),true);
  for(const url of ['https://www.facebook.com/login.php','https://www.facebook.com/login.php?next=/groups/example',
    'https://www.facebook.com/login.php?next=https://attacker.test/messages/']) assert.equal(config.isIdentityPage(url),false);
});

test('the registered MAIN script is self-contained and exposes no shared configuration on the page', () => {
  const navigator={platform:'iPhone',userAgent:'native',appVersion:'native'};
  const context=vm.createContext({URL,document:new EventTarget(),navigator,location:new URL('https://www.facebook.com/messages/t/123')});
  vm.runInContext(read('messenger-identity.js'),context);
  assert.equal(navigator.platform,'MacIntel');
  assert.equal(context.FacefixMessenger,undefined);
});

const rules = JSON.parse(read('rules/messenger.json'));
test('Safari request patterns avoid unsupported alternatives and noncapturing groups', () => {
  for (const rule of rules) {
    assert.ok(!rule.condition.regexFilter.includes('|'));
    assert.ok(!rule.condition.regexFilter.includes('(?:'));
  }
});
function redirect(url) {
  for (const rule of rules.filter(rule=>rule.action.type==='redirect')) {
    const pattern = new RegExp(rule.condition.regexFilter);
    if (pattern.test(url)) return url.replace(pattern,rule.action.redirect.regexSubstitution.replace(/\\(\d)/g,'$$$1'));
  }
  return url;
}
test('request rules preserve thread links and never redirect login/security or lookalike origins', () => {
  assert.equal(redirect('https://messenger.com/'),'https://www.facebook.com/messages/');
  assert.equal(redirect('https://m.messenger.com/?ref=test'),'https://www.facebook.com/messages/?ref=test');
  assert.equal(redirect('https://mbasic.facebook.com/messages?ref=test'),'https://www.facebook.com/messages?ref=test');
  assert.equal(redirect('https://www.messenger.com/e2ee/t/123?ref=test'),'https://www.facebook.com/messages/e2ee/t/123?ref=test');
  assert.equal(redirect('https://m.facebook.com/messages/t/123'),'https://www.facebook.com/messages/t/123');
  for (const url of ['https://www.facebook.com/login/?next=/messages/','https://m.facebook.com/checkpoint/',
    'https://www.messenger.com/login/','https://m.facebook.com/messages-bogus','https://messenger.com.attacker.test/t/123']) assert.equal(redirect(url),url);
  const headers = rules.filter(rule=>rule.action.type==='modifyHeaders');
  for (const url of ['https://www.facebook.com/','https://www.facebook.com/groups/example','https://example.test/?u=https://www.facebook.com/messages/',
    'https://www.facebook.com.attacker.test/messages/']) assert.ok(!headers.some(rule=>new RegExp(rule.condition.regexFilter).test(url)),url);
  assert.ok(headers.some(rule=>new RegExp(rule.condition.regexFilter).test('https://www.facebook.com/messages/t/123')));
  assert.ok(headers.every(rule=>rule.action.requestHeaders[0].value===configured().FacefixMessenger.userAgent));
});

async function worker({stored = true, registered = [], rulesEnabled = true} = {}) {
  const messages = [], changes = [], updates = [];
  let failRule = false;
  let scripts = structuredClone(registered);
  const api = {
    runtime:{id:'facefix',getURL:name=>'extension://facefix/'+name,onMessage:{addListener:fn=>messages.push(fn)},onInstalled:{addListener(){}},onStartup:{addListener(){}}},
    storage:{local:{async get(){return {enabled:stored};}},onChanged:{addListener:fn=>changes.push(fn)}},
    scripting:{
      async getRegisteredContentScripts(){return structuredClone(scripts);},
      async registerContentScripts(items){for(const item of items){assert.ok(!scripts.some(value=>value.id===item.id));scripts.push(plain(item));}},
      async updateContentScripts(items){updates.push(...plain(items));for(const item of items){const i=scripts.findIndex(value=>value.id===item.id);assert.notEqual(i,-1);scripts[i]=plain(item);}},
      async unregisterContentScripts({ids}){scripts=scripts.filter(item=>!ids.includes(item.id));}
    },
    declarativeNetRequest:{async getEnabledRulesets(){return rulesEnabled?['messenger']:[];},async updateEnabledRulesets({enableRulesetIds}){
      if(failRule){failRule=false;throw Error('Injected Safari API failure');}rulesEnabled=enableRulesetIds.includes('messenger');}}
  };
  const context = configured({chrome:api});
  vm.runInContext(read('messenger-background.js'),context);
  function send(message={type:'facefix-messenger-status'},sender={id:'facefix',url:api.runtime.getURL('popup.html')}) {
    return new Promise(resolve=>{if(!messages.some(fn=>fn(message,sender,resolve)===true))resolve(undefined);});
  }
  await send();
  return {send,updates,snapshot:()=>({scripts,rulesEnabled}),setStored:value=>{stored=value;},setEnabled:async value=>{stored=value;changes.forEach(fn=>fn({enabled:{newValue:value}},'local'));return send();},failNextRule:()=>{failRule=true;}};
}

test('Safari worker reconciles old persistent definitions and serializes pause/resume', async () => {
  const old={id:'facefix-messenger-identity',matches:['https://old.example/*'],js:['old.js'],world:'ISOLATED'};
  const app=await worker({registered:[old]});
  assert.ok(app.updates.length>0);
  let current=app.snapshot();
  assert.equal(current.scripts[0].world,'MAIN');
  assert.deepEqual(current.scripts[0].js,['messenger-identity.js']);
  assert.ok(!current.scripts[0].matches.includes('https://old.example/*'));
  await app.setEnabled(false);
  assert.deepEqual(app.snapshot(),{scripts:[],rulesEnabled:false});
  await Promise.all([true,false,true].map(value=>app.setEnabled(value)));
  assert.equal(app.snapshot().rulesEnabled,true);
  assert.equal(app.snapshot().scripts.length,1);
});

test('failed Safari enable rolls back registrations and remains an explicit failure', async () => {
  const app=await worker({stored:false,rulesEnabled:false});
  app.setStored(true);
  app.failNextRule();
  const response=await app.send();
  assert.equal(response.ok,false);
  assert.deepEqual(app.snapshot(),{scripts:[],rulesEnabled:false},'partial registration is rolled back');
  assert.equal((await app.send()).ok,true,'a later explicit retry can recover');
  assert.equal(app.snapshot().rulesEnabled,true);
  await app.setEnabled(false);
  assert.deepEqual(app.snapshot(),{scripts:[],rulesEnabled:false});
});

test('ordinary pages and other extensions cannot invoke Messenger setup', async () => {
  const app=await worker();
  assert.equal(await app.send(undefined,{id:'facefix',tab:{id:1},url:'https://www.facebook.com/'}),undefined);
  assert.equal(await app.send(undefined,{id:'other',url:'extension://facefix/popup.html'}),undefined);
  assert.equal((await app.send(undefined,{id:'facefix',tab:{id:1},url:'extension://facefix/popup.html'})).ok,true,'the actual extension page remains valid when opened in a tab');
});

test('a delayed bridge settings read cannot reverse a later pause or privacy opt-out', async () => {
  const document=new EventTarget();
  const received=[];
  document.addEventListener('facefix-settings',event=>received.push(['enabled',event.detail]));
  document.addEventListener('facefix-diagnostics-settings',event=>received.push(['diagnostics',event.detail]));
  let change,resolve;
  const chrome={runtime:{id:'facefix',getManifest:()=>({version:'test'}),onMessage:{addListener(){}},sendMessage:async()=>{}},
    storage:{local:{get:()=>new Promise(done=>{resolve=done;})},onChanged:{addListener:fn=>{change=fn;}}}};
  vm.runInNewContext(read('settings.js'),{document,Event,CustomEvent,chrome,performance,window:{}});
  change({enabled:{newValue:false},diagnosticsEnabled:{newValue:false}},'local');
  resolve({enabled:true,diagnosticsEnabled:true});
  await settle();
  assert.ok(received.every(([,value])=>value===false));
});
