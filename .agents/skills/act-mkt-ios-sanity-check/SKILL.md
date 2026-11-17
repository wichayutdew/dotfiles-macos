---
name: act-mkt-ios-sanity-check
description: Use when validating Activities iOS smoke journeys, deep links, universal links, or an MR feature with the in-app experiment controller on an iOS Simulator or connected iPhone. Applies to native iOS and web/CXP changes tested inside the iOS app.
---

# Activity iOS sanity check

Test the app actually running on the selected iPhone or simulator. Installing a package, opening a URL and observing a feature are separate checks.

## Input and output

Accept an MR URL, app channel (`production-rc` or `beta`), optional simulator/device UDID, package source and environment. Discover the channel from verified package/release metadata when available. Keep one task-owned run folder outside source repositories.

Deliver `report.md`, `run.json` and referenced screenshots/videos together. Failures require screenshots or video; retain original failed attempts after reruns.

Resolve the [e2e-journey-test repository](https://gitlab.agodadev.io/Activities/activities-marketing-tech/e2e-journey-test) from the workspace manifest and verify its Git origin. Its `src/testcases/activities/ios-release-sanity/` owns reusable scenarios and `links.json`. Use an available reviewed revision; otherwise disclose the bundled snapshot fallback. These are skill-assisted scenarios, with no registered Appium launch adapter.

## Workflow

1. Read the current MR, relevant changes, linked requirements, experiment IDs and dependent gates. Map each acceptance criterion to explicit feature cases. Read the journey repository's scenarios and compare its link catalog with [bundled runbook cases](references/smoke-cases.json); initialize from the matching source snapshot, or reconcile and record any source changes before execution. Refresh the Confluence source when accessible and disclose snapshot fallback. Assertions are proposed because the source expected-result cells are blank.
2. Read [iOS device workflow](references/device-workflow.md). Identify full Xcode and use process-local `DEVELOPER_DIR`, an explicit iOS Simulator or paired iPhone. Check runtime, build target, network, Developer Mode, signing and UI/media control. This skill uses iOS's **in-app experiment controller**; no separate Konsole app.
3. Resolve package identity and channel. Production RC uses `agoda://`; beta uses `agoda4://`. Verify the selected scheme in the installed bundle's registered URL schemes; simulator/device target and app channel are independent. A simulator requires a simulator `.app`; a real iPhone requires a correctly signed device `.app`/distribution `.ipa` with compatible provisioning. Both may be arm64 and still be incompatible. Record artifact SHA-256, bundle/version/build, CI job, source SHA and build SHA. A merged-result build is acceptable only with pipeline evidence tying it to the exact MR source. Web/CXP tests also need verified served web revision. Old, missing, expired or mismatched artifacts remain BLOCKED; an unrelated installed beta is supplemental coverage only.
4. Save the initial in-app experiment, locale, host and proxy settings. In an internal build, open Developer tools (usually shake), then Client Experiments. Apply A and B using the observed controller, finish/restart/reload as required, then reopen the controller or inspect consuming-layer diagnostics to verify the effective variant. A toggle before Done proves only the requested override. An off switch is not proof of A without its allocation contract. CXP WebView dev mode has separate host/branch/experiment settings. Preserve evidence for each effective variant and dependent combination.
5. Run link cases for the selected channel in English and Thai, cold and warm states. Preserve the original `runbook_url`; execute its `url` with only the custom scheme resolved for the channel. HTTPS URLs remain unchanged. Wrong-channel attempts are retained as diagnostics and cannot satisfy selected-channel coverage. Test HTTPS Universal Links by an external tap from Notes or another verified external source. Safari address-bar entry, `simctl openurl` and `devicectl --payload-url` are diagnostic paths, not proof of external Universal Link association. Then run App Home > Activities tile > Activities Home > search > detail > offer/date > booking form in both languages, MR A/B cases, relevant failure/empty/fallback cases, and affected smoke cases per variant. Observe destination, activity/city, currency, selection persistence and back navigation. Stop before booking submission.
6. Capture failure screenshots immediately before recovery; start short recordings before transient-failure journeys. Capture successful A/B comparisons and funnel checkpoints when practical. Use actual iPhone media for device cases; never substitute simulator captures. Logs supplement media. Record actual steps, observed result, effective variants, requirements, times and attachments in [run.json](references/results.md). Helpers never infer PASS.
7. Restore changed in-app settings, locale, host and proxy in finally-style cleanup, including interruption; record before/after evidence. Generate the report. Clearly separate app results, blocked prerequisites and helper/fixture tests. Do not publish sign-off, distribute builds, submit bookings or alter shared experiment allocation unless separately requested.

After privacy review, place a complete shareable copy under the journey repository's ignored `.artifact/test-report/<run-id>/`. When the user requests repository sign-off publication, add a versioned summary under `docs/signoffs/ios/<source-project>-<MR>/<run-date>-<channel>.md` and link sanitized GitLab uploads or approved CI artifacts. Keep binary evidence, generated reports, raw logs and app packages out of Git. Document redactions, preserve the private original and all historical verdicts, and distinguish a failed/incomplete sign-off record from release approval. See [result publication](references/results.md#journey-repository-handoff).

## Helpers

Requires macOS, Python 3.9 or newer, and full Xcode for device operations. Report generation and case initialization do not require Xcode.

Invoke `python3 <this-skill>/scripts/ios_sanity.py --help`. Resolve paths relative to this skill, not the app's cwd.

| Operation | Arguments after the helper path |
|---|---|
| Planned cases | `init --mr <MR_URL> --app-channel <CHANNEL> --out <run-directory>` |
| Simulator readiness | `--target simulator --udid <UDID> preflight` |
| iPhone readiness | `--target device --udid <IDENTIFIER_OR_UDID> preflight` |
| Bundle metadata/platform | `bundle-info <extracted.app>` |
| Simulator screenshot | `--udid <UDID> capture --out <run>/evidence/<case>-attempt1.png` |
| Simulator recording | `--udid <UDID> record --seconds 15 --out <run>/evidence/<case>-attempt1.mp4` |
| Report | `report <run>/run.json` |

Physical-device install/launch and capture procedures are in the device reference. Capability checks decide which real-device control/capture path works on this Mac; unavailable control or evidence stays BLOCKED.

`<CHANNEL>` is `production-rc` or `beta`; initialization requires an explicit selection.

## Common mistakes

- An older simulator/device screenshot or a green CI suite is not current MR device evidence.
- Preserve the source runbook URL and its path/query. Resolve only the custom scheme for the app channel; do not treat `agoda://` rejection by beta as a beta feature failure. Add labeled supplemental fixtures when an activity is unavailable.
- Do not erase simulators, uninstall apps, clear containers, bypass certificates, alter global Xcode selection or re-sign packages as recovery shortcuts.
- Use a test account and QA environment for coupon assignment. Claiming changes wallet state; record the test campaign and account scope. Do not claim promotions on a personal account without explicit scope.
- Keep credentials, signed download URLs, provisioning identities, device serials and personal account data out of shared reports/media. Inspect captures before handoff.
