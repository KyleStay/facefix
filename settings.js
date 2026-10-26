(() => {
  let enabled = true;
  let diagnosticsEnabled = true;
  let enabledRevision = 0;
  let diagnosticsRevision = 0;
  let readRevision = 0;
  function readStatus() {
    let snapshot = null;
    const receive = event => { try { snapshot = JSON.parse(event.detail); } catch {} };
    document.addEventListener('facefix-status', receive);
    document.dispatchEvent(new Event('facefix-status-request'));
    document.removeEventListener('facefix-status', receive);
    return snapshot;
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id === chrome.runtime.id && message?.type === 'facefix-status') reply({bridge:true,bridgeVersion:chrome.runtime.getManifest().version,guard:readStatus()});
  });
  const publish = () => document.dispatchEvent(new CustomEvent('facefix-settings', {detail: enabled}));
  const publishDiagnostics = () => document.dispatchEvent(new CustomEvent('facefix-diagnostics-settings', {detail: diagnosticsEnabled}));
  document.addEventListener('facefix-ready', () => { publish(); publishDiagnostics(); });
  document.addEventListener('facefix-diagnostic', event => {
    if (!diagnosticsEnabled) return;
    try {
      const item = JSON.parse(event.detail);
      chrome.runtime.sendMessage({type:'facefix-diagnostic-events',events:[item]}).catch(() => {});
    } catch {}
  });
  const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
  document.addEventListener('facefix-count', event => {
    if (enabled && kinds.includes(event.detail)) {
      // No URLs, post contents, or timestamps cross this bridge.
      chrome.runtime.sendMessage({type: 'facefix-count', kind: event.detail}).catch(() => {});
    }
  });
  function readSettings() {
    const currentRead = ++readRevision;
    const currentEnabled = enabledRevision;
    const currentDiagnostics = diagnosticsRevision;
    return chrome.storage.local.get({enabled: true, diagnosticsEnabled: true}).then(value => {
      if (currentRead !== readRevision) return;
      if (currentEnabled === enabledRevision) enabled = value.enabled !== false;
      if (currentDiagnostics === diagnosticsRevision) diagnosticsEnabled = value.diagnosticsEnabled !== false;
      publish();
      publishDiagnostics();
      if (diagnosticsEnabled) chrome.runtime.sendMessage({type:'facefix-diagnostic-events',events:[{
        kind:'load',details:{pageLoadType:performance.getEntriesByType('navigation')[0]?.type || 'unknown',
          wasDiscarded:document.wasDiscarded === true,navigationAPI:typeof window.navigation === 'object',
          layoutShiftAPI:typeof PerformanceObserver === 'function'}
      }]}).catch(() => {});
    }).catch(() => {});
  }
  readSettings();
  document.addEventListener('facefix-pageshow', readSettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
      enabledRevision++;
      enabled = changes.enabled.newValue !== false;
      publish();
    }
    if (area === 'local' && changes.diagnosticsEnabled) {
      diagnosticsRevision++;
      diagnosticsEnabled = changes.diagnosticsEnabled.newValue !== false;
      publishDiagnostics();
    }
  });
})();
