Collect every configured OpsBot ticket and its Slack thread. Read-only.

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

## Handoff

Handoff:
- validated OpsBot API configuration, requested local dates, and calculated UTC boundaries;
- exact non-secret API parameter values;
- source-row, duplicate-link, and selected-link counts;
- complete selected ticket rows in API order;
- every retained Slack thread message in chronological source order; and
- factual retrieval failures or skip reasons.

Do not summarize, title, classify, infer a resolution, explain a ticket, or reconcile results outside the API response and Slack-thread evidence. Return `blocked` rather than silently truncating required evidence when it cannot fit within the workflow handoff limit.

`ready`: complete API ticket rows plus complete Slack MCP thread evidence.
`handoff`: transient API transport or Slack MCP failure.
`blocked`: invalid configuration or dates, persistent API failure, invalid API response, missing/malformed ticket link, malformed Slack permalink, persistent Slack MCP failure, or required evidence exceeding the handoff limit.
