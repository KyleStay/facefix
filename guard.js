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
  let timerReason = 'waiting';
  let diagnosticsEnabled = true;
  let anchorMissing = false;
  let lastInputAt = -Infinity;
  let lastRecoveryAt = -Infinity;
  let lastScrollY = scrollY;
  let lastFailedRecovery = -Infinity;
  const trace = (kind, details = {}) => {
    if (diagnosticsEnabled) document.dispatchEvent(new CustomEvent('facefix-diagnostic', {detail: JSON.stringify({kind, details})}));
  };
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

  document.addEventListener('facefix-status-request', () => {
    const navigationMs = enabled && !away ? Math.max(0, until - now()) : 0;
    const recoveryMs = enabled && !away ? Math.max(0, recoveryUntil - now()) : 0;
    document.dispatchEvent(new CustomEvent('facefix-status', {detail: JSON.stringify({
      schema: 1, guardVersion:'1.4.0', enabled, away, navigationMs, recoveryMs,
      wasDiscarded:document.wasDiscarded === true,
      pageLoadType:performance.getEntriesByType?.('navigation')?.[0]?.type || 'unknown',
      navigationAPI:typeof window.navigation === 'object',
      reason: timerReason === 'running' && recoveryMs === 0 && !away ? 'finished' : timerReason,
      postMatched: Boolean(anchor?.node?.isConnected)
    })}));
  });

  document.addEventListener('facefix-settings', event => {
    if (typeof event.detail === 'boolean') {
      enabled = event.detail;
      if (!enabled) anchor = null;
      if (!enabled) trace('guard-ended', {reason:'disabled'});
    }
  });
  document.addEventListener('facefix-diagnostics-settings', event => {
    if (typeof event.detail === 'boolean') diagnosticsEnabled = event.detail;
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
  function leaving(reason) {
    if (!away) {
      position = scrollY;
      const candidates = enabled ? articles() : [];
      const node = candidates.find(article => {
        const rect = article.getBoundingClientRect();
        return rect.bottom > 120 && rect.top < innerHeight - 80 && rect.height > 80 &&
          rect.right > 0 && rect.left < innerWidth;
      });
      anchor = node ? {node, top: node.getBoundingClientRect().top, key: postKey(node)} : null;
      anchorMissing = false;
      lastScrollY = scrollY;
      trace('left', {reason});
      trace('anchor-captured', {mode:anchor?.key ? 'post' : anchor ? 'element' : 'pixel', candidates:candidates.length});
    }
    away = true;
  }
  function moveTo(target) {
    const deltaPx = target - scrollY;
    lastRecoveryAt = now();
    window.scrollTo(0, target);
    const success = Math.abs(scrollY - target) < 8;
    if ((!recovered && success) || (!success && now()-lastFailedRecovery > 1000)) {
      trace('recovery-attempt', {success,deltaPx,mode:anchor?.key ? 'post' : anchor ? 'element' : 'pixel'});
      if (!success) lastFailedRecovery = now();
    }
    if (!recovered && success) {
      recovered = true;
      count('scrollRecoveries');
    }
  }
  function restore() {
    if (!enabled || now() >= recoveryUntil) {
      if (timerReason === 'running') { trace('guard-ended',{reason:enabled ? 'expired' : 'disabled'}); timerReason = 'finished'; }
      anchor = null; return;
    }
    if (away) return;
    // Retain only a visible post link in memory; never store its text or URL.
    if (anchor?.key && now() >= nextLookup) {
      nextLookup = now() + 250;
      if (!anchor.node?.isConnected || postKey(anchor.node) !== anchor.key) {
        anchor.node = articles().find(article => postKey(article) === anchor.key) || null;
        if (!anchor.node && !anchorMissing) trace('anchor-missing');
        if (anchor.node && anchorMissing) trace('anchor-reacquired');
        anchorMissing = !anchor.node;
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
  function returned(reason) {
    if (!away) return;
    away = false;
    until = now() + 4000;
    recoveryUntil = now() + 15000;
    nextLookup = 0;
    recovered = false;
    timerReason = 'running';
    trace('returned',{reason,navigationMs:4000,recoveryMs:15000,postMatched:Boolean(anchor?.node?.isConnected)});
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restore);
  }
  document.addEventListener('scroll', () => {
    const deltaPx = scrollY-lastScrollY;
    if (Math.abs(deltaPx) >= 250 && now()-lastInputAt > 1000 && now()-lastRecoveryAt > 200) {
      trace('scroll-jump',{deltaPx,navigationActive:guarding(),recoveryActive:enabled && !away && now()<recoveryUntil,
        navigationMs:Math.max(0,until-now()),recoveryMs:Math.max(0,recoveryUntil-now())});
    }
    lastScrollY = scrollY;
    if (!away && now() >= recoveryUntil) position = scrollY;
  }, {capture: true, passive: true});
  // Window capture also precedes Facebook listeners attached to Window itself.
  window.addEventListener('visibilitychange', event => {
    if (document.hidden) {
      leaving('visibility');
      if (enabled) suppress(event, false);
      return;
    }
    returned('visibility');
    if (enabled && now() < until) suppress(event);
  }, true);
  window.addEventListener('blur', event => {
    if (event.target !== window) return;
    leaving('blur');
    if (enabled) suppress(event, false);
  }, true);
  window.addEventListener('focus', event => {
    // Element focus remains untouched (forms, dialogs, accessibility).
    if (event.target !== window) return;
    returned('focus');
    if (enabled && now() < until) suppress(event);
  }, true);
  window.addEventListener('pageshow', event => {
    if (event.persisted) returned('pageshow');
    if (event.persisted && enabled && now() < until) suppress(event);
  }, true);
  function userInput(event) {
    if (!event.isTrusted) return;
    lastInputAt = now();
    if (guarding() || now() < recoveryUntil) { timerReason = 'interaction'; trace('guard-ended',{reason:'input',input:event.type,navigationMs:Math.max(0,until-now()),recoveryMs:Math.max(0,recoveryUntil-now())}); }
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
      trace('navigation-blocked',{method:event.navigationType === 'reload' ? 'reload' : 'navigate'});
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
          trace('navigation-blocked',{method});
          count('homeRedirects');
          return;
        }
      }
      return Reflect.apply(original, this, arguments);
    };
  }
  if (typeof PerformanceObserver === 'function') {
    let lastShift = -Infinity;
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.value >= 0.1 && now()-lastShift >= 1000) {
            lastShift = now(); trace('layout-shift',{shiftScore:entry.value});
          }
        }
      }).observe({type:'layout-shift',buffered:false});
    } catch {}
  }
})();
