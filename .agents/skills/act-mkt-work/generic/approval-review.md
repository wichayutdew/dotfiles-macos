# Conversation plan review

Save the latest complete plan as Markdown under `<root>/.artifacts/`, preserving user edits and every required template field. Record its absolute path, version or digest, approval purpose, current source head and exact actions being authorized. Keep detailed implementation tables, commands and machine-readable state in that supporting artifact.

## Make the decision actionable

Present the review in the active conversation in this order:

1. **Outcome:** one sentence describing the resulting behavior and scope.
2. **Acceptance criteria:** a compact table of observable pass/fail outcomes and how each will be checked. Lead with what the user will experience.
3. **Flow:** a small Mermaid diagram when it explains the change or dependencies. Use a concise numbered flow if rendering is unavailable.
4. **Decision:** the concrete recommendation, material alternatives/risks, unresolved user choices and exact actions approval authorizes. Link the complete saved plan and identify its version. Keep execution commands and machine-readable appendices out of the review message unless requested.

For review feedback, include each current interpretation, supporting/counter-evidence and implement/decline/already-addressed recommendation, plus exact proposed reply bodies and their thread identities. Invite the user to challenge the reasoning before approving. Do not bury consequential changes, missing permissions or publication actions in an appendix. When there are many decisions, group them clearly under the same versioned plan rather than losing actions through truncation.

Use the host's native Plan mode when it is available and selected. In Codex, the user can enter it with `/plan` or the app's Plan mode control. A skill does not itself switch system-controlled modes. If the host exposes no mode-switch capability, continue read-only planning and present the same review in chat; no separate service is required. Host command permissions and plan-mode transitions do not count as approval of the plan.

Ask for explicit approval or corrections in the active conversation, record the pending decision and end the turn. Preserve the canonical artifact for continuation. No bot may approve for the user. A scheduled run retains the pending state rather than repeatedly opening new approvals. A relayed decision requires attributable human evidence tied to the same artifact/version, review identity, source head and authorized actions. Silence, a notification acknowledgment, tool failure or approval of a materially different artifact is not approval.

On feedback, revise the same artifact and show the changed acceptance criteria, flow or actions; ask for approval of the current version. On explicit approval, retain the decision evidence and proceed with all authorized stages without routine reconfirmation. Revalidate current source and discussion state before edits or publication. Materially changed assumptions or actions return only the affected scope for review; unchanged valid approval remains usable.

## Approval purpose and next stage

Approval authorizes the scoped implementation, validation and publication actions explicitly listed in the work plan. Continue to workspace preparation or the recorded approved stage, then complete the authorized lifecycle. It does not authorize unrelated external changes, merging, releases or deployment.
