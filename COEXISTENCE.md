# Facefix 1.4.2 candidate: standard identity replacement

The primary delivery is a normal Chrome Web Store package plus a verified same-ID unpacked replacement candidate. No custom election, lease, peer messaging, ownership endpoint, new permission, or page-based takeover code is included. An exploratory cooperative-runtime draft was stopped by the latest instruction, archived separately at `../draft-cooperative/`, and excluded from every canonical package.

## Versions and identity evidence

Source base: public `KyleStay/facefix` main commit `375a65add3b870d59a365a0afd2e09970c5eb29d`, source version 1.4.0. The registry holds cloud project `g-p-6ad8c94d14a481918df5947f46dcb5aa` and no local root; work is confined to this isolated clone.

Read-only inspection of the matching product's on-disk Brave manifests found 1.4.0 and 1.4.1 directories. The 1.4.1 manifest names Facefix and contains a public key whose SHA-256-derived extension ID exactly matches documented listing `kckhpinnhkjfblkalloabaiihpdmklla`. During that initial identity check only matching manifest metadata/public key were read; no profile writes, cookies, history, credentials, or runtime source were accessed at that stage. The subsequently authorized runtime comparison is recorded below. Directory presence does not prove the browser currently runs either version. Evidence: `../evidence/installed-identity.json`.

The initial 1.4.1 candidate was therefore superseded by **1.4.2**, which sorts above both observed versions. A publisher dashboard/current draft version check is still required before upload. The later authorized read-only comparison of the exact installed 1.4.1 runtime closed the source-parity blocker: scrolling preserves reload/Home protection while ending position recovery, timer copy explains that behavior, and four shipped PNG icons are preserved byte-for-byte. Other runtime files match. Candidate code matches the installed runtime except reported guard version 1.4.2; manifests match after excluding version and store-generated key/update_url metadata. See `../evidence/installed-1.4.1-reconciliation.json` for the exact per-file hashes and code diff.

## Three package modes

From this source folder:

```bash
python3 build.py
python3 build.py --mode replacement --production-public-key identity/production-public-key.txt
python3 build.py --mode development
```

- `dist/facefix-1.4.2-store.zip`: normal upload candidate for the **existing** Facefix listing. Its manifest preserves original production identity fields and permission set, with no development key. Do not create a new listing to replace the existing one. Nothing was uploaded.
- `dist/facefix-1.4.2-replacement.zip`: same production ID `kckhpinnhkjfblkalloabaiihpdmklla`, pinned by the verified public key. The builder rejects missing, malformed, or mismatched keys. This is the primary local development path for avoiding a second Facefix identity where the browser supports unpacked replacement. Verify the browser actually replaced the same ID rather than assuming it did. Policies, store install state, and signed upgrade behavior remain untested.
- `dist/facefix-1.4.2-development.zip`: optional fixed separate identity `gplmbegjehlcfnpecikkgidhcllflmap`, visibly named Development. It permits a stable parallel installation, **not deconfliction**; both IDs may operate on Facebook. It is not the recommended path when testing replacement of installed production.

Only public keys are retained. No private key is stored or packaged. The normal store ZIP remains the normal publisher workflow; an unpacked replacement ZIP is not a store-signed update.

## Upgrade and lifecycle instructions

Use an owned disposable Chrome for Testing profile for validation. Same-ID replacement is a browser identity/install operation; no extension-management permission or production disabling is used by this code.

For an already loaded unpacked Facefix, update the files in its existing loaded folder and use the browser's normal Reload action. For a store installation, test the verified replacement route in a disposable profile and confirm the ID remains `kckhpinnhkjfblkalloabaiihpdmklla` and only one Facefix installation exists. If the browser rejects replacement or creates a different instance, stop that check and record the result; do not alter the real production profile.

**Refresh every existing Facebook tab after any replacement/update/reload.** Existing MAIN-world page hooks persist in documents and cannot be removed retroactively by the new extension package. Standard navigation/page reload removes the old hooks and installs 1.4.2. This is also required for older installed builds with no cooperation protocol. A higher version under a different ID does not replace them.

The on/off setting remains user-controlled; a pause does not elect another extension. Existing DOM page settings/diagnostics are best-effort page hooks, not authenticated instance ownership. No DOM or postMessage is used to authorize retiring another extension instance because no runtime retirement mechanism is present.

## Verification and remaining runtime work

Passed for the final simple candidate: **21 Node tests** (18 existing plus three shipped-scrolling regressions), **4 package tests**, syntax checks for all runtime JS, deterministic archives, numeric version ordering, production public-key ID verification, manifest/resource/CRC checks, unchanged permissions/hosts/update-feed fields, and absence of custom ownership files/endpoints. Source tests cover pausing, normal guard expiry/user interaction, worker restart persistence, tab protection, connection versions, and diagnostics; they are not installed-browser evidence.

The earlier permission-free runner attempt was denied at `/bin/ps` owner preflight before any browser/profile allocation; fixture sockets were also denied in this environment. No denied route was retried, escalated, or bypassed. Final 1.4.2 browser tests are **unrun**. No task browser, profile, or fixture server was allocated. Global process inventory is unavailable at the same sandbox boundary.

Required user-executed runtime acceptance (in a permitted disposable environment) is in [RUNTIME-VALIDATION.md](RUNTIME-VALIDATION.md). Check normal install/update identity, both install orders, same-folder Reload, Facebook tab refresh, popup/page versions, persistence, pause/resume, scrolling/navigation, browser and worker restarts, SPA navigation and frames. Separate-ID production/dev behavior is explicitly unsupported for automatic takeover. No Firefox/Safari package is supplied. Chrome 111+ is the declared target; Brave/Edge compatibility is unverified.

State: source/package checked; **not browser-replacement verified, signed-update verified, upload approved, or store approved**. No original repository edit, commit, push, publication, installed extension disable/uninstall, production feed change, or security/credential change occurred.
