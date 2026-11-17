---
name: act-mkt-triage-knowledge
description: Use when triaging a sprint of support tickets, refreshing feature troubleshooting knowledge from Slack support threads, or preparing recurring support-knowledge ingestion for any team's OpsBot support profile.
---

# Triage knowledge

Maintain source-backed feature knowledge in Hindsight directly under `triage/`. Invocation authorizes the scoped memory publication; advance automatically through exactly four stages. Ask for missing inputs interactively; unattended runs report missing inputs without guessing or waiting. No runtime plan approval, report, index, ledger, checkpoint document, Git mutation or Confluence publication is required.

Run bundled scripts from this skill directory or use absolute paths. The skill works from any cwd. Read every linked stage and [memory API contract](memory-api.md) before execution.

## Inputs and outcomes

Invoke `/act-mkt-triage-knowledge PROFILE START_DATE END_DATE`, for example `/act-mkt-triage-knowledge activities_marketing_triage 2026-11-01 2026-11-07`. Require the profile and two inclusive `YYYY-MM-DD` dates from invocation. [config.json](config.json) persists the channel ID (currently `C04SM1C4BNH`), IANA timezone and common OpsBot settings; it contains no support profile. Change the persisted channel explicitly when configuring another support channel. Do not discover channels or infer a profile. Collect tickets marked `done` during that interval, using `done_at` regardless of when they were opened. Never infer collection dates from page timestamps. Scheduled invocations supply the profile and exact sprint dates; timezone comes from configuration.

| Stage | Prompt | Outcome route |
| --- | --- | --- |
| Collect | [collect.md](collect.md) | `ready` → Classify; `handoff` → retry Collect; `blocked` → report |
| Classify | [classify.md](classify.md) | `ready` → Verify; `gaps` → Collect; `handoff` → Classify; `blocked` → report |
| Verify | [verify.md](verify.md) | `ready` → Publish; `sources` → Collect; `content` → Classify; `blocked` → report |
| Publish | [publish.md](publish.md) | `ready` → done; `content` → Classify then Verify; `handoff` → reconcile/resume Publish; `blocked` → report |

The parent owns integration and ordered remote writes. Use fresh bounded workers for independent thread retrieval, ticket analysis and verification when available; workers return complete evidence and do not recursively delegate or publish. Keep 2–3 independent tasks running within capacity. Pagination chains and dependent stages stay sequential. If delegation is unavailable, work inline and record the fallback; Verify still performs a separate evidence pass.

## Knowledge output

Each feature page has exactly these required sections: **Symptoms**, **How it works**, **Diagnosis**, **Known resolutions**, **Unresolved questions**, **Evidence**. Keep source links, incident dates, last verification dates, applicability conditions and ownership. Unsupported sections explicitly say no verified knowledge is available. A ticket's closure is not proof that its cause or fix was confirmed.

Carry the current request, resolved inputs, complete collection and thread evidence, ticket-to-feature assignments, verified drafts, stable identities, observed page/operation IDs, confirmed writes and remaining work in conversation. This is execution context, not a file to publish. Reread truncated sources. A tool call or summary does not prove completion. Reconcile interrupted writes before retrying; report pending generation separately from successful readback. Finish with affected page names/IDs, interval, ticket coverage and specific failures. With zero tickets, report no changes and create no placeholder page.
