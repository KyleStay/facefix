# Facefix — Keep My Place

A small Chrome extension for Facebook. No dependencies, analytics, network requests, or remote code. Settings stay on your device.

## Publish to the Chrome Web Store

Open the [publishing guide](https://kylestay.github.io/facefix/publish.html) for step-by-step instructions, copyable listing and privacy answers, asset downloads, and a saved checklist. You can also open [publish.html](publish.html) locally. The guide starts with adding a new item to an existing developer account.

Upload [dist/facefix-1.4.0-store.zip](dist/facefix-1.4.0-store.zip), which contains `manifest.json` at the root and only the extension runtime files. Rebuild it with `python3 build.py`. Do not upload GitHub's source archive. The icon, promotional tile, and [three 1280 × 800 store screenshots](store-assets/facefix-store-screenshots.zip) are included. These show the actual popup markup in a static interface preview with zero counters, without a fabricated Facebook session. Complete the live behavior check before submitting.

Read the [privacy policy](https://kylestay.github.io/facefix/privacy.html), also available as [PRIVACY.md](PRIVACY.md). A bundled readable version is linked from the popup. Version 1.4.0 adds popup timers, separate connection checks, and bounded local failure diagnostics without adding permissions.

## Install

1. Extract the store ZIP into its own folder.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Reload your existing Facebook tabs once. Pin Facefix for access to its on/off switch.

For an update, replace the old extension files with the new files, click **Reload** on Facefix in `chrome://extensions`, then reload existing Facebook tabs. The popup shows the installed and page versions. Refresh Facebook once after updating so both match.

## What it does

- Captures page-level visibility and window blur/focus events in both directions, so Facebook receives fewer inactivity and return triggers.
- Blocks cancelable script-driven reloads and Home/feed navigation while away and for four seconds after returning.
- Tries to retain the visible post and its onscreen offset for up to 15 seconds after returning. It can match a rerendered post by its permalink, falling back to a pixel position if no matching post is available. Trusted user input ends recovery immediately.
- Asks Chrome not to automatically discard Facebook tabs, preventing the usual discard-and-reload cycle.
- Ends the return guard immediately on trusted clicks, keys, touch, or scrolling; normal navigation remains available.

Use the toolbar switch to pause protection immediately. Pausing also makes Facebook tabs discardable again. Keeping tabs in memory can increase memory use. Remove the extension through Chrome's extensions page; reload Facebook afterward to remove the page hooks.

## Live timers and explanations

The toolbar popup shows the current Facebook tab's real Facefix countdowns: a 4-second reload/Home guard and up to 15 seconds of position recovery after returning. It distinguishes armed, running, paused, finished, and ended-by-interaction states. Zero means the protection window is inactive; Facefix never schedules a reload when a timer expires.

The popup explanation describes tab-return triggers, in-page feed changes, and browser tab discarding. Facebook's own internal refresh timers are not available. Opening the toolbar popup can unfocus the Facebook window; in that case the display correctly shows the guards armed until you return.

Countdown snapshots are read locally while the popup is open. Selected status fields are saved when you request a failure report; nothing is automatically transmitted outside the browser.

## Local counters

Open Facefix's toolbar popup to see totals across your Facebook tabs:

- **Return events suppressed:** visibility/focus/page-restore signals intercepted. Multiple signals can occur on a single return. This does not prove Facebook would have refreshed.
- **Reloads blocked:** cancelable automatic reload requests canceled by the navigation guard.
- **Home redirects blocked:** automatic Home navigation attempts blocked by either the history or navigation guard.
- **Scroll recoveries:** successful recoveries of a large upward scroll jump, counted at most once per return window.

Counters update while the popup is open and survive page reloads and Chrome restarts. **Reset counters** clears all four totals; it does not change protection. These aggregate totals contain no URLs, post contents, or timestamps. Separate local diagnostics are described below. Paused protection does not add counts. Keeping a tab in memory is a setting, not a confirmed prevented discard, so it is not counted.

These are diagnostic totals. The page and content script share DOM events, so page code could spoof counter signals. They are not a tamper-proof audit log.

## Connection checks and local failure reports

Automatic checks also record whether the connection answered after a Facebook page finishes loading. The popup distinguishes a non-Facebook tab, unavailable site access, a loading/discarded tab, an absent page connection, an absent guard, and outdated page scripts. It shows installed and page versions. If Facebook is active but the connection is missing, check Facefix's site access in Chrome, then refresh Facebook once after updating. A clearly labeled reconnect button refreshes only after your click; it can change the feed. No automatic refresh or duplicate guard reinjection is used.

**Diagnostics and failure reports → Something went wrong** saves current connection/protection state, local event evidence, and findings with next steps. Open **Review history, export, or clear** to inspect the timeline, select a Facebook tab, capture a report, or download the latest report as JSON. No report is automatically sent anywhere. Review it before sharing it through a support request. Reports help investigate and implement a later fix; they do not rewrite extension code automatically.

Local recording defaults on. It keeps up to 300 events (120 per document per minute), five reports, and at most 24 hours of history, pruned on the next diagnostic activity. Each report includes up to 120 events from its tab in the last 30 minutes. Events use fixed categories, timestamps, local tab/document identifiers, and numeric/boolean timing, scroll, post-match, discard, and capability measurements. No URLs, post text, key text, cookies, messages, screenshots, or raw error messages are stored. Recording can be disabled independently; manual reports still work. Clear history removes events and reports without resetting counters.

The analyzer checks document reload/discard evidence, guard/bridge versions, protection state, lost post anchors, failed recovery, layout shifts, and large movement outside recovery. It labels uncertainty rather than inventing a cause. Facefix rechecks a drifted Chrome auto-discard setting, attempts to restore it, and claims repair only if Chrome confirms the result. Exported files are outside the extension's retention controls. DOM-based traces can be spoofed by page code and are not an audit log.

## Limits

This is a best-effort prevention tool, not a saved copy of the feed. It cannot preserve deleted posts, expired sessions, restore a tab already discarded before installation, or prevent browser crashes, forced memory eviction, or browser restarts. Facebook can replace posts using internal timers/network responses without emitting these events; those paths are not blocked. Nested scrolling panels are not restored. Suppressing departure and return events may affect Facebook's presence indicators, unread updates, background media behavior, or other lifecycle-triggered features. Post recovery depends on recognizable feed articles and permalinks; it cannot recover a post Facebook has removed from the loaded feed. Login/security redirects and non-Home destinations remain available. Manual Reload and Back remain available.

Facebook's implementation changes; test on your own account. No live logged-in Facebook session was used for validation. The included check exercises the page hooks with simulated browser events, not Facebook's production code.

## Verify

Run `node --test tests/*.test.cjs` from this repository folder.

Version 1.4.0 passes eighteen automated checks covering page hooks, the page-to-storage counter path, concurrent updates across tabs, worker restart persistence, popup display/live updates/reset, pausing, navigation exceptions, scroll recovery counting, Facebook-only memory protection, granular connection failures, diagnostic privacy filtering, retention/rate caps, opt-out, report capture, and verified memory-setting repair. These use simulated browser APIs; they do not prove the extension works against Facebook's production scripts. Real browser fixtures also verify cancellation of script-driven reload and Home navigation, deliberate reload after interaction, delayed DOM replacement recovery, and intentional scrolling. This is not a verification against a logged-in Facebook session.

Manual check: scroll down Home; switch tabs for a minute; return and verify the same posts and scroll position. Repeat on a profile, group, and post. Check Home clicks, Back, typing, scroll, and manual Reload. Pause from the popup and repeat. On `chrome://discards`, Facebook should show as not auto-discardable while protection is enabled.

Counter check: reset totals, switch away from Facebook, then return and open the popup. Return events should increase if return signals were suppressed; reload/redirect counters should stay at zero unless those actions were actually attempted. Reset, pause protection, and repeat: all counters should stay zero. Resume, return to two Facebook tabs, and verify totals accumulate. Do not treat zero blocked reloads as a failure if suppressing the earlier return event prevented the reload from being attempted.

Chrome API references: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts and https://developer.chrome.com/docs/extensions/reference/api/tabs

Browser reproduction: serve this repository locally and open `tests/return-fixture.html`. The delayed-replacement check replaces the visible post after five seconds and inserts content above it; recovery should keep the same post offset.

For controlled UI checks, run `python3 tests/build-previews.py`, serve the repository, and open `tests/browser-popup.html` or `tests/browser-diagnostics.html`. These use explicitly labeled synthetic browser APIs. They do not connect to Facebook or real extension storage.
