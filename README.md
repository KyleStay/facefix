# Facefix — Keep My Place

A small Chrome extension for Facebook. No dependencies, analytics, network requests, or remote code. Settings stay on your device.

## Publish to the Chrome Web Store

Open the [publishing guide](https://kylestay.github.io/facefix/publish.html) for step-by-step instructions, copyable listing and privacy answers, asset downloads, and a saved checklist. You can also open [publish.html](publish.html) locally. The guide starts with adding a new item to an existing developer account.

Upload [dist/facefix-1.2.0-store.zip](dist/facefix-1.2.0-store.zip), which contains `manifest.json` at the root and only the extension runtime files. Rebuild it with `python3 build.py`. Do not upload GitHub's source archive. The icon, promotional tile, and [three 1280 × 800 store screenshots](store-assets/facefix-store-screenshots.zip) are included. These show the actual popup markup in a static interface preview with zero counters, without a fabricated Facebook session. Complete the live behavior check before submitting.

Read the [privacy policy](https://kylestay.github.io/facefix/privacy.html), also available as [PRIVACY.md](PRIVACY.md). A bundled readable version is linked from the popup. Version 1.2.0 adds departure-event suppression and recovery of a visible post after feed shifts or rerenders, without adding permissions.

## Install

1. Extract the store ZIP into its own folder.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Reload your existing Facebook tabs once. Pin Facefix for access to its on/off switch.

For an update, replace the old extension files with the new files, click **Reload** on Facefix in `chrome://extensions`, then reload existing Facebook tabs. Version 1.1.0 adds local counters; it does not request additional permissions.

## What it does

- Captures page-level visibility and window blur/focus events in both directions, so Facebook receives fewer inactivity and return triggers.
- Blocks cancelable script-driven reloads and Home/feed navigation while away and for four seconds after returning.
- Tries to retain the visible post and its onscreen offset for up to 15 seconds after returning. It can match a rerendered post by its permalink, falling back to a pixel position if no matching post is available. Trusted user input ends recovery immediately.
- Asks Chrome not to automatically discard Facebook tabs, preventing the usual discard-and-reload cycle.
- Ends the return guard immediately on trusted clicks, keys, touch, or scrolling; normal navigation remains available.

Use the toolbar switch to pause protection immediately. Pausing also makes Facebook tabs discardable again. Keeping tabs in memory can increase memory use. Remove the extension through Chrome's extensions page; reload Facebook afterward to remove the page hooks.

## Local counters

Open Facefix's toolbar popup to see totals across your Facebook tabs:

- **Return events suppressed:** visibility/focus/page-restore signals intercepted. Multiple signals can occur on a single return. This does not prove Facebook would have refreshed.
- **Reloads blocked:** cancelable automatic reload requests canceled by the navigation guard.
- **Home redirects blocked:** automatic Home navigation attempts blocked by either the history or navigation guard.
- **Scroll recoveries:** successful recoveries of a large upward scroll jump, counted at most once per return window.

Counters update while the popup is open and survive page reloads and Chrome restarts. **Reset counters** clears all four totals; it does not change protection. Only category totals are stored locally, with no URLs, post contents, or timestamps. Paused protection does not add counts. Keeping a tab in memory is a setting, not a confirmed prevented discard, so it is not counted.

These are diagnostic totals. The page and content script share DOM events, so page code could spoof counter signals. They are not a tamper-proof audit log.

## Limits

This is a best-effort prevention tool, not a saved copy of the feed. It cannot preserve deleted posts, expired sessions, restore a tab already discarded before installation, or prevent browser crashes, forced memory eviction, or browser restarts. Facebook can replace posts using internal timers/network responses without emitting these events; those paths are not blocked. Nested scrolling panels are not restored. Suppressing departure and return events may affect Facebook's presence indicators, unread updates, background media behavior, or other lifecycle-triggered features. Post recovery depends on recognizable feed articles and permalinks; it cannot recover a post Facebook has removed from the loaded feed. Login/security redirects and non-Home destinations remain available. Manual Reload and Back remain available.

Facebook's implementation changes; test on your own account. No live logged-in Facebook session was used for validation. The included check exercises the page hooks with simulated browser events, not Facebook's production code.

## Verify

Run `node --test tests/*.test.cjs` from this repository folder.

Version 1.2.0 passes nine automated checks covering page hooks, the page-to-storage counter path, concurrent updates across tabs, worker restart persistence, popup display/live updates/reset, pausing, navigation exceptions, scroll recovery counting, and Facebook-only memory protection. These use simulated browser APIs; they do not prove the extension works against Facebook's production scripts. A browser fixture also verifies delayed DOM replacement recovery and intentional scrolling. This is not a verification against a logged-in Facebook session.

Manual check: scroll down Home; switch tabs for a minute; return and verify the same posts and scroll position. Repeat on a profile, group, and post. Check Home clicks, Back, typing, scroll, and manual Reload. Pause from the popup and repeat. On `chrome://discards`, Facebook should show as not auto-discardable while protection is enabled.

Counter check: reset totals, switch away from Facebook, then return and open the popup. Return events should increase if return signals were suppressed; reload/redirect counters should stay at zero unless those actions were actually attempted. Reset, pause protection, and repeat: all counters should stay zero. Resume, return to two Facebook tabs, and verify totals accumulate. Do not treat zero blocked reloads as a failure if suppressing the earlier return event prevented the reload from being attempted.

Chrome API references: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts and https://developer.chrome.com/docs/extensions/reference/api/tabs

Browser reproduction: serve this repository locally and open `tests/return-fixture.html`. The delayed-replacement check replaces the visible post after five seconds and inserts content above it; recovery should keep the same post offset.
