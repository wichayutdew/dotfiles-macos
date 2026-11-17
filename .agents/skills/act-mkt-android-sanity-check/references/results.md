# Result contract

Create one run directory using exactly one target selector. An MR is optional:

```bash
python3 <skill>/scripts/android_sanity.py init --branch main --app-flavor beta --out <run>
```

Use the actual branch name (`main`, `master`, or another branch). Alternatively, use `--release-candidate <tag/version/build-reference>` or `--mr <MR_URL>` instead of `--branch`. Flavor is independent of the target selector: production RC binds `agoda://`, beta binds `agoda4://`.

Every target creates 32 planned link cases (8 URLs × 2 app locales × 2 launch states) and 2 funnel cases. MR targets also create 2 feature placeholders. All cases are NOT_RUN, not simulated successes. Fill any requested feature cases from requirements; append dependent combinations and impacted smoke cases to both `cases` and `required_case_ids`.

The helper reconstructs all 34 required smoke cases from the bundled catalog and checks every attempt’s ID binding, suite, locale, launch state and original/executed URL. Editing both manifest lists cannot reduce baseline coverage. Executed deep links follow the selected case app’s flavor; an unexecuted NOT_RUN/BLOCKED/SKIPPED template may retain the original runbook scheme, so historical skips remain reportable. Other URL parts and canonical bindings must remain unchanged.

## Run metadata

`run.json` uses `schema_version=1`.

Branch/RC targets default to smoke scope; MR targets default to full feature validation. For an explicitly requested smoke-only MR run, use `scope.mode: "smoke"`, a nonempty `feature_deferral_reason`, empty `experiments`, `requirements` and `required_combinations`, plus `no_experiment_reason`. Keep all required link/funnel cases and failure history. Archive previous feature attempts in a separate manifest and reference it in `scope.exclusions`; the report labels feature sign-off deferred. This bypasses only feature coverage gates, never build identity, failure media, required smoke coverage or settings cleanup. To validate a requested feature on a branch/RC, set full scope, define requirements/experiments and add required feature cases.

MR runs retain the existing `mr_*` fields for compatibility. Non-MR runs use `context.target` and omit MR fields. A native RC is identified by exact artifact provenance, version/build and checksum; Git SHA is optional when the distribution does not expose it. Branch targets and separately served CXP content always need a pinned full revision. Reports show the selected target, without substituting a sample MR.

| Field | Required observation |
|---|---|
| `context.mr_url`, `mr_sha`, `mr_type` (MR only) | Exact supplied MR and head SHA; type `native` or `cxp` |
| `context.target` (non-MR only) | `kind`: `branch` or `release_candidate`; `ref`: selected branch/tag/version/build; `type`: `native` or `cxp`; `sha`: full pinned commit for branch/CXP, optional for native RC |
| `context.environment` | Effective host/environment, including overrides |
| `context.device` | Serial, model, Android/API/ABI from preflight |
| `context.app` | `package`, `version`, `build`, `sha256`, stable `source` URL, `identity_verified`, `verification_evidence` relative paths proving the artifact matches the requested target and installed package |
| `context.additional_apps` | Optional map keyed by package, with the same verified identity fields for every additional APK used |
| `context.web` for CXP | `branch`, served `sha` equal to the pinned `mr_sha` or `target.sha`, `identity_verified`, `verification_evidence` relative paths |
| `scope.requirements` | Stable acceptance criterion IDs; cases map to them |
| `scope.experiments` | Exact IDs; use `null` while unresolved, `[]` only with `no_experiment_reason` |
| `scope.required_combinations` | Feature-relevant maps such as `{"CXP-3933":"B","ACTB-2996":"A"}` |
| `scope.exclusions` | Explicitly justified non-applicable coverage; no silently removed cases |
| `settings.before` | Before-state evidence/checklist path |
| `settings.restoration` | `pending`, `restored` or `not_changed` |
| `settings.evidence` | Nonempty relative files proving restoration or unchanged state |

Do not copy tokens, personal data, or expiring signed download URLs into this file. Use stable CI/distribution release references.

## Each case

Keep `id`, `suite` (`links`, `funnel`, `feature`), `locale`, optional `launch_state`, original runbook `canonical_url` and executed `url`. Record `context.app.flavor` as `production_rc` or `beta`, and retain APK-inspected `schemes`. Production RC expects `agoda://`; beta expects `agoda4://`. Flavor mapping changes only the scheme, never HTTPS URLs or other URL parts. Fill:

- `app_package`: optional package used for this case; defaults to `context.app.package`. A different package needs its own verified entry in `context.additional_apps`. The report identifies each package separately.
- `attempt`: starts at 1. Append another case with the same ID and incremented attempt for reruns; preserve old attempts.
- `requirements`: covered acceptance criterion IDs.
- `expected`: assertion strings established before execution; resolve the feature placeholders.
- `steps`: actions actually executed, including relevant timing and transitions.
- `actual`: observed behavior, not a paraphrase of the expectation.
- `experiments`: actual map such as `{"ACTB-2996":"A"}`; include dependent experiments. Baseline smoke may leave this empty and makes no A/B claim. Feature cases require every scoped experiment; affected smoke with explicit overrides requires verification of those overrides.
- `variant_verified`: true only after observing the effective consuming-layer variant. Attach its proof or reference the common context.
- `status`: `PASS`, `FAIL`, `BLOCKED`, `SKIPPED`, or `NOT_RUN`.
- `evidence`: relative paths beneath the run directory. FAIL requires recognizable PNG/JPEG/MP4/MOV; logs alone do not satisfy it.
- `blocker`: concrete prerequisite/skip reason for BLOCKED or SKIPPED.

Mark behavior FAIL when observed assertions fail. Use BLOCKED for prerequisites that prevent executing a case. For partially observed cases, describe the completed steps and failing assertion; do not convert an observed failure to BLOCKED because capture later failed.

## Generate and interpret

```bash
python3 <skill>/scripts/android_sanity.py report <run>/run.json
```

Exit 0 means all recorded required cases PASS and completeness checks pass. Exit 2 means FAIL, INCOMPLETE, or invalid input. The report is still generated for valid FAIL/INCOMPLETE runs. It embeds failure images and links videos and supporting files using absolute local paths for Codex preview. Keep this folder together when sharing; regenerate the report after moving the bundle so its paths resolve on the receiving machine.

The helper checks attachment existence, containment and recognizable file headers. When `ffprobe` is already installed, MP4/MOV also require a video stream with positive duration; a static zero-duration file does not count as video evidence. Without that optional tool, manually verify playback before using a video as evidence. The helper cannot prove visual relevance, decode every media frame, or verify that human-entered observations are true. Open captures and play recordings before handoff. Protected/blank captures do not satisfy useful evidence, even if their file format is valid. Preserve the failure, state the capture limitation, and leave POC acceptance incomplete.

If no experiment applies, replace feature A/B placeholders with actual non-experiment feature cases, update the required IDs and record `scope.no_experiment_reason`. Record that no A/B feature applies. Unavailable optional real-device validation stays explicitly unverified.

Summary counts use the highest attempt number per test. A resolved prerequisite BLOCKED attempt stays in the history but can be superseded by an executed rerun. Overall FAIL preserves any earlier failed attempt. Report final rerun outcomes separately in the case details; this conservative summary prevents silently erasing initial failures. Every required test, all A/B combinations, media completeness and cleanup must be accounted for before claiming POC completion.
