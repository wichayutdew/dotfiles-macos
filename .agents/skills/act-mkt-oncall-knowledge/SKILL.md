---
name: act-mkt-oncall-knowledge
description: Use when curating feature troubleshooting knowledge from an oncall rotation's StarRocks escalations and linked Slack threads over explicit dates, or preparing recurring oncall knowledge ingestion into Hindsight.
---

# Oncall knowledge

Maintain source-backed feature guides directly under `oncall/` in the authenticated Hindsight team bank. Invocation authorizes the scoped knowledge writes. Advance automatically through exactly **Collect → Classify → Verify → Publish**, without a runtime planning gate, sprint report, ledger, checkpoint document, Git publication or Confluence update.

Invoke `/act-mkt-oncall-knowledge ROTATION_ID START_DATE END_DATE`, for example `/act-mkt-oncall-knowledge 10189 2026-11-01 2026-11-11`. Require a positive integer rotation and two inclusive `YYYY-MM-DD` dates. Ask for missing inputs together interactively; unattended runs report missing inputs and stop. Scheduled runs supply exact dates and timezone. [config.json](config.json) persists common Bangkok date convention and page size, never rotation identity. Select all escalation statuses by `esc_start_at_str` in that interval; status is not evidence of a confirmed repair.

Run bundled Python 3.9+ scripts from this skill directory or by absolute path, from any cwd. Read the linked stages and [memory API contract](memory-api.md) before execution. No sibling skill installation is required.

| Stage | Prompt | Outcome route |
| --- | --- | --- |
| Collect | [collect.md](collect.md) | `ready` → Classify; `handoff` → retry Collect; `blocked` → report |
| Classify | [classify.md](classify.md) | `ready` → Verify; `gaps` → Collect; `handoff` → Classify; `blocked` → report |
| Verify | [verify.md](verify.md) | `ready` → Publish; `sources` → Collect; `content` → Classify; `blocked` → report |
| Publish | [publish.md](publish.md) | `ready` → done; `content` → Classify then Verify; `handoff` → reconcile/resume Publish; `blocked` → report |

The parent integrates evidence and serializes writes. Use fresh bounded workers for independent retrieval, analysis and verification when available; workers return complete evidence without publishing or recursively delegating. Keep 2–3 independent tasks running within capacity, but each pagination chain and dependent stage stays sequential. If delegation is unavailable, work inline and report the fallback; Verify still performs a separate evidence pass.

Each page contains exactly **Symptoms**, **How it works**, **Diagnosis**, **Known resolutions**, **Unresolved questions**, **Evidence**. Preserve literal source links, incident/verification dates, conditions, ownership and uncertainty. Unsupported sections state the gap. A left-joined escalation without Slack coordinates stays metadata-only and may yield an explicit no-reusable-knowledge outcome; create no inferred runbook or placeholder page.

Carry inputs, original SQL rows, reconciled counts, complete threads, escalation-to-feature outcomes, verified drafts, stable document/page/operation IDs and confirmed/remaining writes in conversation. Reread truncated evidence. Reconcile interrupted operations before retrying. Finish with affected pages, interval, escalation/thread coverage, metadata-only/no-contribution counts and failures; pending generation is not success.
