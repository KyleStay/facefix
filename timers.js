// Live protection information shown in the toolbar popup.
const FacefixTimers = {
  markup: `<h2>Live protection</h2>
    <p class="timer-state" data-timer="state" role="status">Connecting to this Facebook tab…</p>
    <div class="timer-row"><span>Reload / Home guard <small>4 seconds after return</small></span><strong data-timer="navigation">—</strong></div>
    <progress data-timer="navigation-progress" max="4000" value="0" aria-label="Reload and Home guard time remaining"></progress>
    <div class="timer-row"><span>Position recovery <small>Up to 15 seconds after return</small></span><strong data-timer="recovery">—</strong></div>
    <progress data-timer="recovery-progress" max="15000" value="0" aria-label="Position recovery time remaining"></progress>
    <p class="timer-note" data-timer="note">Waiting for tab status.</p>
    <details class="timer-explanation"><summary>How refresh protection works</summary>
      <p><b>Returning to Facebook:</b> Facebook may refresh in response to focus or visibility changes. Facefix intercepts those signals and blocks cancelable automatic reloads and Home redirects while you are away and for 4 seconds after you return.</p>
      <p><b>Feed changes inside the page:</b> The feed can move without a full reload. For up to 15 seconds after returning, Facefix tries to keep the same visible post in place, if it is still loaded.</p>
      <p><b>Idle tabs:</b> Chrome can unload an idle tab and reload it when opened. Facefix asks Chrome to keep Facebook tabs in memory. It cannot prevent every forced eviction or crash.</p>
      <p><b>Your actions:</b> Clicking, scrolling, or typing in Facebook ends the short protection windows. Back and manual Reload remain available. When a timer reaches zero, Facefix stops that guard; it never schedules a reload.</p>
      <p>These are Facefix's timers. Facebook's internal refresh timers are not exposed, and some internal feed updates can still happen.</p>
    </details>`,
  css: `h2{font-size:15px;margin:0 0 6px}.timer-state{font-size:13px;font-weight:650;margin:0 0 12px}.timer-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;font-size:13px}.timer-row small{display:block;font-size:11px;color:#526b60;line-height:1.5}.timer-row strong{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:17px}progress{display:block;width:100%;height:7px;accent-color:#26745b;margin:8px 0 0}.timer-note{font-size:12px;line-height:1.5;color:#526b60;margin:12px 0}.timer-explanation{font-size:12px;line-height:1.55;border-top:1px solid #d4dfd4;padding-top:10px}.timer-explanation summary{cursor:pointer;font-weight:650}.timer-explanation p{font-size:12px;margin:12px 0;color:inherit}`,
  render(root, snapshot, connection = {}) {
    const field = name => root.querySelector(`[data-timer="${name}"]`);
    const text = (name,value) => { if (field(name).textContent !== value) field(name).textContent = value; };
    const valid = FacefixConnection.valid(snapshot);
    if (!valid) {
      const [title,note] = FacefixConnection.describe(connection.kind);
      text('state',title);
      field('navigation').textContent = '—'; field('recovery').textContent = '—';
      field('navigation-progress').value = 0; field('recovery-progress').value = 0;
      text('note',note);
      return;
    }
    const {enabled, away, navigationMs, recoveryMs, reason, postMatched} = snapshot;
    const stateText = connection.kind === 'outdated' ? FacefixConnection.describe('outdated')[0] : !enabled ? 'Protection paused' : away ? 'Away / window unfocused — guards armed' :
      recoveryMs > 0 || navigationMs > 0 ? 'Protection windows running' :
      reason === 'interaction' ? 'Windows ended by your interaction' : reason === 'finished' ? 'Protection windows finished' : 'Waiting for your next tab return';
    if (field('state').textContent !== stateText) field('state').textContent = stateText;
    for (const [name, remaining] of [['navigation',navigationMs], ['recovery',recoveryMs]]) {
      field(name).textContent = !enabled ? 'Paused' : away ? 'Armed' : (remaining / 1000).toFixed(1) + ' s';
      field(name + '-progress').value = !enabled || away ? 0 : remaining;
    }
    field('note').textContent = connection.kind === 'outdated' ? FacefixConnection.describe('outdated')[1] : !enabled ? 'Turn on Facebook protection to arm these guards.' : away ?
      'The 4 s and 15 s windows start when you return. Opening the toolbar popup can move focus away from Facebook.' : recoveryMs > 0 ?
      (postMatched ? 'Tracking a visible post. Your next interaction with Facebook ends recovery.' : 'Using scroll-position recovery; no visible post is currently matched.') :
      'Zero means that window is inactive. It does not mean Facebook will reload.';
  }
};
