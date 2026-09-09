Summarize collected tickets for two audiences. Do not mutate Git or Confluence.

Input: `{{workflow.input}}`
Collection: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Re-read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`. Fetch the Confluence page as HTML for existing-guide comparison and top-insertion context.

Submit:

Create the complete KB report before submitting. Derive `<period>` as `YYYY-MM-DD_to_YYYY-MM-DD` from the collected Asia/Bangkok interval, then write this exact report to `/tmp/sprint-triage/<period>/ticket-summaries.md`. The report must contain the complete `# Knowledge-base (LLM)` ticket records and its `# Ledger`.

Use one compact record per summarized ticket. Do not use field headings below the ticket heading.

## Ticket <number>: <short title>
- Slack URL: <permalink>
- Inquiry summary: <request, context, and impact>
- Action taken: <investigation, mitigation, and observed outcome>
- Knowledge gained: <reusable system or process knowledge>
- Unknown gap: <unverified fact, why it matters, and a concrete falsifier>

# Ledger
- Date period of all supports: <start and end, including timezone>
- Support channels: <channel names and IDs>
- Number of tickets summarized: <count>
- Number of tickets skipped due to any issue: <count and reasons, if nonzero>

Calculate the staged report's SHA-256 after writing it. The staging file is reviewer-visible evidence: do not rewrite it after computing the hash. If it is missing, unreadable, or exceeds safe redaction limits, return `blocked`.

# Knowledge-base (LLM)
- Staged KB report:
- Path: `/tmp/sprint-triage/<period>/ticket-summaries.md`
- Integrity SHA-256: `<hash>` (integrity check; review the staged file's content, not this value)
- Ticket count: <count>
- Reviewer instruction: Review the complete per-ticket records at `Path` before approving this plan.

# Ledger
- Date period of all supports: <start and end, including timezone>
- Support channels: <channel names and IDs>
- Number of tickets summarized: <count>
- Number of tickets skipped due to any issue: <count and reasons, if nonzero>

# Human guide (Confluence)
Group only reusable guidance. Use the same compact bullet format; do not repeat ticket narratives. For every candidate guide, inspect the collected threads and all existing guidance in the fetched Confluence HTML. Treat a candidate as already handled when its operational trigger/topic or issue and its remediation steps materially overlap an existing guide. Omit an already-handled candidate; continue with every novel candidate. Do not include omitted candidates in the numbered guide list or the HTML fragment. For every retained guide, inspect the collected threads and fetched Confluence context for durable operational references. Include only verified links, such as the configured Grafana dashboard, the Confluence guide page, a GitLab permalink for a relevant job or schedule, a tracked work item, or another directly relevant operational resource.

## Guide <number>: <short topic>
- Brief description: <when this guide applies>
- Steps to take: <ordered, actionable support steps>
- Useful links: <verified label and URL list, or `None identified`>

- Existing-guide matches: <one omitted candidate topic/issue and the matching existing guide heading per line, or `None` if every candidate is novel>

Create a self-contained Confluence HTML fragment containing only retained novel guides for the publication contract. It must not contain Markdown syntax or Markdown code fences. Use `<h2>` for the sprint addendum heading; use one `<h3>` per guide; use `<p>` with `<strong>` for the guide description labels; use `<ol><li>` for ordered steps; and use `<ul><li><a href="…">…</a></li></ul>` for useful links. Use `<p>None identified</p>` when a guide has no useful links. Escape text and attributes as HTML, and include only verified absolute `https://` URLs.

## Publication contract

## Knowledge Base
- Title: <KB report title>
- Description: <one-sentence scope and audience>
- Report path: <final report path>
- Ledger path: <final ledger path>
- Index path: <final index path>
- Exact index Markdown:
```md
<complete index content>
```
- MR title: <approved title>
- MR description: <description from a verified host template>

If no MR template is verified, create the MR with no description adjustment, read back its description, then update only the managed region. Missing template is never `blocked` and requires no user confirmation; the approval gate authorizes this fallback.

## Confluence
- Confluence page: <source page title, URL, and version/hash>
- Existing-guide matches: <one omitted candidate topic/issue and matching existing guide heading per line, or `None`>
- Exact top-insert HTML:
```html
<complete approved HTML fragment containing only novel human guides>
```

The complete approval artifact ends after `## Publication contract` and its Knowledge Base and Confluence subsections.

`submit` when both products are complete.
`blocked`: missing evidence or unsafe redaction.
