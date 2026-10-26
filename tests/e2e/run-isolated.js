// Real extension + DOM verification in the skill's disposable Chrome for Testing.
// Facebook-origin requests are fulfilled with our fixture; no account is used.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const runner = process.env.CHROME_EXTENSION_RUNNER || path.join(os.homedir(), '.codex/skills/chrome-extension-test-runner/scripts/launch_test_chrome.py');
const resultDir = path.join(root, 'artifacts', 'browser-qa');

async function command(args) {
  const child = spawn(args[0], args.slice(1), {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => {stdout += bytes;});
  child.stderr.on('data', bytes => {stderr += bytes;});
  const [code] = await once(child, 'exit');
  if (code !== 0) throw Error(`${args[0]} exited ${code}: ${stderr}\n${stdout}`);
  return stdout;
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.next = 1; this.pending = new Map(); this.handlers = new Map();
    socket.addEventListener('message', event => {
      const item = JSON.parse(event.data);
      if (item.id) {
        const request = this.pending.get(item.id); if (!request) return;
        this.pending.delete(item.id); clearTimeout(request.timer);
        if (item.error) request.reject(Error(item.error.message)); else request.resolve(item.result);
      } else this.handlers.get(item.method)?.forEach(fn => fn(item.params, item.sessionId));
    });
  }
  static async connect(url) { const socket = new WebSocket(url); await once(socket, 'open'); return new CDP(socket); }
  on(name, callback) { if (!this.handlers.has(name)) this.handlers.set(name, []); this.handlers.get(name).push(callback); }
  send(method, params = {}, sessionId) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(Error(`CDP timeout: ${method}`));}, 15000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
    });
  }
  async evaluate(session, expression) {
    const response = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, session);
    if (response.exceptionDetails) throw Error(response.exceptionDetails.text + ': ' + response.exceptionDetails.exception?.description);
    return response.result.value;
  }
}
let browser, launch, finished = false;
async function cleanup() {
  if (finished) return;
  finished = true;
  if (browser) {
    try { await browser.send('Browser.close'); } catch {}
    browser.socket.close();
  }
  if (launch) {
    // The skill helper verifies birth identities, quiescence, and descendants
    // before removing this exact profile. CDP is always the first shutdown path.
    const helper = path.join(path.dirname(runner), 'test_chrome_owner.py');
    const code = "import importlib.util,json,sys; p=sys.argv[1]; s=importlib.util.spec_from_file_location('owner',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); state=json.load(open(sys.argv[2])); ok=m.cleanup(state); print(json.dumps({'cleanup':ok})); sys.exit(0 if ok else 1)";
    const result = JSON.parse(await command(['python3', '-c', code, helper, path.join(launch.profile_dir, '.test-chrome-owner.json')]));
    assert.equal(result.cleanup, true);
    await assert.rejects(fs.stat(launch.profile_dir), {code:'ENOENT'});
  }
}
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => cleanup().finally(() => process.exit(1)));

async function run() {
  await fs.mkdir(resultDir, {recursive: true});
  await command(['python3', 'build.py', '--mode', 'safari']);
  const extension = await fs.mkdtemp(path.join(os.tmpdir(), 'facefix-browser-input-'));
  const results = [];
  const runtimeErrors = [];
  let popup;
  let failure;
  try {
    const version = JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8')).version;
    await command(['python3', '-m', 'zipfile', '-e', `dist/facefix-${version}-safari.zip`, extension]);
    launch = JSON.parse(await command(['python3', runner, '--extension', extension, '--owner-pid', String(process.pid), '--url', 'about:blank', '--headless']));
    assert.equal(launch.debugger_ready, true); assert.equal(launch.extension_loaded, true);
    const endpoint = await (await fetch(`http://127.0.0.1:${launch.debug_port}/json/version`)).json();
    browser = await CDP.connect(endpoint.webSocketDebuggerUrl);
    browser.on('Runtime.exceptionThrown', value => runtimeErrors.push(value.exceptionDetails.exception?.description || value.exceptionDetails.text));
    const attach = async targetId => (await browser.send('Target.attachToTarget', {targetId, flatten: true})).sessionId;
    const popupId = (await browser.send('Target.createTarget', {url:`chrome-extension://${launch.extension_id}/popup.html`})).targetId;
    popup = await attach(popupId);
    const wait = async (session, expression) => {
      const deadline = Date.now()+10000;
      while (Date.now()<deadline) {
        if (await browser.evaluate(session, expression)) return;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw Error('Timed out: ' + expression);
    };
    await wait(popup, 'document.querySelector("#open-messages")?.disabled === false');
    results.push('Safari package worker and persistent MAIN registration initialize');
    const pageId = (await browser.send('Target.createTarget', {url:'about:blank'})).targetId;
    const page = await attach(pageId);
    await browser.send('Runtime.enable', {}, page);
    await browser.send('Page.enable', {}, page);
    await browser.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844}, page);
    await browser.send('Emulation.setUserAgentOverride', {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',platform:'iPhone'}, page);
    const fixture = await fs.readFile(path.join(root,'tests/promotion-messenger-fixture.html'),'utf8');
    const pausedErrors = [];
    browser.on('Fetch.requestPaused', (request, session) => {
      if (session !== page) return;
      browser.send('Fetch.fulfillRequest', {requestId:request.requestId,responseCode:200,responseHeaders:[
        {name:'Content-Type',value:'text/html; charset=utf-8'},
        {name:'Content-Security-Policy',value:"default-src 'self'; style-src 'unsafe-inline'"}
      ],body:Buffer.from(fixture).toString('base64')}, page).catch(error=>pausedErrors.push(error.message));
    });
    await browser.send('Fetch.enable', {patterns:[{urlPattern:'https://*.facebook.com/*',resourceType:'Document'}, {urlPattern:'https://*.messenger.com/*',resourceType:'Document'}, {urlPattern:'https://messenger.com/*',resourceType:'Document'}]}, page);
    await browser.send('Page.navigate', {url:'https://www.facebook.com/messages/t/fixture'}, page);
    await wait(page, 'document.querySelector("#promotion-shell") && getComputedStyle(document.querySelector("#promotion-shell")).display === "none" && document.querySelector("[data-facefix-thread]")');
    const status = await browser.evaluate(page, `({width:innerWidth,thread:document.querySelector('#thread').getBoundingClientRect().width,
      barHeight:document.querySelector('#promotion-shell').getBoundingClientRect().height,
      platform:navigator.platform,ua:navigator.userAgent,
      post:getComputedStyle(document.querySelector('#post-link')).display,form:getComputedStyle(document.querySelector('#form-link')).display,
      home:getComputedStyle(document.querySelector('#home')).display, draft:document.querySelector('#composer').textContent,
      href:location.href, ownPlatform:!!Object.getOwnPropertyDescriptor(navigator,'platform')?.get,
      mainConfig:typeof FacefixMessenger, identityPage:typeof FacefixMessenger==='undefined'?null:FacefixMessenger.isIdentityPage(location.href)})`);
    await fs.writeFile(path.join(resultDir,'page-status.json'),JSON.stringify(status,null,2)+'\n');
    await fs.writeFile(path.join(resultDir,'registered-scripts.json'),JSON.stringify(await browser.evaluate(popup,'chrome.scripting.getRegisteredContentScripts()'),null,2)+'\n');
    assert.equal(status.platform,'MacIntel'); assert.ok(!status.ua.includes('iPhone'));
    assert.equal(status.width,390); assert.ok(status.thread<=391); assert.equal(status.barHeight,0);
    assert.notEqual(status.post,'none'); assert.notEqual(status.form,'none'); assert.notEqual(status.home,'none');
    assert.notEqual(await browser.evaluate(page,'getComputedStyle(document.querySelector("#editable-link")).display'),'none');
    assert.equal(status.draft,'Draft preserved');
    results.push('390px layout, desktop identity, entire pinned app bar removal, protected links and composer preserved');
    await browser.send('Page.captureScreenshot', {format:'png'}, page).then(value=>fs.writeFile(path.join(resultDir,'phone-layout.png'),Buffer.from(value.data,'base64')));

    await browser.evaluate(page, `const draft=document.querySelector('#composer').firstChild;const range=document.createRange();range.setStart(draft,2);range.setEnd(draft,5);getSelection().removeAllRanges();getSelection().addRange(range);`);
    await browser.evaluate(popup, 'chrome.storage.local.set({enabled:false})');
    await wait(page, '!document.documentElement.classList.contains("facefix-messenger") && getComputedStyle(document.querySelector("#promotion-shell")).display !== "none" && navigator.platform === "iPhone"');
    assert.equal(await browser.evaluate(page, 'document.querySelector("meta[name=viewport]").content'),'width=980');
    assert.equal(await browser.evaluate(page, 'document.querySelector("#composer").textContent'),'Draft preserved');
    assert.deepEqual(await browser.evaluate(page,'[getSelection().anchorOffset,getSelection().focusOffset,getSelection().toString()]'),[2,5,'aft']);
    await browser.evaluate(popup, 'chrome.storage.local.set({enabled:true})');
    await wait(page, 'document.querySelector("[data-facefix-thread]") && getComputedStyle(document.querySelector("#promotion-shell")).display === "none" && navigator.platform === "MacIntel"');
    results.push('Live pause restores viewport, app bar and native identity; resume reapplies without losing draft');

    await browser.evaluate(page, 'history.pushState({}, "", "/groups/fixture")');
    await wait(page, '!document.documentElement.classList.contains("facefix-messenger") && navigator.platform === "iPhone"');
    await browser.evaluate(page, 'history.pushState({}, "", "/messages/e2ee/t/fixture")');
    await wait(page, 'document.querySelector("[data-facefix-thread]")');
    await browser.evaluate(page, 'document.querySelector("#credential").type="password"');
    await wait(page, '!document.documentElement.classList.contains("facefix-messenger")');
    await browser.evaluate(page, 'document.querySelector("#credential").type="text"');
    await wait(page, 'document.querySelector("[data-facefix-thread]")');
    results.push('SPA enter/leave, encrypted thread routes and password-form transitions restore safely');

    await browser.evaluate(page, `document.querySelector('#promotion').insertAdjacentHTML('beforeend','<a id="extra-home" href="/">Home</a>')`);
    await wait(page, 'getComputedStyle(document.querySelector("#promotion-shell")).display !== "none"');
    assert.notEqual(await browser.evaluate(page,'getComputedStyle(document.querySelector("#extra-home")).display'),'none');
    await browser.evaluate(page,'document.querySelector("#extra-home").remove()');
    await wait(page,'getComputedStyle(document.querySelector("#promotion-shell")).display === "none"');
    await browser.evaluate(page,'document.querySelector("#promotion").setAttribute("contenteditable","true")');
    await wait(page,'getComputedStyle(document.querySelector("#promotion-shell")).display !== "none"');
    await browser.evaluate(page,'document.querySelector("#promotion").removeAttribute("contenteditable")');
    await wait(page,'getComputedStyle(document.querySelector("#promotion-shell")).display === "none"');
    results.push('Recycled promotion wrappers restore for real navigation and attribute-only editable transitions');

    await browser.evaluate(page, `window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));`);
    await wait(page,'document.querySelector("[data-facefix-thread]")');
    await browser.evaluate(page, `const bar=document.createElement('div');bar.id='second-promotion';bar.style.cssText='position:fixed;bottom:0;width:100%;height:60px';bar.innerHTML='<a href="fb-messenger://share">Open Messenger app</a>';document.body.append(bar)`);
    await wait(page,'getComputedStyle(document.querySelector("#second-promotion")).display === "none"');
    results.push('Forwarded BFCache lifecycle reconnects observers despite the main page guard');

    await browser.send('Emulation.setDeviceMetricsOverride', {width:980,height:844,deviceScaleFactor:1,mobile:false,screenWidth:980,screenHeight:844}, page);
    await wait(page,'!document.documentElement.classList.contains("facefix-messenger")');
    assert.notEqual(await browser.evaluate(page,'getComputedStyle(document.querySelector("#sidebar")).display'),'none');
    results.push('Wide layouts keep their sidebar and original viewport');
    await browser.send('Page.navigate', {url:'https://www.messenger.com/e2ee/t/123?ref=fixture'}, page);
    await wait(page, 'location.href === "https://www.facebook.com/messages/e2ee/t/123?ref=fixture"');
    results.push('Actual declarative redirect preserves encrypted-thread IDs and query parameters');
    assert.deepEqual(pausedErrors, []);
    assert.deepEqual(runtimeErrors, []);
  } catch (error) {
    failure = error;
    if (browser && popup) {
      try {
        const diagnostic = await browser.evaluate(popup, '({url:location.href,ready:document.readyState,text:document.body.innerText})');
        await fs.writeFile(path.join(resultDir,'failure.json'),JSON.stringify(diagnostic,null,2)+'\n');
        const shot=await browser.send('Page.captureScreenshot',{format:'png'},popup);
        await fs.writeFile(path.join(resultDir,'failure.png'),Buffer.from(shot.data,'base64'));
      } catch {}
    }
  }
  finally {
    try { await cleanup(); }
    catch (error) { failure = failure || error; }
    // Input is task-owned package staging, removed only after Chrome cleanup.
    if (finished && (!launch || !await fs.stat(launch.profile_dir).catch(()=>null))) await fs.rm(extension,{recursive:true,force:true});
    const report={passed:!failure,checks:results,runtimeErrors,cleanup:{browserPIDs:0,profileDirectories:launch && await fs.stat(launch.profile_dir).catch(()=>null)?1:0},error:failure?.message || null};
    if(report.cleanup.profileDirectories)report.cleanup.browserPIDs='unverified';
    await fs.writeFile(path.join(resultDir,'result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }
  if(failure)throw failure;
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
