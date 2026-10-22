const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}
function setup() {
  const listeners = {};
  const on = target => (name, fn) => (listeners[target + name] ??= []).push(fn);
  let time = 0;
  const calls = [];
  const counts = [];
  const context = {
    URL, URLSearchParams, Event, CustomEvent, performance: {now: () => time},
    location: new URL('https://www.facebook.com/groups/example/'),
    document: {hidden: false, querySelectorAll: () => [], addEventListener: on('doc'), dispatchEvent(event) { if (event.type === 'facefix-count') counts.push(event.detail); }},
    history: {pushState(...args) { calls.push(args); }, replaceState(...args) { calls.push(args); }},
    innerHeight: 800, innerWidth: 1280, scrollY: 900, requestAnimationFrame: fn => { context.frame = fn; return 1; }, cancelAnimationFrame() {},
    addEventListener: on('win'), navigation: {addEventListener: on('nav')},
    scrollTo(x, y) { context.scrollY = y; }
  };
  context.window = context;
  const sandbox = vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../guard.js'), 'utf8'), sandbox);
  const windowTarget = vm.runInContext('window', sandbox);
  const fire = (name, extra = {}) => {
    const event = {stopImmediatePropagation() { this.stopped = true; }, preventDefault() {this.prevented = true;}, ...extra};
    if (extra.target === context) event.target = windowTarget;
    for (const fn of listeners[name] ?? []) fn(event);
    return event;
  };
  return {context, calls, counts, fire, tick: n => { time += n; }};
}
test('return guard blocks automatic Home/reload, preserves intentional use and expires', () => {
  const {context:c, calls, fire, tick} = setup();
  c.history.pushState({}, '', '/');
  assert.equal(calls.length, 1, 'normal navigation allowed');
  c.document.hidden = true;
  assert.equal(fire('winvisibilitychange').stopped, true, 'hide suppressed');
  c.history.replaceState({}, '', '/');
  assert.equal(calls.length, 1, 'background Home blocked');
  c.document.hidden = false;
  assert.equal(fire('winvisibilitychange').stopped, true);
  c.scrollY = 0;
  c.frame();
  assert.equal(c.scrollY, 900, 'return scroll restored');
  const nav = extra => fire('navnavigate', {cancelable:true, userInitiated:false, navigationType:'replace', destination:{url:'https://www.facebook.com/'}, ...extra});
  assert.equal(nav().prevented, true);
  assert.equal(nav({navigationType:'reload'}).prevented, true);
  assert.equal(nav({navigationType:'traverse'}).prevented, undefined);
  assert.equal(nav({userInitiated:true}).prevented, undefined);
  assert.equal(nav({navigationType:'reload', userInitiated:true}).prevented, undefined);
  assert.equal(nav({cancelable:false}).prevented, undefined);
  assert.equal(nav({destination:{url:'https://www.facebook.com/login/'}}).prevented, undefined);
  assert.equal(nav({destination:{url:'https://example.org/'}}).prevented, undefined);
  fire('winclick', {isTrusted:false});
  assert.equal(nav().prevented, true);
  fire('winwheel', {isTrusted:true});
  assert.equal(nav().prevented, undefined);
  c.document.hidden = true; fire('winvisibilitychange');
  c.document.hidden = false; fire('winvisibilitychange');
  tick(4001);
  assert.equal(nav().prevented, undefined);
});
test('pause disables hooks and element focus is delivered', () => {
  const {context:c, fire, calls} = setup();
  c.document.hidden = true; fire('winvisibilitychange');
  fire('docfacefix-settings', {detail:false});
  c.history.pushState({}, '', '/');
  assert.equal(calls.length, 1);
  c.document.hidden = false;
  assert.equal(fire('winvisibilitychange').stopped, undefined);
  assert.equal(fire('winfocus', {target:{}}).stopped, undefined);
});

test('counters record only interventions and count scroll recovery once per return', () => {
  const {context:c, fire, counts} = setup();
  c.history.pushState({}, '', '/');
  assert.deepEqual(counts, []);
  c.document.hidden = true; fire('winvisibilitychange');
  c.history.pushState({}, '', '/');
  c.history.replaceState({}, '', '/home.php');
  c.document.hidden = false; fire('winvisibilitychange');
  c.scrollY = 0; c.frame();
  c.scrollY = 0; c.frame();
  fire('navnavigate', {cancelable:true, navigationType:'reload', destination:{url:c.location.href}});
  assert.deepEqual(counts, ['homeRedirects', 'homeRedirects', 'returnEvents', 'scrollRecoveries', 'reloads']);
  fire('docfacefix-settings', {detail:false});
  c.history.replaceState({}, '', '/');
  assert.equal(counts.length, 5, 'pause does not increment');
});
test('scroll recovery is not counted if the document cannot restore its position', () => {
  const {context:c, fire, counts} = setup();
  c.document.hidden = true; fire('winvisibilitychange');
  c.document.hidden = false; fire('winvisibilitychange');
  c.scrollTo = () => {};
  c.scrollY = 0; c.frame();
  assert.deepEqual(counts, ['returnEvents']);
});

function post(context, absoluteTop, href) {
  return {
    isConnected:true,
    getBoundingClientRect:() => ({top:absoluteTop - context.scrollY, bottom:absoluteTop - context.scrollY + 500, height:500, left:200, right:900}),
    querySelectorAll:() => [{getAttribute:() => href}]
  };
}
test('leaving signals are suppressed and returning from another window is protected', () => {
  const {context:c, fire} = setup();
  const blur = fire('winblur', {target:c.window});
  assert.equal(blur.stopped, true, 'window blur must not arm Facebook inactivity handlers');
  c.scrollY = 0;
  assert.equal(fire('winfocus', {target:c.window}).stopped, true);
  c.frame();
  assert.equal(c.scrollY, 900);
  assert.equal(fire('winblur', {target:{}}).stopped, undefined, 'element blur is preserved');
  c.document.hidden = true;
  assert.equal(fire('winvisibilitychange').stopped, true, 'hidden event must also be suppressed');
});
test('visible post stays anchored when earlier feed items change height after returning', () => {
  const {context:c, fire, counts, tick} = setup();
  let article = post(c, 1000, '/example/posts/123?tracking=old');
  c.document.querySelectorAll = () => [article];
  c.document.hidden = true; fire('winvisibilitychange');
  c.document.hidden = false; fire('winvisibilitychange');
  article.isConnected = false;
  article = post(c, 1300, '/example/posts/123?tracking=new');
  // The original node was replaced by a new rendering of the same post.
  // Both tracked hrefs normalize to the same post identity.
  tick(10000);
  c.frame();
  assert.equal(c.scrollY, 1200, 'restore the post offset, not just the old pixel coordinate');
  assert.equal(counts.filter(kind => kind === 'scrollRecoveries').length, 1);
});
test('a recycled feed node is matched by post identity instead of reusing the wrong post', () => {
  const {context:c, fire} = setup();
  const original = post(c, 1000, '/example/posts/target/');
  c.document.querySelectorAll = () => [original];
  c.document.hidden = true; fire('winvisibilitychange');
  c.document.hidden = false; fire('winvisibilitychange');
  original.querySelectorAll = () => [{getAttribute:() => '/example/posts/different'}];
  const replacement = post(c, 1350, '/example/posts/target?tracking=new');
  c.document.querySelectorAll = () => [original, replacement];
  c.frame();
  assert.equal(c.scrollY, 1250);
  fire('winwheel', {isTrusted:true});
  c.scrollY = 300;
  c.frame();
  assert.equal(c.scrollY, 300, 'intentional scrolling cancels recovery');
});
