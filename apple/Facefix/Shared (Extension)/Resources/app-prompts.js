// Isolated world: remove dedicated website promotions, preserving content and navigation.
(() => {
  const hidden = new Map();
  let enabled = false;
  let pending = null;
  let active = true;
  let revision = 0;
  const protectedContext = 'article, [role~="article"], [data-pagelet^="FeedUnit_"], form, [role~="form"], dialog, [role~="dialog"], [role~="alertdialog"], nav, [role~="navigation"], [contenteditable], [role~="textbox"]';
  const controls = 'a, button, [role~="button"], input, select, textarea, [contenteditable], iframe, video, audio';
  const label = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const appLabel = node => [label(node.textContent), label(node.getAttribute('aria-label'))].some(value =>
    /^(open(?: in)? (?:the )?(?:(?:facebook|messenger) )?app|use (?:the )?(?:(?:facebook|messenger) )?app|get (?:the )?(?:facebook|messenger) app)$/.test(value));
  const dismissLabel = node => [label(node.textContent), label(node.getAttribute('aria-label'))].some(value => /^(close|dismiss|not now|×)$/.test(value));
  function destination(node) {
    const href = node.getAttribute('href');
    if (!href) return false;
    let url;
    try { url = new URL(href, location.href); } catch { return false; }
    return ['fb:', 'fbapp:', 'fb-messenger:', 'fbmessenger:'].includes(url.protocol) ||
      (['https:', 'itms-apps:'].includes(url.protocol) &&
        ['apps.apple.com', 'itunes.apple.com'].includes(url.hostname) &&
        /\/id(?:284882215|454638411)\/?$/.test(url.pathname));
  }
  function pinned(node) {
    if (!node || typeof getComputedStyle !== 'function') return false;
    if (!['fixed', 'sticky'].includes(getComputedStyle(node).position)) return false;
    // A hidden promotion has no geometry. Its original pin remains valid until
    // position/structure changes; never briefly unhide it just to measure it.
    if ([...hidden.values()].some(record => record.pin === node)) return true;
    const rect = node.getBoundingClientRect();
    const height = innerHeight;
    return rect.height > 0 && rect.height <= Math.min(200, height * .3) &&
      rect.width >= innerWidth * .5 && rect.bottom >= height - 180 && rect.bottom <= height + 120;
  }
  function promotionOnly(node) {
    if (node.matches('body, html, main, [role~="main"]') || node.closest(protectedContext) || node.querySelector(protectedContext)) return false;
    for (const control of node.querySelectorAll(controls)) {
      if (!appLabel(control) && !dismissLabel(control)) return false;
      if (control.matches('input, select, textarea, [contenteditable], iframe, video, audio')) return false;
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      const value = label(text.nodeValue);
      if (!value) continue;
      const control = text.parentElement?.closest('a, button, [role~="button"]');
      if (control && node.contains(control) && (appLabel(control) || dismissLabel(control))) continue;
      if (!['facebook', 'messenger'].includes(value)) return false;
    }
    return true;
  }
  function container(node) {
    let ancestor = node.parentElement;
    let pin = ancestor && pinned(node) ? node : null;
    let result = null;
    for (let depth = 0; ancestor && depth < 4; depth++, ancestor = ancestor.parentElement) {
      if (!promotionOnly(ancestor)) break;
      if (pinned(ancestor)) pin = ancestor;
      if (pin) result = {node: ancestor, pin};
    }
    return result;
  }
  function restore(node, previous) {
    if (node.style.getPropertyValue('display') === 'none' && node.style.getPropertyPriority('display') === 'important') {
      if (previous.value) node.style.setProperty('display', previous.value, previous.priority);
      else node.style.removeProperty('display');
    }
    hidden.delete(node);
  }
  function scan() {
    pending = null;
    const desired = new Map();
    if (enabled) {
      for (const node of document.querySelectorAll('a[href], button, [role~="button"]')) {
        if (node.closest(protectedContext) || !appLabel(node)) continue;
        const wrapper = container(node);
        if (!destination(node) && !wrapper) continue;
        const target = wrapper?.node || node;
        desired.set(target, {pin: wrapper?.pin || null});
      }
      for (const node of desired.keys()) {
        if ([...desired.keys()].some(other => other !== node && other.contains?.(node))) desired.delete(node);
      }
    }
    for (const [node, previous] of hidden) {
      if (!node.isConnected || !desired.has(node)) restore(node, previous);
    }
    for (const [node, details] of desired) {
      if (hidden.has(node) && node.style.getPropertyValue('display') === 'none' && node.style.getPropertyPriority('display') === 'important') continue;
      hidden.set(node, {...details, value: node.style.getPropertyValue('display'), priority: node.style.getPropertyPriority('display')});
      node.style.setProperty('display', 'none', 'important');
      hidden.get(node).ownedStyle = node.getAttribute('style');
    }
  }
  const schedule = mutations => {
    if (mutations?.length && [...mutations].every(record => record.type === 'attributes' && record.attributeName === 'style' &&
      hidden.has(record.target) && record.target.getAttribute('style') === hidden.get(record.target).ownedStyle)) return;
    if (enabled && active && pending === null) pending = setTimeout(scan, 100);
  };
  const observer = new MutationObserver(schedule);
  const observe = () => {
    if (enabled && active) observer.observe(document, {subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['href', 'aria-label', 'role', 'data-pagelet', 'class', 'style']});
  };
  function configure(value) {
    enabled = value !== false;
    observer.disconnect();
    if (pending !== null) { clearTimeout(pending); pending = null; }
    scan(); observe();
  }
  function refreshSetting() {
    const current = ++revision;
    chrome.storage.local.get({enabled: true}).then(value => {
      if (current === revision && active) configure(value.enabled);
    }).catch(() => {});
  }
  refreshSetting();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) { revision++; configure(changes.enabled.newValue); }
  });
  window.addEventListener('pagehide', () => {
    active = false; revision++; observer.disconnect();
    if (pending !== null) { clearTimeout(pending); pending = null; }
  });
  const resume = () => { active = true; refreshSetting(); };
  // The guard forwards this even when it suppresses Facebook's pageshow signal.
  document.addEventListener('facefix-pageshow', resume);
  window.addEventListener('pageshow', resume);
})();
