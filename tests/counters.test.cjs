const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = file => fs.readFileSync(require.resolve('../' + file), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}
function signal() {
  const listeners = [];
  return {listeners, addListener: fn => listeners.push(fn)};
}
function harness({memorySupported = true} = {}) {
  const data = {};
  const changed = signal();
  const updates = [];
  const tabs = [{id:1, url:'https://www.facebook.com/groups/test/', ...(memorySupported ? {autoDiscardable:true} : {})}, {id:2, url:'https://example.org/'}];
  const base = {
    storage: {
      local: {
        async get(keys) {
          await settle(); // Force overlapping read/modify/write to expose lost increments.
          const defaults = typeof keys === 'string' ? {[keys]:undefined} : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, undefined])) : keys;
          return structuredClone(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, key in data ? data[key] : value])));
        },
        async set(values) {
          await settle();
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = {oldValue:data[key], newValue:structuredClone(value)};
            data[key] = structuredClone(value);
          }
          for (const fn of changed.listeners) fn(changes, 'local');
        }
      }, onChanged: changed
    },
    tabs: {
      onUpdated: signal(),
      async query() { return tabs.filter(tab => tab.url.includes('facebook.com')); },
      async update(id, values) { updates.push({id, ...values}); return {id,...values}; },
      async get(id) { return tabs.find(tab=>tab.id===id); },
      async sendMessage() { throw new Error('No receiver'); }
    },
    runtime: {onMessage:signal(), id:'facefix-test', getManifest:()=>({version:'1.4.0'}), getURL: path => 'chrome-extension://facefix-test/' + path, onInstalled:signal(), onStartup:signal()}
  };
  let messages;
  function startWorker() {
    messages = signal();
    const context = vm.createContext({chrome:{...base,runtime:{...base.runtime,onMessage:messages}},URL,console,setTimeout,clearTimeout});
    context.importScripts = (...files) => files.forEach(file=>vm.runInContext(source(file),context));
    vm.runInContext(source('background.js'),context);
  }
  function send(message, sender) {
    return new Promise((resolve, reject) => {
      let pending = false;
      try {
        for (const fn of messages.listeners) if (fn(message, sender, resolve) === true) pending = true;
        if (!pending) resolve(undefined);
      } catch (error) { reject(error); }
    });
  }
  const sender = {id:base.runtime.id, tab:tabs[0], url:tabs[0].url};
  const popupSender = {id:base.runtime.id, url:base.runtime.getURL('popup.html')};
  const client = sender => ({...base, runtime:{...base.runtime, sendMessage:message => send(message, sender)}});
  startWorker();
  return {data, base, updates, sender, popupSender, client, send, startWorker};
}
test('counter bridge, multiple tabs, persistence, pause, popup updates, and reset', async () => {
  const h = harness();
  const document = new EventTarget();
  const content = h.client(h.sender);
  const pending = [];
  const sendMessage = content.runtime.sendMessage;
  content.runtime.sendMessage = message => {
    const promise = sendMessage(message);
    pending.push(promise);
    return promise;
  };
  vm.runInNewContext(source('settings.js'), {document,Event,CustomEvent,chrome:content,performance,window:{},clearInterval() {}});
  await settle(); await settle();
  const window = new EventTarget();
  document.hidden = false;
  document.querySelectorAll = () => [];
  const page = {window, document, Event, CustomEvent, URL, performance,
    location:new URL(h.sender.url), history:{pushState() {}, replaceState() {}},
    scrollY:0, requestAnimationFrame:() => 1, cancelAnimationFrame() {}};
  vm.runInNewContext(source('guard.js'), page);
  document.hidden = true;
  window.dispatchEvent(new Event('visibilitychange'));
  page.history.pushState({}, '', '/');
  document.hidden = false;
  window.dispatchEvent(new Event('visibilitychange'));
  await Promise.all(pending);
  assert.equal(h.data.counters.homeRedirects, 1, 'page hook reaches durable storage');
  assert.equal(h.data.counters.returnEvents, 1);
  let snapshot;
  for (const listener of content.runtime.onMessage.listeners) listener({type:'facefix-status'}, {id:h.base.runtime.id}, value => { snapshot = value.guard; assert.equal(value.bridge,true); assert.equal(value.bridgeVersion,'1.4.0'); });
  assert.equal(snapshot.schema, 1);
  assert.ok(snapshot.navigationMs > 0 && snapshot.navigationMs <= 4000);
  assert.ok(snapshot.recoveryMs > 0 && snapshot.recoveryMs <= 15000);
  assert.equal(JSON.stringify(snapshot).includes('https:'), false, 'status does not contain page or post URLs');
  await h.send({type:'facefix-reset'}, h.popupSender);
  for (let i = 0; i < 25; i++) document.dispatchEvent(new CustomEvent('facefix-count', {detail:'homeRedirects'}));
  const secondTab = {...h.sender, tab:{id:3, url:h.sender.url}};
  await Promise.all([...pending, ...Array.from({length:25}, () => h.send({type:'facefix-count', kind:'homeRedirects'}, secondTab))]);
  assert.equal(h.data.counters.homeRedirects, 50, 'simultaneous tabs do not lose increments');
  assert.deepEqual(Object.keys(h.data.counters).sort(), ['homeRedirects', 'reloads', 'returnEvents', 'scrollRecoveries']);
  assert.equal(await h.send({type:'facefix-count', kind:'arbitrary-url'}, h.sender), undefined);
  assert.equal(await h.send({type:'facefix-count', kind:'reloads'}, {...h.sender, id:'other-extension'}), undefined);
  assert.equal(await h.send({type:'facefix-count', kind:'reloads'}, {...h.sender, url:'https://facebook.com.attacker.test/'}), undefined);
  assert.equal(await h.send({type:'facefix-reset'}, h.sender), undefined, 'page cannot reset counters');
  h.startWorker();
  await h.send({type:'facefix-count', kind:'reloads'}, h.sender);
  assert.equal(h.data.counters.homeRedirects, 50, 'worker restart retains counts');
  assert.equal(h.data.counters.reloads, 1);

  const nodes = Object.fromEntries(['#enabled', '#version', '#reconnect', '#reconnect-note', '#record-diagnostics', '#report-failure', '#diagnostic-status', '#timers', '#reset', '#status', '#returnEvents', '#reloads', '#homeRedirects', '#scrollRecoveries'].map(id => [id, Object.assign(new EventTarget(), {textContent:'', checked:true})]));
  const timerFields = new Map();
  nodes['#timers'].querySelector = selector => { if (!timerFields.has(selector)) timerFields.set(selector, {}); return timerFields.get(selector); };
  const popup = {querySelector: selector => nodes[selector], getElementById: id => nodes['#' + id], createElement:() => ({}), head:{append() {}}};
  vm.runInNewContext(source('connection.js') + '\n' + source('timers.js') + '\n' + source('popup.js'), {document:popup, chrome:h.client(h.popupSender),URL,setTimeout,clearTimeout,setInterval:() => 1});
  await settle(); await settle();
  assert.equal(nodes['#homeRedirects'].textContent, '50');
  await h.send({type:'facefix-count', kind:'reloads'}, h.sender);
  assert.equal(nodes['#reloads'].textContent, '2', 'open popup updates live');
  await h.base.storage.local.set({enabled:false});
  assert.equal(nodes['#enabled'].checked, false);
  const before = JSON.stringify(h.data.counters);
  document.dispatchEvent(new CustomEvent('facefix-count', {detail:'homeRedirects'}));
  await h.send({type:'facefix-count', kind:'homeRedirects'}, h.sender);
  assert.equal(JSON.stringify(h.data.counters), before, 'pause blocks bridge and worker increments');
  nodes['#reset'].dispatchEvent(new Event('click'));
  for (let i = 0; i < 8; i++) await settle();
  assert.equal(nodes['#status'].textContent, 'Counters reset.');
  assert.equal(nodes['#homeRedirects'].textContent, '0');
  assert.ok(Object.values(h.data.counters).every(value => value === 0));
  await h.base.storage.local.set({enabled:true});
  const operations = [h.send({type:'facefix-count', kind:'reloads'}, h.sender), h.send({type:'facefix-reset'}, h.popupSender), h.send({type:'facefix-count', kind:'reloads'}, h.sender)];
  await Promise.all(operations);
  assert.equal(h.data.counters.reloads, 1, 'reset is serialized with increments');
});
test('tab memory protection is scoped to Facebook and follows the setting', async () => {
  const h = harness();
  for (const fn of h.base.tabs.onUpdated.listeners) {
    fn(1, {status:'loading'}, h.sender.tab);
    fn(2, {status:'loading'}, {id:2, url:'https://example.org/'});
  }
  await settle(); await settle();
  assert.deepEqual(h.updates, [{id:1, autoDiscardable:false}]);
  await h.base.storage.local.set({enabled:false});
  for (let i = 0; i < 5; i++) await settle();
  assert.deepEqual(h.updates.at(-1), {id:1, autoDiscardable:true});
});

test('Safari without autoDiscardable keeps messaging and settings without unsupported tab writes', async () => {
  const h = harness({memorySupported:false});
  h.base.tabs.update = async () => { throw new Error('unsupported API must not be called'); };
  for (const fn of h.base.tabs.onUpdated.listeners) fn(1, {status:'loading'}, h.sender.tab);
  for (const fn of h.base.runtime.onInstalled.listeners) await fn();
  await h.base.storage.local.set({enabled:false});
  await h.base.storage.local.set({enabled:true});
  for (let i = 0; i < 8; i++) await settle();
  assert.deepEqual(h.updates, []);
  await h.send({type:'facefix-count',kind:'returnEvents'}, h.sender);
  assert.equal(h.data.counters.returnEvents, 1);
  assert.equal(h.data.diagnostics, undefined, 'unsupported capability is not reported as a failure');
});

module.exports={harness,settle};
test('diagnostic worker validates senders, serializes tabs, limits history, respects opt-out, and clears separately',async()=>{
  const h=harness();
  const events=Array.from({length:50},()=>({kind:'scroll-jump',details:{deltaPx:800,url:'https://private',key:'private'}}));
  assert.equal(await h.send({type:'facefix-diagnostic-events',events},{...h.sender,id:'other'}),undefined);
  assert.equal(await h.send({type:'facefix-diagnostic-events',events},{...h.sender,url:'https://facebook.com.attacker.test/'}),undefined);
  assert.equal(await h.send({type:'facefix-diagnostic-read'},h.sender),undefined);
  await Promise.all(Array.from({length:4},()=>h.send({type:'facefix-diagnostic-events',events},h.sender)));
  assert.equal(h.data.diagnostics.events.length,120,'per-document event budget applies');
  await Promise.all([2,3].map(id=>h.send({type:'facefix-diagnostic-events',events},{...h.sender,documentId:'document-'+id,tab:{id}})));
  assert.equal(h.data.diagnostics.events.length,220,'simultaneous documents preserve each other’s events');
  assert.equal(JSON.stringify(h.data.diagnostics).includes('private'),false);
  await h.base.storage.local.set({diagnosticsEnabled:false});
  await h.send({type:'facefix-diagnostic-events',events},{...h.sender,documentId:'new-document'});
  assert.equal(h.data.diagnostics.events.length,220);
  await h.send({type:'facefix-count',kind:'reloads'},h.sender);
  const response=await h.send({type:'facefix-diagnostic-report'},h.popupSender);
  assert.equal(response.ok,true,'manual reports work with recording disabled');
  assert.equal(response.report.connection.kind,'bridge-missing');
  assert.equal(response.report.recording,false);
  assert.equal(response.report.events.length,120);
  for(let i=0;i<6;i++) await h.send({type:'facefix-diagnostic-report'},h.popupSender);
  assert.equal(h.data.diagnostics.reports.length,5);
  await h.send({type:'facefix-diagnostic-clear'},h.popupSender);
  assert.equal(h.data.diagnostics.events.length,0);
  assert.equal(h.data.diagnostics.reports.length,0);
  assert.equal(h.data.counters.reloads,1,'clearing diagnostics preserves aggregate counters');
});
test('failure reports verify guard versions, capture missing bridge, and confirm memory repairs',async()=>{
  const h=harness();
  const snapshot={schema:1,guardVersion:'1.4.0',enabled:true,away:false,navigationMs:0,recoveryMs:0,wasDiscarded:true,navigationAPI:true,pageLoadType:'reload'};
  h.base.tabs.sendMessage=async()=>({bridge:true,bridgeVersion:'1.4.0',guard:{...snapshot,url:'https://private',postText:'private'}});
  h.sender.tab.autoDiscardable=true;
  const report=(await h.send({type:'facefix-diagnostic-report'},h.popupSender)).report;
  assert.equal(report.connection.kind,'connected');
  assert.equal(report.memoryRepair,true);
  assert.ok(report.findings.some(f=>f.title.includes('discarded')));
  assert.ok(report.findings.some(f=>f.action.includes('verified')));
  assert.equal(JSON.stringify(report).includes('private'),false);
  h.base.tabs.update=async()=>{throw Error('failed')};
  const failed=(await h.send({type:'facefix-diagnostic-report'},h.popupSender)).report;
  assert.equal(failed.memoryRepair,false);
  assert.ok(failed.findings.some(f=>f.action.includes('could not verify')));
  h.base.tabs.sendMessage=async()=>({...snapshot,guardVersion:'1.3.0',navigationAPI:undefined,wasDiscarded:undefined});
  const stale=(await h.send({type:'facefix-diagnostic-report'},h.popupSender)).report;
  assert.equal(stale.connection.kind,'outdated');
  assert.equal(stale.status.navigationAPI,null);
  h.base.tabs.sendMessage=async()=>{throw Error('no receiver')};
  const missing=(await h.send({type:'facefix-diagnostic-report'},h.popupSender)).report;
  assert.equal(missing.connection.kind,'bridge-missing');
  assert.ok(missing.events.some(e=>e.kind==='bridge-unavailable'));
});


test('page-complete self-check records a missing bridge and versions without URLs',async()=>{
  const h=harness();
  for(const fn of h.base.tabs.onUpdated.listeners)fn(1,{status:'complete'},h.sender.tab);
  for(let i=0;i<12;i++)await settle();
  assert.ok(h.data.diagnostics.events.some(e=>e.kind==='bridge-unavailable'));
  assert.ok(h.data.diagnostics.events.some(e=>e.kind==='connection-checked'&&e.details.connection==='bridge-missing'));
  assert.equal(JSON.stringify(h.data.diagnostics).includes('https:'),false);
});
