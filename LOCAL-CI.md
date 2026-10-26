# Local verification

Run `python3 scripts/check-local.py`. It checks source/native resource agreement,
request-rule generation, Node tests, Python package/native-input tests, JavaScript
syntax and whitespace. It performs no network, signing, provisioning or upload.
Browser and iPhone execution are separate local acceptance checks.

Executable GitHub workflow YAML is prohibited. No checked-in workflow needed
migration; GitHub's `pages-build-deployment` record is generated dynamically and
has no source YAML to archive. Keep any future historical workflow references
outside `.github/workflows/`.

## Generated Pages workflow control

On October 26, 2026, Actions execution for `KyleStay/facefix` was disabled through
the repository Actions permissions API. Readback confirmed `enabled:false` and
zero queued or running jobs. The Pages source remains legacy `main:/`, with
HTTPS enabled; security settings and protection rules were unchanged.

Before remote writes, confirm the Actions control remains disabled. GitHub states
that disabling Actions means no workflows run in the repository. The generated
Pages workflow can still appear active in the workflow inventory; its record
alone does not establish execution permission.

This is a CI control, not a Pages-mode change. GitHub separately documents direct
static publication of a `.nojekyll` source when Actions is disabled. The existing
Pages site may therefore still publish static source changes without Actions.
Do not claim that Pages publication is disabled or retry the older rejected
Pages-mode modification. No push was used to test whether hosted CI would run.

[Repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
· [REST control](https://docs.github.com/en/rest/actions/permissions#set-github-actions-permissions-for-a-repository)
· [Direct Pages publication exception](https://github.blog/changelog/2024-07-08-pages-legacy-worker-sunset/)
