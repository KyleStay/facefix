// Connection checks are shared by the popup and saved failure reports.
const FacefixConnection = {
  matches(url) {
    try { const value = new URL(url); return value.protocol === 'https:' && (value.hostname === 'facebook.com' || value.hostname.endsWith('.facebook.com')); }
    catch { return false; }
  },
  valid(snapshot) {
    return Boolean(snapshot && snapshot.schema === 1 && typeof snapshot.enabled === 'boolean' &&
      typeof snapshot.away === 'boolean' && Number.isFinite(snapshot.navigationMs) &&
      Number.isFinite(snapshot.recoveryMs) && snapshot.navigationMs >= 0 && snapshot.navigationMs <= 4000 &&
      snapshot.recoveryMs >= 0 && snapshot.recoveryMs <= 15000);
  },
  async inspect(chrome, tab) {
    const installedVersion = chrome.runtime.getManifest().version;
    const result = {kind:'no-access',installedVersion,bridgeVersion:null,guardVersion:null,snapshot:null};
    if (!tab?.id || !tab.url) return result;
    if (!this.matches(tab.url)) return {...result,kind:'wrong-tab'};
    if (tab.discarded) return {...result,kind:'discarded'};
    if (tab.status === 'loading') return {...result,kind:'loading'};
    let timer;
    let response;
    try {
      response = await Promise.race([
        chrome.tabs.sendMessage(tab.id,{type:'facefix-status'},{frameId:0}),
        new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('timeout')),2500); })
      ]);
    } catch { return {...result,kind:'bridge-missing'}; }
    finally { clearTimeout(timer); }
    const snapshot = response?.bridge === true ? response.guard : response;
    const version = value => typeof value === 'string' && value.length <= 24 && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
    result.bridgeVersion=version(response?.bridgeVersion);
    result.guardVersion=version(snapshot?.guardVersion);
    if (!this.valid(snapshot)) return {...result,kind:response?.bridge === true ? 'guard-missing' : 'incompatible'};
    // Keep the raw status only inside the browser; reports select known fields.
    result.snapshot=snapshot;
    result.kind=result.guardVersion === installedVersion && result.bridgeVersion === installedVersion ? 'connected' : 'outdated';
    return result;
  },
  describe(kind) {
    return ({
      'wrong-tab':['Open Facefix on Facebook','This popup describes the active tab. Switch to Facebook, then reopen Facefix.'],
      'no-access':['No accessible Facebook tab selected','If Facebook is active, open Chrome’s extension details for Facefix and allow site access on facebook.com. Then refresh Facebook once.'],
      'discarded':['Chrome has unloaded this Facebook tab','Select the Facebook tab to reload its contents, then reopen Facefix.'],
      'loading':['Facebook is still loading','Wait for Facebook to finish loading, then check again.'],
      'bridge-missing':['Facebook page connection did not respond','This page may predate the extension update, or site access may be blocked. Allow Facefix on Facebook, then refresh Facebook once. If it persists, capture a failure report.'],
      'guard-missing':['Page connected; protection guard missing','The page connection works, but the protection guard did not answer. Refresh Facebook once. If it persists, save a failure report.'],
      'incompatible':['Facebook answered with an incompatible status','Refresh Facebook once after updating Facefix. Capture a report if this continues.'],
      'outdated':['Facebook is running an older Facefix page script','Refresh Facebook once to load the installed version. The current page guard may still be providing partial protection.']
    })[kind] || ['Connection check failed','Reopen Facefix and capture a report if this continues.'];
  }
};
