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
function harness() {
  const data = {};
  const changed = signal();
  const updates = [];
  const tabs = [{id:1, url:'https://www.facebook.com/groups/test/'}, {id:2, url:'https://example.org/'}];
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
      async update(id, values) { updates.push({id, ...values}); }
    },
    runtime: {id:'facefix-test', getURL: path => 'chrome-extension://facefix-test/' + path, onInstalled:signal(), onStartup:signal()}
  };
  let messages;
  function startWorker() {
    messages = signal();
    vm.runInNewContext(source('background.js'), {chrome:{...base, runtime:{...base.runtime, onMessage:messages}}, URL, console});
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
  vm.runInNewContext(source('settings.js'), {document, CustomEvent, chrome:content});
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

  const nodes = Object.fromEntries(['#enabled', '#reset', '#status', '#returnEvents', '#reloads', '#homeRedirects', '#scrollRecoveries'].map(id => [id, Object.assign(new EventTarget(), {textContent:'', checked:true})]));
  const popup = {querySelector: selector => nodes[selector], getElementById: id => nodes['#' + id]};
  vm.runInNewContext(source('popup.js'), {document:popup, chrome:h.client(h.popupSender)});
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
