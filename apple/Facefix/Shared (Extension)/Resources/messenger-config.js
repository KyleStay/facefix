// Shared constants; no account, message, or credential data lives here.
globalThis.FacefixMessenger = Object.freeze({
  ruleset: 'messenger',
  scriptID: 'facefix-messenger-identity',
  home: 'https://www.facebook.com/messages/',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  sites: Object.freeze([
    'https://facebook.com', 'https://www.facebook.com', 'https://m.facebook.com',
    'https://mbasic.facebook.com', 'https://web.facebook.com',
    'https://messenger.com', 'https://www.messenger.com', 'https://m.messenger.com'
  ]),
  isSupportedURL(value) {
    try { return this.sites.includes(new URL(value).origin); } catch { return false; }
  },
  // The manifest/registration restricts origins; path checks also support SPA routes.
  isMessages(value) {
    try {
      const url = new URL(value);
      return this.isSupportedURL(value) && (/messenger\.com$/.test(url.hostname) || /^\/(?:messages(?:\.php)?|messenger)(?:\/|$)/.test(url.pathname));
    } catch { return false; }
  },
  canonicalMessagesURL(value) {
    if (!this.isMessages(value)) return null;
    const url = new URL(value);
    if (/messenger\.com$/.test(url.hostname)) {
      if (url.pathname !== '/' && !/^\/(?:e2ee\/)?t\//.test(url.pathname)) return null;
      url.pathname = '/messages' + url.pathname;
    } else url.pathname = url.pathname.replace(/^\/(?:messages\.php|messenger)(?=\/|$)/, '/messages');
    url.hostname = 'www.facebook.com';
    return url.href;
  },
  isIdentityPage(value) {
    if (this.isMessages(value)) return true;
    try {
      const url = new URL(value);
      if (!/^\/(?:login(?:\.php)?|checkpoint)(?:\/|$)/.test(url.pathname)) return false;
      const next = new URL(url.searchParams.get('next') || '/', url.origin);
      return this.isSupportedURL(next.href) && this.isMessages(next.href);
    } catch { return false; }
  }
});
