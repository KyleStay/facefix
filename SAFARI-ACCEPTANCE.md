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
