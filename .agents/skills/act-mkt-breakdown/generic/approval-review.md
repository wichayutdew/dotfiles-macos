# Creation approval in the active conversation

Read the latest canonical draft and preserve user edits. Save the complete epic/story proposal under the inherited task root, or retain the user's explicit canonical draft with a local review copy. Record its actual path, version or digest, source report version, feedback resolved and pending creation decision in `.task-context.json`. Resolve the tracker destination and supported hierarchy before requesting creation approval.

## Actionable review

Present the proposal in the active conversation in this order:

1. The intended outcome in one sentence.
2. A compact table of observable acceptance criteria and how the proposed stories cover them.
3. A small Mermaid diagram of meaningful story dependencies; use a concise numbered flow if rendering is unavailable.
4. The proposed items, real tracker/workspace/team/project, supported object types and relationships, selected metadata, and the exact decision: approving authorizes creating these items in this destination.
5. A link to the complete saved draft with every description, brief implementation step and acceptance criterion. Keep implementation detail and machine-readable checkpoints there. The conversation must expose all material choices; the link supports review rather than hiding its substance.

Invite corrections to the grouping, criteria, dependencies or destination before asking for approval. Native Plan mode may support this discussion when available; it is controlled by the host, not by these instructions. Ordinary conversation provides the same read-only planning and explicit decision gate.

Record the pending decision and end the turn. Do not poll or infer approval from silence, a delivery acknowledgment, report acceptance or approval of a materially different draft. An explicit instruction to create the displayed final draft in the named destination is sufficient; do not request routine reconfirmation.

## Approval and continuation

Approval covers only the complete current items, content, destination, hierarchy and selected metadata. Record the user's decision evidence and reviewed version. Immediately continue to [create approved items](../workflows/create.md) after approval, create only missing approved items and read back their saved content/relationships. Preserve confirmed IDs and reconcile ambiguous writes before retrying.

Feedback revises the same draft and returns to review. Material changes to item content, destination, hierarchy or metadata require renewed approval only for affected writes. Content acceptance alone does not authorize creation; clarify the missing creation authority. Never treat partial creation as completion or discard confirmed items to restart.
