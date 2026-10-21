# Facefix — Keep My Place

A small Chrome extension for Facebook. No dependencies, analytics, network requests, or remote code. Settings stay on your device.

## Publish to the Chrome Web Store

Open the [publishing guide](https://kylestay.github.io/facefix/publish.html) for step-by-step instructions, copyable listing and privacy answers, asset downloads, and a saved checklist. You can also open [publish.html](publish.html) locally. The guide starts with adding a new item to an existing developer account.

Upload [dist/facefix-1.1.1-store.zip](dist/facefix-1.1.1-store.zip), which contains `manifest.json` at the root and only the extension runtime files. Rebuild it with `python3 build.py`. Do not upload GitHub's source archive. The icon and promotional tile are included; capture a real screenshot during the live test before submitting.

Read the [privacy policy](https://kylestay.github.io/facefix/privacy.html), also available as [PRIVACY.md](PRIVACY.md). A bundled readable version is linked from the popup. Version 1.1.1 adds icons, the policy link, and store packaging without adding permissions.

## Install

1. Extract the store ZIP into its own folder.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Reload your existing Facebook tabs once. Pin Facefix for access to its on/off switch.

For an update, replace the old extension files with the new files, click **Reload** on Facefix in `chrome://extensions`, then reload existing Facebook tabs. Version 1.1.0 adds local counters; it does not request additional permissions.

## What it does

- Captures Facebook's tab-return visibility/focus events before page scripts receive them.
- Blocks cancelable script-driven reloads and Home/feed navigation while away and for four seconds after returning.
- Guards the main page against large upward scroll jumps during that return window.
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

This is a best-effort prevention tool, not a saved copy of the feed. It cannot preserve deleted posts, expired sessions, restore a tab already discarded before installation, or prevent browser crashes, forced memory eviction, or browser restarts. Facebook can replace posts using internal timers/network responses without emitting these events; those paths are not blocked. Nested scrolling panels are not restored. Suppressing return events may delay Facebook's presence indicators, unread updates, or other return-triggered features. Login/security redirects and non-Home destinations remain available. Manual Reload and Back remain available.

Facebook's implementation changes; test on your own account. No live logged-in Facebook session was used for validation. The included check exercises the page hooks with simulated browser events, not Facebook's production code.

## Verify

Run `node --test tests/*.test.cjs` from this repository folder.

Version 1.1.0 passes six automated checks covering page hooks, the page-to-storage counter path, concurrent updates across tabs, worker restart persistence, popup display/live updates/reset, pausing, navigation exceptions, scroll recovery counting, and Facebook-only memory protection. These use simulated browser APIs; they do not prove the extension works against Facebook's production scripts. Live installation verification was unavailable: no Facebook tab was open, and the browser automation policy blocked `chrome://extensions`.

Manual check: scroll down Home; switch tabs for a minute; return and verify the same posts and scroll position. Repeat on a profile, group, and post. Check Home clicks, Back, typing, scroll, and manual Reload. Pause from the popup and repeat. On `chrome://discards`, Facebook should show as not auto-discardable while protection is enabled.

Counter check: reset totals, switch away from Facebook, then return and open the popup. Return events should increase if return signals were suppressed; reload/redirect counters should stay at zero unless those actions were actually attempted. Reset, pause protection, and repeat: all counters should stay zero. Resume, return to two Facebook tabs, and verify totals accumulate. Do not treat zero blocked reloads as a failure if suppressing the earlier return event prevented the reload from being attempted.

Chrome API references: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts and https://developer.chrome.com/docs/extensions/reference/api/tabs
