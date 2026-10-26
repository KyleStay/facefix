// Isolated world: desktop message navigation and reversible phone layout.
// Never reads or changes drafts.
(() => {
  const config = FacefixMessenger;
  let enabled = false;
  let active = true;
  let revision = 0;
  let timer = null;
  let scheduled = null;
  let lastURL = location.href;
  let viewport = null;
  let ownedClass = false;
  const marks = [];
  const viewportValue = 'width=device-width, initial-scale=1, viewport-fit=cover';
  const chats = document.createElement('a');
  chats.id = 'facefix-messenger-chats';
  chats.textContent = 'Chats';
  chats.href = config.home;
  chats.setAttribute('aria-label', 'Back to chats');
  chats.hidden = true;

  document.addEventListener('click', event => {
    if (!enabled || !active || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || screen.width > 700) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') ||
        link.closest('form, dialog, [contenteditable], [role~="textbox"]')) return;
    const target = config.canonicalMessagesURL(link.href);
    if (!target || (target === link.href && config.isMessages(location.href))) return;
    // Entering Messages must make a document request with the desktop header;
    // Facebook's mobile SPA otherwise keeps its app-only landing screen.
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }, true);

  function clearMarks() {
    for (const {node, name, previous} of marks.splice(0)) {
      if (node.getAttribute(name) !== '') continue;
      if (previous === null) node.removeAttribute(name);
      else node.setAttribute(name, previous);
    }
  }
  function mark(node, name) {
    marks.push({node, name, previous: node.getAttribute(name)});
    node.setAttribute(name, '');
  }
  function restore() {
    clearMarks();
    chats.remove();
    if (ownedClass) document.documentElement.classList.remove('facefix-messenger');
    ownedClass = false;
    if (viewport && viewport.node.content === viewportValue) {
      if (viewport.created) viewport.node.remove();
      else if (viewport.original === null) viewport.node.removeAttribute('content');
      else viewport.node.setAttribute('content', viewport.original);
    }
    viewport = null;
  }
  const observer = new MutationObserver(() => schedule());
  function refresh() {
    scheduled = null;
    const phone = innerWidth <= 700 || screen.width <= 700;
    if (!enabled || !active || !document.body || !phone || !config.isMessages(location.href)) {
      observer.disconnect(); restore(); return;
    }
    observer.observe(document.body, {childList: true, subtree: true, attributes: true,
      attributeFilter: ['href', 'role', 'contenteditable', 'type']});
    if (document.querySelector('input[type="password"]')) { restore(); return; }
    const root = document.documentElement;
    if (!root.classList.contains('facefix-messenger')) { root.classList.add('facefix-messenger'); ownedClass = true; }
    if (!viewport) {
      let node = document.querySelector('meta[name="viewport"]');
      const created = !node;
      if (!node) { node = document.createElement('meta'); node.name = 'viewport'; document.head.append(node); }
      viewport = {node, created, original: node.getAttribute('content')};
      node.content = viewportValue;
    }
    clearMarks();
    chats.hidden = true;
    if (/^\/messages\/(?:e2ee\/)?t\/[^/]+/.test(location.pathname)) {
      const composer = document.querySelector('[role~="main"] [contenteditable="true"][role~="textbox"]');
      const sidebar = [...document.querySelectorAll('[role~="navigation"]')].find(node =>
        node.querySelector('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]') && !node.contains(composer));
      if (composer && sidebar) {
        let branch = sidebar;
        while (branch.parentElement && !branch.parentElement.contains(composer)) branch = branch.parentElement;
        const columns = branch.parentElement;
        if (columns && columns !== document.body && columns !== root) {
          let thread = composer;
          while (thread.parentElement && thread.parentElement !== columns) thread = thread.parentElement;
          if (thread.parentElement === columns && thread !== branch) {
            mark(branch, 'data-facefix-sidebar'); mark(thread, 'data-facefix-thread'); mark(columns, 'data-facefix-columns');
            if (!chats.isConnected) document.body.append(chats);
            chats.hidden = false;
          }
        }
      }
    }
  }
  function schedule() {
    if (enabled && active && scheduled === null) scheduled = setTimeout(refresh, 50);
  }
  function configure(value) {
    enabled = value !== false;
    observer.disconnect();
    if (scheduled !== null) clearTimeout(scheduled);
    scheduled = null;
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (!enabled || !active) { restore(); return; }
    refresh();
    // Watch only URLs outside Messages; no feed DOM observer or message-text reads.
    lastURL = location.href;
    timer = setInterval(() => {
      if (location.href !== lastURL) { lastURL = location.href; schedule(); }
    }, 500);
  }
  function readSetting() {
    const current = ++revision;
    chrome.storage.local.get({enabled: true}).then(value => {
      if (current === revision && active) configure(value.enabled);
    }).catch(() => {});
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) { revision++; configure(changes.enabled.newValue); }
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('pagehide', () => {
    active = false; revision++;
    observer.disconnect();
    if (timer !== null) clearInterval(timer);
    if (scheduled !== null) clearTimeout(scheduled);
    timer = scheduled = null;
  });
  const resume = () => { active = true; readSetting(); };
  // The MAIN guard forwards this before suppressing Facebook's BFCache event.
  document.addEventListener('facefix-pageshow', resume);
  window.addEventListener('pageshow', resume);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', readSetting, {once: true});
  else readSetting();
})();
