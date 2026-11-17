# Result contract

Create one run directory:

```bash
python3 <skill>/scripts/ios_sanity.py init --mr <MR_URL> --app-channel beta --out <run>
```

This creates 32 planned link cases (8 URLs × 2 app locales × 2 launch states), 2 funnel cases, and 2 feature placeholders. These are NOT_RUN, not simulated successes. Fill feature cases from MR/Jira; append dependent combinations and impacted smoke cases to both `cases` and `required_case_ids`.

## Run metadata

`run.json` uses `schema_version=2`. Select `--app-channel production-rc` for an RC or `--app-channel beta` for beta. The helper resolves custom schemes to `agoda://` or `agoda4://`, preserving the source URI and the rest of its payload. HTTPS links are unchanged.

| Field | Required observation |
|---|---|
| `context.mr_url`, `mr_sha`, `mr_type` | Exact MR and head SHA; type `native` or `cxp` |
| `context.environment` | Effective host/environment, including overrides |
| `context.platform` | Always `ios` |
| `context.app_channel` | Verified package channel: `production-rc` or `beta`; required, independent of simulator/device |
| `context.device` | UDID, model, iOS version and simulator/device target from preflight |
| `context.app` | `bundle_id`, `version`, `build`, `sha256`, stable `source` job URL, `built_sha`, `supported_platforms`, `url_schemes` from the verified installed bundle, `bundle_sha256`, `installed_bundle_sha256`, `identity_verified`, `verification_evidence` relative paths |
| `context.web` for CXP | `branch`, served `sha` equal to MR SHA, `identity_verified`, `verification_evidence` relative paths |
| `scope.requirements` | Stable acceptance criterion IDs; cases map to them |
| `scope.experiments` | Exact IDs; use `null` while unresolved, `[]` only with `no_experiment_reason` |
| `scope.required_combinations` | MR-relevant maps such as `{"CXP-3933":"B","ACTB-2996":"A"}` |
| `scope.exclusions` | Explicitly justified non-applicable coverage; no silently removed cases |
| `settings.before` | Existing before-state evidence/checklist path |
| `settings.restoration` | `pending`, `restored` or `not_changed` |
| `settings.evidence` | Nonempty relative files proving restoration or unchanged state |

Do not copy tokens, personal data, or expiring signed download URLs into this file. Use stable CI/distribution release references.

## Each case

Record `context.device.target` as `simulator` or `device`, its `udid` and `os_version`. Record `context.app.supported_platforms` as `["iPhoneSimulator"]` or `["iPhoneOS"]`, matching the target. Native `built_sha` must equal the source head or a separately verified `context.merged_sha`. The downloaded and installed full bundle fingerprints must match; a launcher executable hash alone does not cover dynamic feature frameworks. Record `context.variant_evidence` as consuming-layer proof paths.

Keep `id`, `suite` (`links`, `funnel`, `feature`), `locale`, optional `launch_state`, original `runbook_url` and channel-resolved tested `url`. The selected scheme must appear in `context.app.url_schemes`. Fill:

- `attempt`: starts at 1. Append another case with the same ID and incremented attempt for reruns; preserve old attempts.
- `requirements`: covered acceptance criterion IDs.
- `expected`: assertion strings established before execution; resolve the feature placeholders.
- `steps`: actions actually executed, including relevant timing and transitions.
- `actual`: observed behavior, not a paraphrase of the expectation.
- `experiments`: actual verified map such as `{"ACTB-2852-IOS":"A"}`; include dependent experiments. Baseline smoke may run unforced with `{}`; do not label an unknown allocation A. Feature cases and explicitly controlled smoke cases require effective variant verification.
- `variant_verified`: true only after observing the effective consuming-layer variant. Attach its proof or reference the common context.
- `entry_method`: HTTPS link PASS requires `external_tap`. Direct URL dispatch and Safari address-bar attempts are diagnostic cases, separately recorded.
- `status`: `PASS`, `FAIL`, `BLOCKED`, `SKIPPED`, or `NOT_RUN`.
- `evidence`: relative paths beneath the run directory. FAIL requires recognizable PNG/JPEG/MP4/MOV; logs alone do not satisfy it.
- `blocker`: concrete prerequisite/skip reason for BLOCKED or SKIPPED.

Mark behavior FAIL when observed assertions fail. Use BLOCKED for prerequisites that prevent executing a case. For partially observed cases, describe the completed steps and failing assertion; do not convert an observed failure to BLOCKED because capture later failed.

## Generate and interpret

```bash
python3 <skill>/scripts/ios_sanity.py report <run>/run.json
```

Exit 0 means all recorded required cases PASS and completeness checks pass. Exit 2 means FAIL, INCOMPLETE, or invalid input. The report is still generated for valid FAIL/INCOMPLETE runs. It embeds failure images and links videos and supporting files. Keep this folder together when sharing.

The helper checks attachment existence, containment and recognizable file headers; it cannot prove visual relevance, decode every media frame, or verify that human-entered observations are true. Open captures and play recordings before handoff. Protected/blank captures do not satisfy useful evidence, even if their file format is valid. Preserve the failure, state the capture limitation, and leave POC acceptance incomplete.

If no experiment applies, replace feature A/B placeholders with actual non-experiment feature cases, update the required IDs and record `scope.no_experiment_reason`. Record that no A/B feature applies. Unavailable optional real-device validation stays explicitly unverified.

Overall FAIL preserves earlier failures for the selected channel. Exact source-preserving URLs resolved for the other channel are automatically labeled wrong-channel diagnostics: their original status/media stay visible, but they do not affect selected-channel counts or satisfy required coverage. Arbitrary path/query changes are rejected. Every required test, all A/B combinations, media completeness and cleanup must be accounted for before claiming POC completion.

For an existing version-1 run, verify the app channel and installed schemes, set `context.app_channel`, populate `runbook_url` from the source catalog, and set `schema_version=2`. Preserve each observed `url`, status and evidence. Append new selected-channel attempts rather than rewriting historical execution; missing selected-channel cases remain incomplete.

## Journey repository handoff

Use the workspace's verified `e2e-journey-test` checkout. Its reusable iOS scenarios live under `src/testcases/activities/ios-release-sanity/`; it stores generated bundles under ignored `.artifact/test-report/<run-id>/`. Keep `run.json`, `report.md` and every referenced evidence file together. This helper's report is separate from the Appium dashboard journal; do not fabricate a runner event stream or passing result during import.

Before sharing, inspect media and structured files for credentials, account data, workstation paths and device identifiers. Preserve the private original; record redactions and re-run report validation on the shared copy. Preserve case IDs, attempts, observed outcomes and failure media. A missing or unusable capture remains incomplete.

When repository sign-off publication is requested, add `docs/signoffs/ios/<source-project>-<MR>/<run-date>-<channel>.md` with build/source identity, executed scope, latest required results, historical verdict, blocked work, cleanup and stable evidence links. Upload sanitized report/media bundles to the GitLab project or use approved artifact storage. Generated reports, binary media, app packages and raw logs stay out of Git. A FAIL or BLOCKED record is published as such and never becomes release approval.
