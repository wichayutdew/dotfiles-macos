# Stage: plan

## Pi profile

- Role: `planner`
- Model: `gateway/gpt-5.6-terra`
- Thinking: `high`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Summarize collected tickets for two audiences. Do not mutate Git or Confluence.

Input: `the invoking request`
Collection locator: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

## Required collection-evidence validation

The compact collection locator is not source evidence. Before fetching Confluence, composing any summary, or submitting an approval artifact, extract **exactly one** locator from `{{last.summary}}` with this exact form:

```text
Evidence file: path=/private/tmp/sprint-triage/<run-id>/collection.json; sha256=<lowercase 64-hex digest>; bytes=<decimal byte count>; tickets=<decimal>.
```

Reject a tool-activity-only handoff, any prose summary, a missing/duplicate/malformed locator, a path outside `/private/tmp/sprint-triage/`, or a path whose run-ID segment does not equal `{{run.id}}`. Do not use ticket links, row values, Slack text, or an earlier summary outside the evidence file as a fallback.

Read the specified file and treat it as the sole authoritative source for ticket and Slack-thread content. Recalculate its SHA-256 and byte count, then require exact matches with the locator before parsing JSON. Parse the JSON and require all of the following before continuing:

1. Top-level `schemaVersion` is `1`; `runId` equals `{{run.id}}`; and `opsbot`, `interval`, `apiParameters`, `counts`, and `tickets` exist.
2. `opsbot.datasetEndpoint` is an absolute `https` URL that exactly matches the currently configured value; `interval` has the requested inclusive local dates and UTC instants calculated in `opsbot.timeZone`; the remaining `opsbot` values match the current configuration; and `apiParameters` matches the non-secret API request values.
3. `counts.sourceRows`, `counts.duplicateLinks`, and `counts.selectedLinks` are nonnegative integers; `tickets` is an array; and `tickets.length` equals `counts.selectedLinks` and the locator ticket count.
4. Every ticket has a nonempty unique `ticketLink`, its complete `sourceRow` object, and a `slackThread` object with a positive integer `pagesRead`, `complete: true`, and a complete `messages` array.
5. Ticket order matches selected-link order. Each message array is in chronological source order and retains every supported returned message field, including source text, author, timestamp, links, and formatting when returned.

Use `sprint-triage.yaml` in this skill directory only after that validation succeeds. If it is absent, ask the user to create it from `sprint-triage.example.yaml`, replace every placeholder locally, and keep the concrete file uncommitted.

The approval artifact retains every exact heading required by `SKILL.md`. Its `## Publication fragment` must contain exactly one of these decisions:

- one fenced `html` block containing non-empty approved markup for a Confluence top append; or
- the exact text `None`, which is an approved intentional Confluence skip.

When proposing a non-empty fragment, validate the configured Confluence target, require `appendMode: top`, fetch the current page as HTML for guide comparison, and record the page version or content-integrity evidence in `## Execution contract`. Block a non-empty fragment when the target or integrity evidence is unavailable. A `None` fragment needs no Confluence fetch and must remain explicit in the approval artifact.

`## Execution contract` must also name the knowledge-base worktree and topic-branch expectation, the expected committed artifact verification, and `gitlab.targetBranch` as the MR target.

`ready`: validated evidence-file source data, a complete approval artifact with either a non-empty fragment or `None`, and the required publication contract are ready for review.
`gaps`: the collection locator or evidence file is missing, generic/tool-activity-only, malformed, outside the permitted path, unreadable, hash- or byte-count-mismatched, invalid JSON, or incomplete/unverifiable structured collection evidence; it must be recollected before planning can continue. Report the factual failed validation in `remaining`.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: unsafe redaction or another user decision is required; put the question in `remaining`.
