const matches = url => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'facebook.com' || parsed.hostname.endsWith('.facebook.com'));
  } catch { return false; }
};
async function protect(tab) {
  if (!tab.id || !matches(tab.url)) return;
  const {enabled = true} = await chrome.storage.local.get('enabled');
  await chrome.tabs.update(tab.id, {autoDiscardable: enabled ? false : true}).catch(() => {});
}
async function refresh() {
  const tabs = await chrome.tabs.query({url: ['https://*.facebook.com/*', 'https://facebook.com/*']});
  await Promise.all(tabs.map(protect));
}
chrome.tabs.onUpdated.addListener((id, changes, tab) => {
  if (changes.status === 'loading' || changes.url) void protect(tab);
});
chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) void refresh();
});

const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
let counterQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !message) return;
  const increment = message.type === 'facefix-count' && sender.tab &&
    matches(sender.url) && kinds.includes(message.kind);
  const reset = message.type === 'facefix-reset' && !sender.tab &&
    sender.url === chrome.runtime.getURL('popup.html');
  if (!increment && !reset) return;
  // One writer serializes updates from every tab, including resets.
  counterQueue = counterQueue.then(async () => {
    const {counters = {}, enabled = true} = await chrome.storage.local.get(['counters', 'enabled']);
    if (increment && !enabled) return;
    const next = Object.fromEntries(kinds.map(kind => [kind,
      reset ? 0 : (Number.isSafeInteger(counters[kind]) && counters[kind] >= 0 ? counters[kind] : 0)
    ]));
    if (increment) next[message.kind] = Math.min(Number.MAX_SAFE_INTEGER, next[message.kind] + 1);
    await chrome.storage.local.set({counters: next});
  });
  counterQueue.then(() => reply({ok: true}), () => reply({ok: false}));
  counterQueue = counterQueue.catch(() => {});
  return true;
});
