// MAIN world, at document_start. Keep native touch, storage, media and passkeys.
(() => {
  const config = FacefixMessenger;
  const values = {userAgent: config.userAgent, appVersion: config.userAgent.replace(/^Mozilla\//, ''), platform: 'MacIntel'};
  const originals = new Map(Object.keys(values).map(key => [key, {
    descriptor: Object.getOwnPropertyDescriptor(navigator, key), value: navigator[key]
  }]));
  const getters = new Map(Object.entries(values).map(([key, value]) => [key,
    () => config.isIdentityPage(location.href) ? value : originals.get(key).value]));
  function configure(enabled) {
    for (const [key, getter] of getters) {
      try {
        if (enabled) Object.defineProperty(navigator, key, {get: getter, configurable: true});
        else if (Object.getOwnPropertyDescriptor(navigator, key)?.get === getter) {
          const original = originals.get(key).descriptor;
          if (original) Object.defineProperty(navigator, key, original);
          else delete navigator[key];
        }
      } catch { /* Locked native properties must not prevent the site loading. */ }
    }
  }
  document.addEventListener('facefix-settings', event => {
    if (typeof event.detail === 'boolean') configure(event.detail);
  });
  configure(true);
})();
