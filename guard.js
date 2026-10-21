(() => {
  let enabled = true;
  let away = document.hidden;
  let until = 0;
  let position = 0;
  let frame = 0;
  let recovered = false;
  const count = kind => document.dispatchEvent(new CustomEvent('facefix-count', {detail: kind}));
  function suppress(event) {
    event.stopImmediatePropagation();
    count('returnEvents');
  }
  const now = () => performance.now();
  const guarding = () => enabled && (away || now() < until);
  const home = url => url.origin === location.origin &&
    (url.pathname === '/' || url.pathname === '/home.php');
  const shouldBlock = (url, reload = false) => guarding() &&
    (reload || (home(url) && url.href !== location.href));

  document.addEventListener('facefix-settings', event => {
    if (typeof event.detail === 'boolean') enabled = event.detail;
  });
  // The isolated settings script also answers this to avoid injection-order races.
  document.dispatchEvent(new Event('facefix-ready'));

  function restore() {
    if (!enabled || away || now() >= until) return;
    // ponytail: only the document scroller; nested panels need site-specific support.
    if (position > 150 && scrollY < position - 150) {
      window.scrollTo(0, position);
      if (!recovered && scrollY >= position - 150) {
        recovered = true;
        count('scrollRecoveries');
      }
    }
    frame = requestAnimationFrame(restore);
  }
  function returned() {
    if (!away) return;
    away = false;
    until = now() + 4000;
    recovered = false;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restore);
  }
  document.addEventListener('scroll', () => {
    if (!guarding()) position = scrollY;
  }, {capture: true, passive: true});
  // Window capture also precedes Facebook listeners attached to Window itself.
  window.addEventListener('visibilitychange', event => {
    if (document.hidden) {
      position = scrollY;
      away = true;
      return;
    }
    returned();
    if (enabled && now() < until) suppress(event);
  }, true);
  window.addEventListener('focus', event => {
    // Element focus remains untouched (forms, dialogs, accessibility).
    if (event.target !== window) return;
    returned();
    if (enabled && now() < until) suppress(event);
  }, true);
  window.addEventListener('pageshow', event => {
    if (event.persisted) returned();
    if (event.persisted && enabled && now() < until) suppress(event);
  }, true);
  function userInput(event) {
    if (!event.isTrusted) return;
    until = 0;
    away = false;
    cancelAnimationFrame(frame);
  }
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'click']) {
    window.addEventListener(type, userInput, {capture: true, passive: true});
  }
  window.navigation?.addEventListener('navigate', event => {
    if (event.userInitiated || event.navigationType === 'traverse' || !event.cancelable) return;
    if (shouldBlock(new URL(event.destination.url), event.navigationType === 'reload')) {
      event.preventDefault();
      count(event.navigationType === 'reload' ? 'reloads' : 'homeRedirects');
    }
  });
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (state, unused, url) {
      // Let the native API validate absent/invalid/cross-origin URLs.
      if (url != null) {
        let target;
        try { target = new URL(url, location.href); } catch {}
        if (target && shouldBlock(target)) {
          count('homeRedirects');
          return;
        }
      }
      return Reflect.apply(original, this, arguments);
    };
  }
})();
