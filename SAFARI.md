# Facefix for Safari

## Existing product

Use `apple/Facefix/Facefix.xcodeproj`, with the **Facefix (iOS)** and **Facefix
(macOS)** schemes. Preserve containing app `co.staytech.facefix.safari`, extension
`co.staytech.facefix.safari.Extension`, and team `TF2BG2VDPD`. Safari requires 18+;
iPhone/iPad require iOS/iPadOS18+, and Mac requires macOS13+ with Safari18+.

Version **1.6.0** is uploaded and **Testing** in the existing **Facefix Beta**
internal group: **iOS build5** and **macOS build6**, verified October26,2026.
The Apple app record is `6826421811`. That release used project default build5;
the Mac archive used `CURRENT_PROJECT_VERSION=6`. Release receipts and package
hashes are in `artifacts/testflight-1.6.0-20261026/release.json`; archives/exports
are in `build/TestFlight-1.6.0/`. Preserve them and never reupload accepted builds.
The earlier iOS1.5.0(3) and Mac1.5.0(4) builds are processed and superseded; their
original archives and receipts remain outside this checkout. Before a future
requested update, inspect Apple's current builds and choose unused numbers.

The current source candidate is **1.6.1/build7**, not uploaded. It broadens app-bar
detection to dedicated bottom flex footers with plain-text controls, requests
Facebook subdomain access from Open Messages, and canonicalizes legacy mobile
inbox links. Phone clicks into Messages use a new desktop document request
instead of retaining the feed's mobile SPA state. See `SAFARI-ACCEPTANCE.md` for
the candidate's verification limits; the user's signed-in screenshots exposed
gaps that the1.6.0 fixture/smoke checks had not covered.
Its signed iOS archive and locally exported IPA are in
`build/TestFlight-1.6.1/ios-build7/`; signature, identities, versions and all24
runtime resource hashes are verified. The preparation receipt and remaining
account checks are in `artifacts/facefix-1.6.1/prepared.json`. Upload and rollout
remain separate from this local preparation.

The unpublished Messenger prototype used another identity. Its code has been
adapted into Facefix; do not ship a second containing app or replace Facefix's
existing Apple records with that prototype identity.

## Runtime contract

The existing ManifestV3 service worker/importScripts behavior is retained.
Safari supports extension service workers from15.4; this package has an explicit
Safari18 minimum for MAIN-world content scripts.

Safari packaging adds `declarativeNetRequestWithHostAccess` and `scripting`, plus
explicit Messenger hosts, to Facefix's existing storage/Facebook scope. Chrome
packaging keeps its existing permissions and identity. Safari request rules
operate only on messaging/Messenger and related Facebook login/checkpoint
requests. Normal feed documents retain their native user agent.

The registered MAIN script is self-contained and installed at document_start;
its route-aware getters preserve native identity outside Messages. The worker
updates persistent registration definitions when source changes. The existing
Facefix enabled setting controls request rules, registrations and live page
cleanup. Request/server-rendering changes require reloading the message tab.
The phone layout remains isolated from page script and restores on pause, route
exit, password forms and wide screens.

The guard forwards a lifecycle notification before suppressing Facebook's
persisted pageshow event. Isolated modules reread real extension storage rather
than trusting page-provided settings. This lets promotion/layout observers
resume after BFCache restoration without reintroducing Facebook's refresh signal.

## Build and synchronization

```sh
node scripts/build-messenger-rules.mjs
python3 build.py --mode safari
python3 scripts/sync-safari.py
python3 scripts/check-local.py
```

The Safari ZIP is allowlisted runtime input. Native Resources are copied from
that exact payload. `sync-safari.py` verifies both Apple identities, registers
new resources in both extension build phases, preserves native code/capabilities,
updates marketing version and writes current resource hashes to
`apple/safari-build-input.json`. `--check` verifies without editing source.
Historical beta metadata is separate from the current release receipt in
`testflight_release`.

`prepare-safari.py` is for a new explicitly identified project only; it refuses
an existing output. Do not use it to replace the existing Facefix product.
`prepare-testflight.py` handles newly generated projects against the reviewed
native template and is not an in-place release updater. The current native Swift
sources/privacy declarations are retained; this landing authorizes no asset,
provisioning, upload or distribution operation.

## Promotion scope

Explicit Facebook/Messenger deep links and exact App Store product IDs are
recognized with app-promotion labels. A JS-only or plain-text Open app control
is removed only in a small promotion-only bottom region, including fixed,
sticky and ordinary flex footers. Such wrappers collapse as a whole; posts,
editable content, forms, dialogs and real navigation prevent ancestor collapse.
A navigation wrapper containing only app-promotion controls may collapse.
Recycled wrappers are restored when real content/control roles appear.
Pause restores original display values/priorities while preserving later edits.

Safari-owned banners and universal-link UI are browser controls. Removing a
website bar or metadata is not proof of controlling those native surfaces. The
supplied earlier screenshot alone did not identify its DOM; exact signed-in
production markup remains a manual acceptance item.

[Acceptance checks](SAFARI-ACCEPTANCE.md) · [Local CI](LOCAL-CI.md)

[Apple Safari optimization and MV3 guidance](https://developer.apple.com/documentation/safariservices/optimizing-your-web-extension-for-safari)
· [WebKit Safari15.4 service workers](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)
