# Stage: plan

Build the plan with this skill’s [plan template](../generic/plan-template.md). The template defines the artifact structure; this prompt defines how to produce it.

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Turn reviewer findings into comments the user can approve.

Input: `the invoking request`
Findings: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Use only actionable, evidence-based findings anchored to the reviewed head. Keep the proposed published text specific, professional, and consistent with its detailed suggestion. Include every user-answerable review decision and its impact in the existing `Reviews` or `Publication contract` sections; do not ask separately. Approval feedback returns to this plan stage and the artifact is re-presented at the same review gate.

Carry each finding's severity, trigger, baseline/contract, impact and verification limits into the proposed comment. Deduplicate existing discussions and root causes. Always complete this plan step. With no findings and no requested summary publication, record the reviewed SHA, coverage and limitations using the template, set publication to None, and return `done`; no ceremonial comment or empty approval cycle is implied.

Give every publication action a stable marker and capture current review state/head plus confirmed/unconfirmed action IDs for retry reconciliation. Refresh stale evidence instead of publishing obsolete anchors.

Construct publication actions before submitting this artifact, as one `<run-dir>/actions.json` for [`scripts/publish-review.sh`](../scripts/publish-review.sh) (schema in its header): `kind`, `host`, `project`, `iid`, `expectedHeadSha` and, for GitLab, `diffRefs` copied from fetch `index.json`; per action `id`, `type`, `path`, `oldPath`, `line`, `side` (`new` by default, `old` for a removed line), the exact `body` and a stable `marker`. Every finding on a changed diff line is an `inline-comment`. Use `generic-comment` only when a valid text position is impossible, with its `reason`. An inline action has no generic fallback if it fails. In the artifact include the `actions.json` path, a table of `id | type | path:line | body`, and the ledger from `bash scripts/publish-review.sh <actions.json> --dry-run` (read-only); no placeholders.

`done`: no actionable findings and no requested summary publication; report the no-action plan locally.
`ready`: every intended comment has the required artifact content and is ready for review.
`handoff`: transient read failure.
`refresh`: head/state changed; fetch and revalidate before revising/reusing approval.
`blocked`: required safe evidence or authority cannot be obtained.


## Required ready response
On `ready` or `handoff`, put the complete proposed review-comment and publication-action ledger in `Completed`.

# Completed
<complete review plan ledger>

# Remaining
<exact remaining work, or None.>

When findings evidence is missing or incomplete (an explicit no-action result is complete), return `gaps` with exact missing fields so the workflow re-enters review.
