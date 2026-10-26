(() => {
  if (!chrome.runtime.getManifest().declarative_net_request) return;
  const config = FacefixMessenger;
  const section = document.querySelector('#messenger');
  const status = document.querySelector('#messenger-status');
  const open = document.querySelector('#open-messages');
  section.hidden = false;
  const activeTab = async () => (await chrome.tabs.query({active: true, currentWindow: true}))[0];
  async function reconcile() {
    const result = await chrome.runtime.sendMessage({type: 'facefix-messenger-status'});
    if (!result?.ok) throw Error(result?.message || 'Could not check desktop messaging. Reopen Facefix.');
    open.disabled = !result.enabled;
    status.textContent = result.enabled ? '' : 'Enable Facefix to use desktop messaging.';
    return result;
  }
  const report = error => { open.disabled = true; status.textContent = error.message || 'Safari could not complete this action.'; };
  reconcile().catch(report);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) reconcile().catch(report);
  });
  open.addEventListener('click', async () => {
    try {
      if (!(await reconcile()).enabled) return;
      const tab = await activeTab();
      if (tab?.id !== undefined && config.isSupportedURL(tab.url)) await chrome.tabs.update(tab.id, {url: config.home});
      else await chrome.tabs.create({url: config.home});
      window.close();
    } catch (error) { report(error); }
  });
  document.querySelector('#reload-messages').addEventListener('click', async () => {
    try {
      await reconcile();
      const tab = await activeTab();
      if (tab?.id !== undefined && config.isSupportedURL(tab.url)) { await chrome.tabs.reload(tab.id); window.close(); }
      else status.textContent = 'Open a Facebook or Messenger tab first.';
    } catch (error) { report(error); }
  });
  document.querySelector('#check-messages').addEventListener('click', async () => {
    try {
      const tab = await activeTab();
      if (tab?.id === undefined || !config.isSupportedURL(tab.url)) {
        status.textContent = 'Open a Facebook or Messenger tab first.'; return;
      }
      const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN',
        func: () => ({platform: navigator.platform, userAgent: navigator.userAgent})});
      status.textContent = result?.result?.platform === 'MacIntel' && !/iPhone|iPad/.test(result.result.userAgent)
        ? 'Desktop identity is active on this page.' : 'This page has a native browser identity. Open Messages, or reload the message tab.';
    } catch { status.textContent = 'Safari could not check this page. Allow website access, then reload.'; }
  });
})();
