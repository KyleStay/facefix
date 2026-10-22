const FacefixDiagnostics = {
  maxEvents: 300,
  maxReports: 5,
  maxAge: 24 * 60 * 60 * 1000,
  names: {
    'connection-checked':'Page connection checked', load:'Page opened', left:'Left the page', returned:'Returned to the page',
    'guard-ended':'Protection window ended', 'navigation-blocked':'Automatic navigation blocked',
    'anchor-captured':'Recovery target captured', 'anchor-missing':'Original post no longer matched',
    'anchor-reacquired':'Original post matched again', 'recovery-attempt':'Position recovery attempted',
    'scroll-jump':'Large scroll movement observed', 'layout-shift':'Large layout shift observed',
    'bridge-unavailable':'Page guard did not respond', 'tab-discarded':'Chrome discarded the tab',
    'memory-protection-failed':'Could not set Chrome memory protection',
    'memory-protection-restored':'Chrome memory protection restored'
  },
  sanitize(event) {
    if (!event || typeof event.kind !== 'string' || !Object.hasOwn(this.names,event.kind)) return null;
    const details = {};
    const enums = {
      connection:['connected','outdated','bridge-missing','guard-missing','incompatible','no-access','wrong-tab','loading','discarded'],
      reason:['visibility','blur','focus','pageshow','input','expired','disabled'],
      input:['click','pointerdown','keydown','wheel','touchstart'],
      mode:['post','element','pixel'], method:['pushState','replaceState','reload','navigate'],
      pageLoadType:['navigate','reload','back_forward','prerender','unknown']
    };
    const booleans = ['success','postMatched','wasDiscarded','navigationAPI','layoutShiftAPI','navigationActive','recoveryActive'];
    const versions = ['bridgeVersion','guardVersion'];
    const numbers = ['navigationMs','recoveryMs','deltaPx','candidates','ageMs','shiftScore'];
    const input = event.details && typeof event.details === 'object' ? event.details : {};
    for (const key of [...Object.keys(enums),...booleans,...numbers,...versions]) {
      if (!Object.hasOwn(input,key)) continue;
      const value = input[key];
      if (Object.hasOwn(enums,key) && enums[key].includes(value)) details[key] = value;
      else if (booleans.includes(key) && typeof value === 'boolean') details[key] = value;
      else if (versions.includes(key) && typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) && value.length <= 24) details[key] = value;
      else if (numbers.includes(key) && Number.isFinite(value) && Math.abs(value) <= 1e7) details[key] = Math.round(value * 100) / 100;
    }
    return {kind:event.kind,details};
  },
  prune(data = {}, now = Date.now()) {
    return {
      events:(Array.isArray(data.events) ? data.events : []).filter(item => item.at >= now - this.maxAge).slice(-this.maxEvents),
      reports:(Array.isArray(data.reports) ? data.reports : []).filter(item => item.at >= now - this.maxAge).slice(-this.maxReports).map(report => ({...report,events:(Array.isArray(report.events) ? report.events : []).filter(event => event.at >= now - this.maxAge)}))
    };
  },
  analyze(events, snapshot) {
    const has = (kind,predicate = () => true) => events.some(event => event.kind === kind && predicate(event.details));
    const findings = [];
    const add = (title,confidence,evidence,action) => findings.push({title,confidence,evidence,action});
    const latestLoad = snapshot && typeof snapshot.wasDiscarded === 'boolean' ? {details:snapshot} : [...events].reverse().find(event => event.kind === 'load');
    if (latestLoad?.details.wasDiscarded) add('Chrome discarded this document before it reopened','observed','The page reports document.wasDiscarded = true.','Check Chrome Memory Saver, tab-suspender extensions, and whether Facefix memory protection is enabled.');
    else if (has('tab-discarded')) add('A tab discard was observed recently','observed','Chrome reported a discarded tab in this timeline.','Check Chrome Memory Saver and other tab-management extensions.');
    if (snapshot?.navigationAPI === false) add('The browser navigation guard is unavailable','observed','The current page has no Navigation API.','Use a current Chromium browser. History guards may still work, but canceling full script-driven reloads requires the Navigation API.');
    if (latestLoad?.details.pageLoadType === 'reload') add('A full document reload occurred','observed','The browser navigation timing reports a reload. It does not identify who initiated it.','Compare the trace before the reload with blocked-navigation events and tab discard evidence.');
    if (!snapshot) add('The page guard is not connected','observed','The active tab did not provide a current Facefix status.','Confirm this is a Facebook tab, reload Facefix in the extensions list, then refresh Facebook once.');
    else if (!snapshot.enabled) add('Protection was paused when reported','observed','The current page guard reports enabled = false.','Turn Facebook protection on and repeat the return-to-tab test.');
    if (has('anchor-missing')) {
      const missing=events.findLastIndex(event=>event.kind==='anchor-missing');
      const reacquired=events.findLastIndex(event=>event.kind==='anchor-reacquired');
      add('The original post could not be matched during recovery','observed',
        'The trace records a recovery target disappearing or changing identity. ' + (reacquired>missing ? 'A later event records a match again.' : 'No later match is recorded. Opening the popup can capture a new target, so the current match flag does not establish recovery of the original post.'),
        'Facebook may have replaced the loaded feed. Compare the event times with the failure. Facefix cannot restore a post it can no longer find.');
    }
    if (has('anchor-captured',d => d.mode === 'pixel')) add('Only pixel-position recovery was available','observed','No suitable visible article was captured on departure.','The feed markup may have changed, or the view may use a nested scroller. Include this report when requesting a fix.');
    if (has('recovery-attempt',d => d.success === false)) add('A recovery attempt did not reach its target','observed','The page scroll position did not reach the requested position.','Check for a shorter replacement feed, a nested scroll panel, or competing page scrolling.');
    if (has('scroll-jump',d => !d.recoveryActive)) add('A large movement occurred outside recovery','observed','A large scroll movement was observed with no recent page input while position recovery was inactive.','Check whether the 15-second window had ended or a prior click, key, or scroll ended protection. This observation alone does not prove a Facebook refresh.');
    if (has('guard-ended',d => d.reason === 'input')) add('User interaction ended a protection window','observed','A click, key, pointer, wheel, or touch event ended the short guards.','Compare that event with the failure time. Ending guards after interaction is intentional behavior.');
    if (has('layout-shift') && !latestLoad?.details.wasDiscarded && latestLoad?.details.pageLoadType !== 'reload') add('An in-page layout change is a possible cause','possible','A large layout shift was observed, without a full reload identified in this document.','Inspect post-matching and scroll events around the failure. A layout shift is not proof the entire feed refreshed.');
    if (has('memory-protection-failed')) add('Chrome memory protection could not be applied','observed','A tabs.update operation failed.','Check extension permissions and whether the tab was closed or replaced.');
    if (!findings.length) add('No cause established from this trace','unknown','The available events do not establish why the feed changed.','Keep diagnostics enabled, reproduce the problem, and press Something went wrong immediately afterward.');
    return findings;
  }
};
