---
name: act-mkt-android-sanity-check
description: Use when validating Activities Android smoke journeys, deep links, universal links, or scoped features with Konsole experiments on a local emulator or connected real device. Accepts an optional MR, a main/master or other branch build, or any release candidate; applies to native Android and web/CXP content inside the app.
---

# Activity Android sanity check

Test the app actually running on the selected device. A navigation command succeeding, an override being selected, and a feature passing are different observations.

## Inputs and output

Accept a test target: an optional MR URL, a branch build (including main/master), or a release candidate identified by tag, version or distribution build reference. Also accept device serial/AVD, build source and environment. Discover missing technical details from the supplied target, CI/distribution metadata and device before asking. If the user requests the default branch, discover its actual name rather than assuming main or master. Pin a branch run to a specific successful build/revision; pin an RC to its exact artifact. Never invent or hardcode an MR. Keep all run files in one task-owned directory outside source repositories.

Select the app flavor from its distribution/build context and verify the APK binding: `production_rc` uses `agoda://`; `beta` uses `agoda4://`. Generate with `init --app-flavor production_rc|beta`. Preserve the runbook URL in `canonical_url`; `url` is the executed flavor-specific URL. Change only the deep-link scheme; preserve host, path, query and fragment. HTTPS URLs stay unchanged and require independent normal App Link resolution. A beta pass does not establish production RC coverage. A missing or conflicting APK binding is BLOCKED; never infer flavor from a package suffix alone.

Branch and release-candidate targets initialize as smoke-only runs with 34 required link/funnel cases. MR targets also include two feature placeholders. If the user narrows an MR run to smoke journeys, set `scope.mode` to `smoke` with an explicit `feature_deferral_reason`, empty feature gates and a `no_experiment_reason`. Keep links and funnel coverage required. Archive prior feature attempts separately and reference that history; never label a smoke-only result as feature sign-off. For explicitly requested feature checks on any target, use full scope and define acceptance criteria and experiment cases. Restore experimental overrides before remaining baseline smoke tests.

Helpers require Python 3.11+ and Android SDK platform-tools; APK inspection also needs SDK `aapt`. An already-installed `ffprobe` adds video playback checks.

Deliver `report.md`, `run.json`, and referenced screenshots/videos together. Keep initial failures when rerunning. A failure without screenshot/video makes evidence incomplete.

See the [beta smoke report example](references/smoke-report-example.md) for a completed run, failure/rerun history and attached media.

## Workflow

1. Resolve the requested target and build/deploy results. When an MR or feature scope is supplied, read its description, relevant diff, linked requirements, experiments and dependent gates; map acceptance criteria to explicit feature cases. A branch/RC baseline needs no MR or feature placeholders. Read [runbook cases](references/smoke-cases.json); refresh from its Confluence source when accessible, otherwise disclose snapshot use. Its assertions are proposals because the runbook's expected cells are blank.
2. Read [device workflow](references/device-workflow.md). Select one emulator or authorized real-device serial. Check SDK, Android/ABI, network, app and Konsole readiness. Use `python3 scripts/android_sanity.py --help` for helpers; resolve scripts relative to this skill, never the application's cwd.
3. Resolve build identity. Native MR: exact matching successful job/package. Branch: successful job/package pinned to that branch and commit. RC: exact release/distribution artifact matching the requested tag/version/build; record its commit if available, without requiring an MR or inventing a SHA. Web/CXP: compatible host APK plus the selected web bundle/deployment, with served SHA matching the pinned target revision. Record APK source/checksum/package/version/build and installed-version evidence for every target. A branch label alone is insufficient. Missing/expired/mismatched artifacts remain BLOCKED; do not substitute unrelated latest.
4. Save settings. For scoped experiment checks, use Konsole to apply A/B and restart. On CXP, also verify WebView host, branch and effective web experiment. Confirm values at the consuming layer with visible diagnostics or request/response evidence. If unavailable, mark affected cases BLOCKED. Derive dependent combinations from the supplied feature requirements; do not blindly enumerate unrelated experiments. Baseline smoke does not require forced A/B overrides.
5. Execute canonical links in English and Thai, cold and warm app states; external HTTPS taps must use normal Android resolution. Execute App Home > Activities tile > Activities Home > search > detail > offer/date > booking form in both languages. When feature scope applies, also execute feature A/B, relevant error/empty/fallback paths, and affected smoke cases per variant. Observe screen content, selected activity/city, currency, date/offer and back navigation. Stop before booking submission.
6. Capture failure screenshot immediately, before reset/recovery. Start a short recording before journeys with transient failures. Success A/B and funnel screenshots are preferred. ADB logs supplement media. Record actual steps, actual result, effective variants, requirement coverage, times, and evidence in `run.json`; capture helpers never mark tests PASS.
7. Restore changed experiments, locale, host and proxy in a finally-style cleanup, including interruption. Record restoration evidence. Generate the report using [result contract](references/results.md). Report FAIL, BLOCKED, NOT_RUN and evidence gaps honestly; do not claim sign-off or submit to Slack/Jira/Confluence unless separately requested.

## Helper entry points

| Operation | Command after `python3 <skill>/scripts/android_sanity.py` |
|---|---|
| Plan MR smoke and feature cases | `init --mr <MR_URL> --app-flavor <production_rc or beta> --out <run-directory>` |
| Plan branch smoke | `init --branch <main, master or other branch> --app-flavor <production_rc or beta> --out <run-directory>` |
| Plan release-candidate smoke | `init --release-candidate <tag, version or build reference> --app-flavor <production_rc or beta> --out <run-directory>` |
| Device readiness | `--serial <SERIAL> preflight` |
| APK metadata | `apk-info <APK> --aapt <SDK-aapt-path>` |
| Screenshot | `--serial <SERIAL> capture --out <run>/evidence/<case>-attempt1.png` |
| Short video | `--serial <SERIAL> record --seconds 30 --out <run>/evidence/<case>-attempt1.mp4` |
| Report | `report <run>/run.json` |

## Common mistakes

- Desktop/mobile-browser screenshots cannot establish Android native/WebView behavior.
- Package-targeted intents cannot establish normal HTTPS App Link resolution.
- An unavailable runbook activity is not permission to silently replace its canonical URL. Add a labeled supplemental fixture.
- Debug signatures and App Link verification may differ from release; record diagnostic routing separately.
- Preserve app data. Do not uninstall, clear app data, force-approve link domains, install certificates or alter global experiment allocation as a recovery shortcut.
- Use a test account. Keep credentials, signed download URLs and personal data out of reports and shared media.
