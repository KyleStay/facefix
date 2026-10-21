(() => {
  let enabled = true;
  const publish = () => document.dispatchEvent(new CustomEvent('facefix-settings', {detail: enabled}));
  document.addEventListener('facefix-ready', publish);
  const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
  document.addEventListener('facefix-count', event => {
    if (enabled && kinds.includes(event.detail)) {
      // No URLs, post contents, or timestamps cross this bridge.
      chrome.runtime.sendMessage({type: 'facefix-count', kind: event.detail}).catch(() => {});
    }
  });
  chrome.storage.local.get({enabled: true}).then(value => {
    enabled = value.enabled;
    publish();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      publish();
    }
  });
})();
