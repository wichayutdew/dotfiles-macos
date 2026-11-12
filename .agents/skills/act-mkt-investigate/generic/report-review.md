# Report review in the active conversation

Read the latest canonical report and preserve user edits. Save the complete current report as Markdown under the bound task root, or retain an explicit canonical destination with a local copy. Record its absolute path, version or digest, current scope, resolved feedback, open limitations and acceptance state in `.task-context.json`. A local report does not authorize hosted publication.

Present the report in the active conversation in this order:

1. The direct answer or proposed decision in one sentence.
2. A compact findings/evidence/limitations table and a small Mermaid diagram when it clarifies the flow; use a numbered flow if rendering is unavailable.
3. The complete saved report link and the focused questions or corrections needed from the user. Show the decision-critical explanation in the conversation; do not hide it behind a file link or paste internal checkpoints into the review.

Match the requested depth and preserve all substantive report content in the canonical Markdown file. Investigation scope is refined during intake; presenting the report does not add a formal plan-approval gate. Ask whether the findings answer the user's question and invite feedback. End the turn with that report/version awaiting feedback, without polling or treating elapsed time as acceptance.

When the user responds, reconcile the same canonical report and feedback. Revise, validate and present the changed findings and complete report again. Explicit satisfaction or acceptance closes the report loop; record the user's evidence and accepted version. Silence, a notification acknowledgment or the agent's own validation does not accept it. Retain the accepted report for a possible later backlog request.

## Acceptance boundary

Report acceptance covers this report only. It does not authorize product implementation, hosted writes, ticket creation or automatically starting a breakdown. A later backlog request has its own explicit creation approval. For an authorized hosted update, show the concrete content/destination, honor existing permission, and read back the saved result.
