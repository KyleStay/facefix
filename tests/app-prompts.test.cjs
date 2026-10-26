const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function link(href, text = 'Open app', options = {}) {
  const values = new Map(options.display ? [['display', options.display]] : []);
  const priorities = new Map(options.priority ? [['display', options.priority]] : []);
  return {href, textContent:text, aria:options.aria, protected:options.protected,
    isConnected:true,
    closest(selector) {
      const matches = selector.split(',').some(value => {
        const part = value.trim(), role = part.match(/^\[role(~?)="([^"]+)"\]$/);
        if (role) return role[1] ? (options.role || '').split(/\s+/).includes(role[2]) : options.role === role[2];
        return options.context === part;
      });
      return this.protected || matches ? {} : null;
    },
    getAttribute(name) { return name === 'href' ? this.href : this.aria; },
    style:{getPropertyValue:key => values.get(key) || '',
      getPropertyPriority:key => priorities.get(key) || '',
      setProperty(key, value, priority) { values.set(key, value); priorities.set(key, priority); },
      removeProperty(key) { values.delete(key); priorities.delete(key); }}
  };
}
async function setup(links, enabled = true, get) {
  let change, mutation, timer;
  const metrics = {scans:0,timers:0};
  const events = {};
  const observer = {active:false,observe() {this.active = true;},disconnect() {this.active = false;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../app-prompts.js'), 'utf8'), {
    URL, Map, location:new URL('https://m.facebook.com/groups/fixture'),
    document:{querySelectorAll:() => {metrics.scans++; return links;}, addEventListener(name, fn) {events[name] = fn;}},
    window:{addEventListener(name, fn) {events[name] = fn;}},
    MutationObserver:function(fn) {mutation = fn; return observer;},
    setTimeout(fn) {metrics.timers++; timer = fn; return 1;}, clearTimeout() {timer = undefined;},
    chrome:{storage:{local:{get:get || (async () => ({enabled}))},
      onChanged:{addListener(fn) {change = fn;}}}}
  });
  await new Promise(resolve => setImmediate(resolve));
  return {observer,events,metrics,setStored(value) {enabled = value;},configure(value) {enabled = value; change({enabled:{newValue:value}}, 'local');},
    mutate() {if (observer.active) mutation();},flush() {const fn = timer; timer = undefined; fn?.();}};
}
const display = item => item.style.getPropertyValue('display');

test('only explicit Facebook and Messenger app promotions outside content are hidden', async () => {
  const hidden = [link('fb://feed'),link('fbapp://feed',' Open   in app '),
    link('https://apps.apple.com/us/app/facebook/id284882215?mt=8','Get Facebook app'),
    link('itms-apps://itunes.apple.com/app/id284882215','Use the Facebook app'),
    link('fb-messenger://share','Open Messenger app'),
    link('https://apps.apple.com/us/app/messenger/id454638411','Get Messenger app')];
  const kept = [link('/login/?next=/'),link('/groups/123'),link('/'),link('fb://feed','View profile'),
    link('https://apps.apple.com/app/id123456','Open app'),
    link('https://apps.apple.com.attacker.test/app/id284882215'),
    link('javascript:alert(1)'),link('https://example.org/','Open in app'),
    link('fb://feed','Open app',{protected:true}),
    link('https://www.facebook.com/app')];
  await setup([...hidden,...kept]);
  assert.ok(hidden.every(item => display(item) === 'none'));
  assert.ok(kept.every(item => display(item) === ''));
  assert.equal(hidden[0].href, 'fb://feed', 'destination is never rewritten or intercepted');
});
test('pause restores styles, resume hides, and reused navigation links are restored', async () => {
  const item = link('fb://feed','Open app',{display:'inline-flex'});
  const h = await setup([item]);
  assert.equal(display(item),'none');
  h.configure(false);
  assert.equal(display(item),'inline-flex');
  assert.equal(h.observer.active,false);
  h.configure(true);
  assert.equal(display(item),'none');
  item.href = '/login/';
  h.mutate(); h.flush();
  assert.equal(display(item),'inline-flex');
  assert.equal(item.href,'/login/');
});
test('late and renamed prompts, saved disabled setting, BFCache lifecycle and site edits', async () => {
  const links = [];
  const h = await setup(links,false);
  const item = link('fb://feed','Open app');
  links.push(item); h.mutate(); h.flush();
  assert.equal(display(item),'');
  h.configure(true);
  assert.equal(display(item),'none');
  item.textContent = 'Read comments'; h.mutate(); h.flush();
  assert.equal(display(item),'');
  item.textContent = 'Open in app'; h.mutate(); h.flush();
  assert.equal(display(item),'none');
  item.style.setProperty('display','flex','');
  h.configure(false);
  assert.equal(display(item),'flex','pause preserves a later page style edit');
  h.configure(true);
  h.events.pagehide();
  assert.equal(h.observer.active,false);
  h.events.pageshow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.observer.active,true);
  item.isConnected = false; h.mutate(); h.flush();
  // querySelectorAll in a real document cannot return a disconnected node.
  links.splice(0); h.mutate(); h.flush();
  assert.equal(display(item),'flex');
});

test('a delayed storage read cannot override a newer pause, and BFCache rereads the setting', async () => {
  const item = link('fb://feed');
  let resolve;
  const h = await setup([item],true,() => new Promise(done => {resolve = done;}));
  h.configure(false);
  resolve({enabled:true});
  await new Promise(done => setImmediate(done));
  assert.equal(display(item),'','stale startup value cannot reenable suppression');
  h.configure(true);
  h.events.pagehide();
  h.events.pageshow();
  resolve({enabled:false});
  await new Promise(done => setImmediate(done));
  assert.equal(display(item),'','a setting changed while frozen is read on return');
  assert.equal(h.observer.active,false);
});

test('a promotion recycled into post content is restored', async () => {
  const item = link('fb://feed');
  const h = await setup([item]);
  assert.equal(display(item),'none');
  item.protected = true;
  h.mutate(); h.flush();
  assert.equal(display(item),'');
});

test('native and ARIA forms/dialogs retain their app links', async () => {
  // Selector membership model only: this does not execute a browser DOM.
  const kept = ['article','[data-pagelet^="FeedUnit_"]','form','dialog','[contenteditable]'].map(context => link('fb://feed','Open app',{context}));
  for (const role of ['article','form','dialog','alertdialog','textbox','article region','form search','dialog region','alertdialog dialog']) {
    kept.push(link('fb://feed','Open app',{role}));
  }
  await setup(kept);
  assert.ok(kept.every(item => display(item) === ''),'semantic content and login contexts stay intact');
});

test('scheme, host, product and label near misses remain normal links', async () => {
  const kept = [
    link('fbappx://feed'), link('facebook://feed'),
    link('https://apps.apple.com@attacker.test/app/id284882215'),
    link('https://apps.apple.com.attacker.test/app/id284882215'),
    link('https://apps.apple.com/app/id2848822150'),
    link('https://apps.apple.com/app/id284882215/reviews'),
    link('https://apps.apple.com/app?product=id284882215'),
    link('http://apps.apple.com/app/id284882215'),
    link('https://['),
    link('/login/?next=fb%3A%2F%2Ffeed'),
    link('fb://feed','Reopen app'), link('fb://feed','Open in application'),
    link('fb://feed','Open app to read comments'), link('fb://feed','Get Facebook'),
  ];
  const promoted = [link('FB://feed','Open the app'),
    link('https://APPS.APPLE.COM/us/app/facebook/id284882215/','Use Facebook app')];
  const destinations = kept.map(item => item.href);
  await setup([...kept,...promoted]);
  assert.ok(kept.every(item => display(item) === ''));
  assert.deepEqual(kept.map(item => item.href),destinations);
  assert.ok(promoted.every(item => display(item) === 'none'));
});

test('pause cancels pending suppression and restores original display priority', async () => {
  const item = link('fb://feed','Open app',{display:'inline-flex',priority:'important'});
  const h = await setup([item]);
  h.mutate();
  h.configure(false);
  h.flush();
  assert.equal(display(item),'inline-flex');
  assert.equal(item.style.getPropertyPriority('display'),'important');
  assert.equal(h.observer.active,false);
});

test('destination lookalikes and protected role permutations never get suppressed', async () => {
  const links = [];
  const hosts = ['apps.apple.com.attacker.test','attacker.test','apple.com','apps-apple.com'];
  const products = ['id284882215','id2848822150','id0284882215','id123456'];
  for (const host of hosts) for (const product of products) {
    links.push(link(`https://${host}/app/${product}`));
    links.push(link(`https://apps.apple.com@${host}/app/${product}`));
  }
  for (const role of ['article','form','dialog','alertdialog']) for (const value of [role,`${role} region`,`unknown ${role}`,`button ${role}`]) {
    links.push(link('fb://feed','Open in app',{role:value}));
  }
  await setup(links);
  assert.ok(links.every(item => display(item) === ''));
});

test('a large ordinary-link page and a mutation burst remain bounded and reversible', async () => {
  const ordinary = Array.from({length:10000},(_,i) => link(`/groups/123/posts/${i}`,'Open app'));
  const promotion = link('fb://feed','Open app');
  const h = await setup([...ordinary,promotion]);
  const initialScans = h.metrics.scans;
  for (let i=0;i<1000;i++) h.mutate();
  assert.equal(h.metrics.timers,1,'a burst schedules one scan');
  h.flush();
  assert.equal(h.metrics.scans,initialScans+1);
  assert.ok(ordinary.every(item => display(item) === ''));
  assert.equal(display(promotion),'none');
  h.configure(false);
  assert.equal(display(promotion),'');
});

test('a rejected settings read leaves the page intact and a later valid change can recover', async () => {
  const item = link('fb://feed');
  const h = await setup([item],true,async () => {throw new Error('injected storage failure');});
  assert.equal(display(item),'');
  assert.equal(h.observer.active,false);
  h.mutate(); h.flush();
  assert.equal(display(item),'');
  h.configure(true);
  assert.equal(display(item),'none');
  h.configure(false);
  assert.equal(display(item),'');
});
