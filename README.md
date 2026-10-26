# Facefix

## Current direction

Facefix keeps Facebook usable in the browser: keep your place in the feed,
remove dedicated website app-promotion bars, and use Messenger in Safari on
an iPhone. This repository is the ongoing home for the Messenger prototype and
Facefix's existing Chrome and Safari work.

The local source candidate is **1.6.0**. This landing does not publish a new
Chrome/App Store release or upload another TestFlight build. Existing product
identities are retained.

## Install in Safari on iPhone

1. Open `apple/Facefix/Facefix.xcodeproj` in Xcode and choose **Facefix (iOS)**.
2. Build/run it on your development iPhone using the existing Facefix signing
   setup. Complete any Developer Mode/trust prompts on the phone yourself.
3. Enable **Facefix** in Settings → Apps → Safari → Extensions and allow
   **facebook.com**. For an old Messenger link, allow **messenger.com** too.
4. Open `https://www.facebook.com/messages/` in Safari. In Safari's page menu,
   open Facefix; if prompted choose **Always Allow… → Always Allow on This
   Website**. Choose **Open Messages** and sign in directly on Facebook.
5. Reload after granting access. If necessary, use Safari's **Request Desktop
   Website**. Encrypted history may require your Messenger PIN.

Use **Messenger help → Check This Tab** to check the page's browser identity.
The extension's ZIP is a build input; an iPhone needs its signed containing app,
installed through Xcode or a separately authorized TestFlight/App Store release.
See [SAFARI.md](SAFARI.md) for the existing Apple project and build contract.

## Chrome

[Install the published Facefix from the Chrome Web Store](https://chromewebstore.google.com/detail/facefix-%E2%80%94-keep-my-place/kckhpinnhkjfblkalloabaiihpdmklla).
For local development, run `python3 build.py --mode development`, extract its
ZIP, and load that folder as an unpacked extension. Refresh Facebook tabs after
an update. Keep one production copy enabled.

Chrome retains its existing storage permission, Facebook-only host scope, and
published identity. Messenger's desktop request rules, scripting permission,
extra Messenger hosts and phone layout are included only in the Safari package.
[COEXISTENCE.md](COEXISTENCE.md) records the earlier production identity evidence
and recovery of shipped scroll behavior; its versioned results are historical.

## Behavior

- Suppress Facebook's automatic return-to-tab refresh/Home triggers, protect
  the page for four seconds after return/scrolling, and attempt to recover the
  visible post for up to fifteen seconds. Trusted clicks, typing, scrolling,
  Back and manual Reload retain their intended behavior.
- In Chrome, prevent ordinary automatic tab discarding while enabled. Safari
  lacks that capability; Facefix does not claim to prevent Safari memory eviction.
- Remove explicit Facebook/Messenger app-promotion links outside posts, forms,
  navigation, dialogs and editable content. A dedicated, promotion-only pinned
  bar is collapsed with its padding/background. JavaScript-only **Open app**
  controls require that bounded pinned-bar context. Nearby real controls or
  content keep the surrounding container visible.
- In Safari, request desktop messaging and related Facebook login/checkpoint
  pages, route old Messenger thread links to Facebook Messages, and adapt
  recognized narrow conversation panes. The normal feed keeps its native
  browser identity. Touch, media, passkeys, storage and encryption remain native.
- Unknown layouts retain normal navigation. Facefix does not replace Facebook's
  client, bypass login/security checks, or dismiss authentication dialogs.

Turning Facefix off restores owned promotion/phone styles and page identity
getters immediately. Reload open messaging tabs to apply changed request-header
or redirect behavior to the server-rendered page. Website edits made after an
owned style change are preserved during restoration.

## Diagnostics and privacy

The popup retains Facefix's real protection timers, local intervention counters,
connection/version checks and bounded failure reports. A zero timer means no
protection window is running; it never schedules a reload. Suppressed return
signals are not proof that a refresh would otherwise have happened.

Reports and counters stay on your device. Diagnostics can be disabled and
cleared independently. Promotion matching inspects candidate labels/destinations
and bounded container structure locally; Messenger layout checks structure and
composer presence, without reading or changing message drafts. No passwords,
message text, cookies, screenshots or URLs are recorded by these features. No
analytics, remote code or automatic message sending.

[Privacy policy](PRIVACY.md) · [Historical runtime evidence](RUNTIME-VALIDATION.md)

## Local development and verification

```sh
python3 scripts/check-local.py
```

When changing Messenger configuration/identity source, regenerate its request
rules and self-contained MAIN script, then update the existing native copies:

```sh
node scripts/build-messenger-rules.mjs
python3 scripts/sync-safari.py
```

`sync-safari.py --build N` additionally sets an explicitly selected native build
number. It preserves the existing app/extension identifiers, native Swift code,
team, capabilities and privacy declarations. It does not sign, install or upload.

The following optional check uses the installed Chrome Extension Test Runner
skill, Chrome for Testing and Node 22+. It loads the actual Safari web-extension
payload into an isolated Chromium profile and fulfills Facebook-origin document
requests with a project fixture, without using a Facebook account or contacting
Facebook for fixture content:

```sh
node tests/e2e/run-isolated.js
```

It checks full-bar geometry, protected content and drafts, live pause/resume,
SPA/password transitions, BFCache lifecycle, wide layouts and actual declarative
thread redirects. Chromium results are distinct from Safari/WebKit execution.
Screenshots/reports are saved under ignored `artifacts/`; owned browser profiles
and processes must both be gone after the run.

Build the native iPhone simulator app locally:

```sh
xcodebuild -project apple/Facefix/Facefix.xcodeproj \
  -scheme 'Facefix (iOS)' -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/Facefix-iOS build
```

[Safari acceptance and remaining manual checks](SAFARI-ACCEPTANCE.md) records
what each verification layer establishes. Signed-in send/receive, encrypted
history restoration, attachments, calls and the exact production Facebook
promotion markup require account-based manual acceptance.

All CI runs locally. [LOCAL-CI.md](LOCAL-CI.md) explains the disabled Actions
control and the separate legacy Pages publishing behavior. No hosted workflow,
runner, token, security-policy or protection change is needed for local checks.
