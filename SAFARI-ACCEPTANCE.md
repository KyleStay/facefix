# Safari acceptance

Candidate1.6.0, native build5. App `co.staytech.facefix.safari`, extension
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

Version1.6.0/build5 passed the native Safari smoke test on the dedicated iPhone17
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
