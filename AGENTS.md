# Facefix project instructions

## Current direction

This project owns Facefix at `KyleStay/facefix`: Facebook page stability, removal
of website app-promotion bars, and Messenger in Safari on iPhone. Maintain the
existing Chrome extension and Safari app identities. Read `SAFARI.md` before
changing Safari packaging or native resources, and `SAFARI-ACCEPTANCE.md` before
runtime QA or an explicitly requested beta release.

Run `python3 scripts/check-local.py` for local verification. After changing
Safari runtime resources, run `python3 scripts/sync-safari.py` to update the
existing native project; do not replace its app or extension identifiers.

## Local CI and remote writes

Keep executable workflow YAML out of `.github/workflows/`; archive reference
files outside that directory. Never dispatch/rerun hosted CI or create runners
or CI credentials. Record unavailable native/browser checks as unrun.

Facefix's repository Actions execution is disabled under Kyle's local-only CI
policy. Before an authorized push or merge, verify the repository API still
reports `enabled:false` and no queued/running Actions jobs. A generated Pages
workflow record can remain marked active even while repository Actions is off.
See `LOCAL-CI.md` for the distinction from legacy static Pages publication.

Preserve Pages publishing mode, security settings and branch protection. The
older rejected Pages-mode change is not permission to retry that operation.
Keep existing signed archives and upload receipts; merging source does not
authorize another upload, TestFlight rollout or public store release.

## TestFlight rollout

Kyle’s standing instruction is to include rollout to the existing **Facefix Beta**
internal group (`5c21b794-3131-46c0-a8cf-b92e786a33dc`, app `6826421811`) whenever
he requests a TestFlight update. This includes assigning the verified new iOS
and macOS builds to that group without another routine confirmation. Verify the
current group identity and membership before rollout; new groups or recipients
need separate authorization. Preserve upload receipts and honor enforced
approval controls.
