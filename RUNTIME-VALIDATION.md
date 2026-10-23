# Remaining Facefix 1.4.2 runtime acceptance

These checks are for a human in a permitted environment. The agent did not retry the denied process/socket route. Use only a disposable Chrome for Testing profile, never the real production profile. Record the browser version, install method, extension ID and displayed version for every case.

## Prepare

From `facefix/source`, run the three build commands in COEXISTENCE.md. Extract each canonical ZIP into a separate directory. Keep the production identity replacement directory at one stable path during same-folder Reload tests.

To repeat the basic permitted runner check in an environment where its ownership preflight is allowed, use a long-lived terminal shell as the owner:

```bash
python3 /Users/kyle/Documents/Codex/2026-10-23/task-3/cliche-butt/tools/launch_test_chrome.py \
  --extension /absolute/path/to/extracted/facefix-1.4.2-replacement \
  --owner-pid $$ --headless --url about:blank
```

This task-local key-aware runner preserves the installed skill runner’s lifecycle and isolation boundary; it derives the key ID correctly. Require `debugger_ready:true`, matching key-derived production ID, and `extension_loaded:true`. Retain its exact PID/start identity/profile/debug port/log. If it is denied, stop and report; do not switch routes. Register cleanup before assertions: CDP `Browser.close`, wait for the exact owned process tree to exit, then remove its owned profile/log. Keep zero surviving owned processes/profiles as acceptance evidence. Never delete a live profile.

## Standard identity replacement matrix

1. In a disposable test profile with the normal store product installed, verify its ID is `kckhpinnhkjfblkalloabaiihpdmklla`. Use the browser's supported unpacked replacement install with the verified replacement folder. Expected: one Facefix identity, displayed version 1.4.2, settings/counters retained where the browser's replacement method preserves extension storage. Record rejection or policy conflicts rather than forcing an install.
2. Reverse the order: load the verified replacement in a fresh disposable profile, then exercise the normal store installation/update flow only as permitted by the browser. Expected: no second ID; record which version the browser accepts. This does not prove publisher-signed upgrade behavior until an actual signed update is tested.
3. Test a normal existing unpacked instance update at the same loaded path. Reload the extension through the browser's own UI. Refresh every Facebook tab afterward. Expected: installed/page versions both show 1.4.2; exactly one guard responds after page reload.
4. Before refreshing a pre-update Facebook document, expect it may retain old MAIN hooks. This is a known limitation, not passing replacement behavior. Refresh it and verify normal behavior returns.
5. Pause and resume from the popup. While paused, no automatic navigation suppression/recovery counters should accrue and tab discardability should follow the documented setting. Resume and verify recovery windows re-arm on tab return. Scrolling must stop position recovery while renewing the reload/Home guard for four seconds; trusted clicks or non-scrolling typing must end both.
6. Exercise Home, group, profile and post navigation, manual Reload, Back, typing, trusted scrolling, repeated SPA route changes, and iframes. Product guards apply to matching top-level documents; do not claim arbitrary frame coverage.
7. Restart the service worker using ordinary developer tooling, then restart the disposable browser. Expected: persisted settings/counters remain; guards reconnect after tab reload. Re-run pause/resume and connection diagnostics.
8. Optional separate-ID development: load the development package alongside production in both orders. Expected IDs remain distinct; no automatic retirement is expected, and duplicate/conflicting effects are a known limitation. DOM/postMessage cannot trigger an ownership protocol because this final candidate has none.
9. Remove only task-owned test installations using normal browser controls, close the disposable browser and confirm all exact owned processes have exited. Remove only its disposable profile after that. Record cleanup and all failed/unrun cases.

No case above authorizes changing, disabling, or uninstalling the user's real production installation, store publication, or bypassing policy restrictions.
