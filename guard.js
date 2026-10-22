(() => {
  let enabled = true;
  let away = document.hidden;
  let until = 0;
  let recoveryUntil = 0;
  let position = 0;
  let frame = 0;
  let recovered = false;
  let anchor = null;
  let nextLookup = 0;
  const count = kind => document.dispatchEvent(new CustomEvent('facefix-count', {detail: kind}));
  function suppress(event, returning = true) {
    event.stopImmediatePropagation();
    if (returning) count('returnEvents');
  }
  const now = () => performance.now();
  const guarding = () => enabled && (away || now() < until);
  const home = url => url.origin === location.origin &&
    (url.pathname === '/' || url.pathname === '/home.php');
  const shouldBlock = (url, reload = false) => guarding() &&
    (reload || (home(url) && url.href !== location.href));

  document.addEventListener('facefix-settings', event => {
    if (typeof event.detail === 'boolean') {
      enabled = event.detail;
      if (!enabled) anchor = null;
    }
  });
  // The isolated settings script also answers this to avoid injection-order races.
  document.dispatchEvent(new Event('facefix-ready'));

  const articles = () => [...document.querySelectorAll(
    '[role="main"] [role="article"], [role="feed"] [role="article"], [role="main"] article, [data-pagelet^="FeedUnit_"]'
  )];
  function postKey(article) {
    for (const link of article.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch { continue; }
      if (url.origin !== location.origin) continue;
      if (!/\/(posts|permalink)\/|\/(story|permalink)\.php$/.test(url.pathname) &&
          !url.searchParams.has('story_fbid') && !url.searchParams.has('multi_permalinks')) continue;
      const identity = new URLSearchParams();
      for (const key of ['story_fbid', 'id', 'multi_permalinks', 'fbid']) {
        if (url.searchParams.has(key)) identity.set(key, url.searchParams.get(key));
      }
      return url.pathname.replace(/\/$/, '') + '?' + identity;
    }
    return null;
  }
  function leaving() {
    if (!away) {
      position = scrollY;
      const node = enabled && articles().find(article => {
        const rect = article.getBoundingClientRect();
        return rect.bottom > 120 && rect.top < innerHeight - 80 && rect.height > 80 &&
          rect.right > 0 && rect.left < innerWidth;
      });
      anchor = node ? {node, top: node.getBoundingClientRect().top, key: postKey(node)} : null;
    }
    away = true;
  }
  function moveTo(target) {
    window.scrollTo(0, target);
    if (!recovered && Math.abs(scrollY - target) < 8) {
      recovered = true;
      count('scrollRecoveries');
    }
  }
  function restore() {
    if (!enabled || now() >= recoveryUntil) { anchor = null; return; }
    if (away) return;
    // Retain only a visible post link in memory; never store its text or URL.
    if (anchor?.key && now() >= nextLookup) {
      nextLookup = now() + 250;
      if (!anchor.node?.isConnected || postKey(anchor.node) !== anchor.key) {
        anchor.node = articles().find(article => postKey(article) === anchor.key) || null;
      }
    }
    if (anchor?.node?.isConnected) {
      const shift = anchor.node.getBoundingClientRect().top - anchor.top;
      if (Math.abs(shift) > 8 && scrollY + shift >= 0) moveTo(scrollY + shift);
    }
    // ponytail: only the document scroller; nested panels need site-specific support.
    else if (position > 150 && scrollY < position - 150) {
      moveTo(position);
    }
    frame = requestAnimationFrame(restore);
  }
  function returned() {
    if (!away) return;
    away = false;
    until = now() + 4000;
    recoveryUntil = now() + 15000;
    nextLookup = 0;
    recovered = false;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restore);
  }
  document.addEventListener('scroll', () => {
    if (!away && now() >= recoveryUntil) position = scrollY;
  }, {capture: true, passive: true});
  // Window capture also precedes Facebook listeners attached to Window itself.
  window.addEventListener('visibilitychange', event => {
    if (document.hidden) {
      leaving();
      if (enabled) suppress(event, false);
      return;
    }
    returned();
    if (enabled && now() < until) suppress(event);
  }, true);
  window.addEventListener('blur', event => {
    if (event.target !== window) return;
    leaving();
    if (enabled) suppress(event, false);
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
    recoveryUntil = 0;
    anchor = null;
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
