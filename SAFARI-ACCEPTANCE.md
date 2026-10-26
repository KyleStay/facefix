# Safari acceptance

Candidate1.6.1, native build7. App `co.staytech.facefix.safari`, extension
`.Extension`, team `TF2BG2VDPD`. This is source integration, not a release upload.

## Verification layers

- `python3 scripts/check-local.py`: Node source regressions, package/native-input
  tests, native resource/version/identity agreement, generated rules/MAIN script,
  syntax and whitespace. These checks run offline and do not establish browser
  or account behavior.
- `node tests/e2e/run-isolated.js`: actual extension worker, persistent MAIN
  registration, declarative redirect and content scripts in a disposable
  Chromium profile. A project fixture is fulfilled at Facebook/Messenger
  origins to exercise real manifest matching, without an account or Facebook
  fixture-content requests. It checks pinned wrapper geometry, navigation/posts/
  forms/editable content, draft/selection preservation, pause, SPA/password
  transitions, BFCache forwarding and wide layouts. Results/screenshots and
  cleanup receipts are in `artifacts/browser-qa/`.
- Native Xcode builds: compile/package the existing iOS and Mac wrappers. Normal
  simulator signing is used for iOS. An unsigned Mac compile is source/build
  evidence only, not Gatekeeper, signed installation or App Store readiness.
- Actual Safari simulator/device execution: record exact app/version/build,
  OS/device and observed popup/registration/page-identity results separately.
  A successful Chromium fixture or compile must not be reported as Safari QA.

The older `tests/app-prompts-fixture.html` and its prior denied local-file browser
attempt are historical evidence. This work does not retry that file route or
claim its eight old assertions ran. The new fixture/runner exercises this
candidate through the independently permitted isolated-browser route.

## Signed-in manual acceptance

On Safari18+ (iPhone/iPadOS18+, or macOS13+ with Safari18+):

1. Enable Facefix and grant Facebook access through normal Safari controls.
   Allow Messenger too if using legacy links. Open Messages from the extension.
2. Sign in directly on Facebook. Verify sending/receiving, encrypted-history PIN
   recovery, attachments and keyboard/composer behavior on your account.
3. Inspect the actual pinned app control's markup. Confirm a website promotion
   wrapper disappears with its chrome/padding while adjacent chat/feed controls
   remain. Classify browser-owned controls separately.
4. Pause/resume Facefix. Verify owned styles/getters restore immediately; reload
   message tabs for changed request/header behavior. Enter/leave Messages via
   SPA navigation, Back/Forward and background/foreground transitions.
5. Verify feed return/scroll protection, Home/Back, manual Reload, login/security
   redirects, editable drafts and post links remain intentional and usable.
6. Repeat on iPad/wide layouts and Mac Safari. Safari memory eviction cannot be
   prevented through Chrome's autoDiscardable capability.

No account message is sent automatically by the extension or these local tests.
Existing beta upload/processing records remain historical; a future TestFlight
request must verify them before considering any additional upload.

## Repeatable simulator smoke test

Install the app on a dedicated simulator and open
`https://www.facebook.com/messages/` with `xcrun simctl openurl`. Generate the
runner with `xcodegen generate --spec tests/iOS/project.yml`, then run
`xcodebuild -project tests/iOS/FacefixQA.xcodeproj -scheme FacefixQA -destination
'platform=iOS Simulator,id=<owned-UDID>' -derivedDataPath build/Facefix-QA test`.
It enables Facefix through Safari's normal controls, grants access only to the
current website, checks successful setup, opens Messages, and checks page-visible
identity. It does not log in or send messages. Use a dedicated unsigned-in
simulator; this test changes its Safari extension permission.

## October 26 candidate result

The previous version1.6.0/build5 passed the native Safari smoke test on the dedicated iPhone17
Pro simulator with iOS26.2 (UDID685B8E70-31F2-4288-9DBF-22B70DF44E8B).
Setup succeeded, Open Messages reached Facebook’s desktop login page, and Check
This Tab reported desktop identity on the real `login.php?next=…/messages/`
redirect. One XCTest passed with zero failures. The task-local receipt is
`artifacts/landing-20261026/safari-qa-loginphp.xcresult` and its adjacent log.
Qorvex’s agent port was occupied by another project; background XCTest was used
without interrupting that session or the user’s desktop.

Local CI passed43 Node and15 Python tests. Eight disposable Chromium extension
scenarios passed, with no runtime exceptions and zero remaining browser PIDs or
profile directories. All58 generated request rules translated without errors
using the installed WebKit compiler. iOS Simulator and unsigned macOS builds
passed. This does not establish signed-in message delivery, attachments,
encrypted-history recovery, the exact production app bar, or Mac Safari runtime.
No beta/store build was uploaded.

## 1.6.1 mobile regression checks

The reported production screenshots show a bottom Open app promotion and the
mobile Messages app-only landing page. The exact signed-in DOM and account
behavior are unavailable locally. The new implementation handles a non-fixed
flex footer, plain span/div CTA, deeper wrappers and a promotion-only navigation
wrapper while preserving real links/posts/forms and pause restoration. It also
requests Facebook host access from the popup and forces a desktop document
request when entering Messages from a phone feed; legacy messages.php and
messenger routes canonicalize to www.facebook.com/messages.

Local CI passes45 Node and15 Python tests. Eleven disposable Chromium extension
scenarios pass, including flex footer recycling, desktop message entry from a
mobile feed, and a real declarative redirect from messages.php. Runtime errors
and remaining task browser PIDs/profiles are zero. All108 generated rules
translate through the installed WebKit compiler without errors. These checks
do not establish signed-in message delivery or removal of the exact production
bar. Native Safari results are recorded separately below when available.

The1.6.1/build7 Safari smoke passed on the dedicated iPhone17 Pro/iOS26.2
simulator (UDID02C6EBAE-C95C-4935-9670-88E4A1E2F8B7): setup, Open Messages,
Facebook access request and desktop page identity on the real login redirect.
One XCTest passed with zero failures in `artifacts/safari-161-qa.xcresult`;
screenshots are in `artifacts/safari-161-attachments/`. Qorvex's fixed agent port
belonged to another project's simulator, so the existing background XCTest
runner was used without disturbing that agent or the desktop. A subsequent
standalone-button detection adjustment was covered by the final Chromium run;
the native smoke does not exercise production app bars. iOS Simulator and
unsigned Mac builds pass. Source/native identifiers and privacy/native Swift
sources are retained. No1.6.1 upload or rollout has occurred.
