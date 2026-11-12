# Review approval in the active conversation

Save the complete current Markdown plan under `<root>/.artifacts/` and preserve user edits. Record its path, version/digest, reviewed base/head, canonical review identity, exact actions and pending decision in the task context. Keep the full publication ledger in that artifact; it is supporting detail, not the opening review surface.

Present an actionable review in the current conversation:

1. One-sentence verdict and a compact table of observable acceptance criteria, evidence and limits.
2. A small Mermaid diagram when it explains the affected flow or failure; use a concise text flow if rendering is unavailable.
3. Each proposed finding's interpretation, supporting/counter-evidence, impact and exact comment text and anchor. Link deeper evidence without hiding material uncertainty or actions.
4. The exact decision: approve these comments/actions for this MR and head, or provide corrections. State what approval permits and link the complete saved artifact. Do not dump machine-readable execution fields into the conversation.

Use the host's native Plan mode if available or already selected. The host controls mode changes; this skill cannot switch it by declaration. Ordinary read-only planning and explicit conversation approval remain sufficient. Do not require a separate review app, CLI, plugin or renderer.

Debate the reasoning with the user. Feedback revises the same artifact; refresh affected evidence when the head or intended comments change. Once the actionable review is ready, ask for explicit approval and end the turn. Do not poll or manufacture a decision. Silence, elapsed time, another bot's verdict, notification acknowledgment or a tool response is not approval. Record attributable human approval of the artifact version and exact publication scope. Then execute authorized publication without routine reconfirmation.

On continuation, reconcile the existing artifact, decision, current MR/head and confirmed/unconfirmed action IDs before resuming. Reuse valid approval. Materially changed findings, anchors or publication scope require approval only for affected actions. Reconcile ambiguous writes before retrying.

Approval permits only the exact reviewed comments/actions. It does not approve, merge or close the MR, implement fixes, or authorize unrelated writes. With no actionable findings and no requested summary publication, finish locally with the reviewed SHA, coverage and limitations; do not create an empty approval cycle.
