Collect every configured OpsBot ticket and its Slack thread. Do not mutate OpsBot, Slack, Git, or Confluence; write only the local evidence file required below.

Input: `{{workflow.input}}`

Read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`. All API parameters come only from its `opsbot` configuration. Do not hardcode a channel, profile, ticket status, person, request topic, ticket date field, or ticket example.

## Ticket collection

1. Validate that `opsbot.channelId`, `opsbot.supportProfile`, `opsbot.ticketStatuses`, `opsbot.includeAllUnclosed`, `opsbot.user`, and `opsbot.timeZone` are present and valid.
2. Require `workflow.input` to provide an inclusive start and end calendar date in `YYYY-MM-DD` format. Interpret those dates in `opsbot.timeZone`.
3. Convert the start of the start date and the end of the end date to RFC3339 UTC instants. For example, an Asia/Bangkok interval of `2026-08-10` through `2026-08-21` becomes `2026-08-09T17:00:00.000Z` through `2026-08-21T16:59:59.999Z`.
4. Convert `opsbot.includeAllUnclosed` to `1` or `0`. Join `opsbot.ticketStatuses` with commas.
5. Call the OpsBot dataset API with `curl` only. Use this exact request shape, substituting only validated configuration values and calculated UTC values:

```bash
curl --silent --show-error --location --max-time 20 --get \
  'https://opsbot.agodadev.io/api/ticket_insight/dataset' \
  --data-urlencode "channel_id_list=${channelId},-" \
  --data-urlencode "profile_id_list=${supportProfile}" \
  --data-urlencode "include_all_unclosed=${includeAllUnclosed}" \
  --data-urlencode "start_date=${startUtc}" \
  --data-urlencode "end_date=${endUtc}" \
  --data-urlencode "ticket_status_list=${ticketStatuses}" \
  --data-urlencode "user=${user}"
```

6. Treat a nonzero `curl` exit code, non-2xx response, invalid JSON, or a response without a `rows` array as `handoff` for a transient transport failure and `blocked` for a persistent or schema/configuration failure. Report the factual error without credentials.
7. Treat returned `rows` as the authoritative ticket set. Do not locally filter by `last_activity_time`, creation time, request topic, assignee, requester, status, or any other ticket field.
8. Deduplicate nonempty `ticket_link` values in returned row order. Record source-row count, duplicate-link count, selected-link count, every selected link, and the full source row for each selected link. A missing or malformed `ticket_link` is `blocked`; do not reconstruct ticket membership from another source.

## Slack thread retrieval

For each selected ticket link:

1. Parse the Slack channel ID from `/archives/<channel-id>/`.
2. Parse the root message timestamp from `/p<seconds><microseconds>` by inserting a decimal point before the final six digits.
3. Call `slack_slack_get_thread_replies` with the parsed `channelId`, `threadTs`, and its maximum permitted page size.
4. Continue with the returned cursor until all pages have been read.
5. Preserve every returned message in chronological source order, including timestamp, author, text, links, and supported formatting.

Do not use OpsBot thread MCP, Grafana MCP, Slack HTTP, or Slack search as a fallback. A malformed permalink, missing thread root, or persistent Slack MCP retrieval failure is `blocked`.

## Required evidence file and ready response

The workflow completion protocol permits only compact plain-text `completed` items. Therefore, do **not** put source evidence, Markdown, fenced JSON, tool-activity bullets, a permalink, a retrieval status, or a prose synopsis in the handoff. They are not evidence and are insufficient for `ready`.

After all selected threads have been retrieved, write exactly one canonical JSON file at `/private/tmp/sprint-triage/{{run.id}}/collection.json`. Preserve source values verbatim. JSON escaping of characters such as Slack-text newlines is required and preserves the source value after parsing.

The top-level JSON object must contain exactly these evidence fields:

```json
{
  "schemaVersion": 1,
  "runId": "{{run.id}}",
  "opsbot": {
    "channelId": "<validated value>",
    "supportProfile": "<validated value>",
    "ticketStatuses": ["<validated value>"],
    "includeAllUnclosed": true,
    "user": "<validated value>",
    "timeZone": "<validated value>"
  },
  "interval": {
    "startLocalDate": "YYYY-MM-DD",
    "endLocalDate": "YYYY-MM-DD",
    "startUtc": "RFC3339 UTC instant",
    "endUtc": "RFC3339 UTC instant"
  },
  "apiParameters": {
    "channelIdList": "<non-secret request value>",
    "profileIdList": "<non-secret request value>",
    "includeAllUnclosed": "0 or 1",
    "startDate": "RFC3339 UTC instant",
    "endDate": "RFC3339 UTC instant",
    "ticketStatusList": "<non-secret request value>",
    "user": "<non-secret request value>"
  },
  "counts": {
    "sourceRows": 0,
    "duplicateLinks": 0,
    "selectedLinks": 0
  },
  "tickets": [
    {
      "ticketLink": "<selected ticket_link>",
      "sourceRow": { "<complete source row field>": "<source value>" },
      "slackThread": {
        "pagesRead": 1,
        "complete": true,
        "messages": [{ "<every supported returned message field>": "<source value>" }]
      }
    }
  ]
}
```

The example defines shape only; do not omit, summarize, rename, normalize, or infer source-row or Slack-message fields. `tickets` must be in selected-link order. Each selected ticket must have its full source row and all returned Slack messages in chronological source order. Set `pagesRead` to every Slack MCP page read and `complete` to `true` only after its cursor is exhausted. `counts.sourceRows`, `counts.duplicateLinks`, and `counts.selectedLinks` must equal the actual collection values; `tickets.length` must equal `counts.selectedLinks`.

Before returning `ready`, reread the exact written file, parse it as JSON, verify all required top-level fields and ticket/thread requirements above, verify its `runId` equals `{{run.id}}`, and calculate its byte count and SHA-256. The SHA-256 must be lowercase hexadecimal and calculated after the final write; do not rewrite the file afterward.

Return exactly one plain-text `completed` item in this form, replacing every placeholder:

```text
Evidence file: path=/private/tmp/sprint-triage/{{run.id}}/collection.json; sha256=<lowercase 64-hex digest>; bytes=<decimal byte count>; tickets=<selected-link count>.
```

`ready`: the evidence file exists, is readable and valid JSON, contains complete required evidence, passes the required correspondence checks, and the sole completed item is the exact verified locator above. Do not return `ready` merely because no active-step work remains or a delegated child ended.
`handoff`: transient API transport or Slack MCP failure.
`blocked`: invalid configuration or dates, persistent API failure, invalid API response, missing/malformed ticket link, malformed Slack permalink, persistent Slack MCP failure, failure to write/read/parse/hash/validate the evidence file, or incomplete evidence. Do not return `ready` when required evidence cannot be persisted and verified.
