# Conversation plan review

Save the latest complete plan as Markdown under `<root>/.artifacts/`, preserving user edits and every required template field. Record its absolute path, version or digest, approval purpose, current source head and exact actions being authorized. Keep detailed implementation tables, commands and machine-readable state in that supporting artifact.

## Make the decision actionable

Present the review in the active conversation in this order:

1. **Outcome:** one sentence describing the resulting behavior and scope.
2. **Acceptance criteria:** a compact table of observable pass/fail outcomes and how each will be checked. Lead with what the user will experience.
3. **Architecture and data flow:** an overall Mermaid diagram or picture showing relevant entry points, components, interfaces/dependencies, data stores where applicable, and data movement through the affected path. If Mermaid cannot render, include a picture; prose or task dependencies alone do not replace this visual.
4. **TDD overview:** short bullets showing intended red, green and refactor/check steps where TDD is useful, mandatory unit-test coverage for every code/behavior change, independent parallel groups, and dependencies requiring sequencing. For docs/config-only work, state the relevant validation instead of inventing tests.
5. **E2E verification methods:** list all applicable real local API/UI scenarios separately from unit/TDD checks. Show acceptance-criteria mapping, setup prerequisites, inputs/actions, expected results, and planned API request/response captures or UI screenshot evidence. Include the happy path and 1–2 relevant edge cases (both variants for experiments). For work with no runnable feature, explain why product E2E evidence does not apply and show the planned workflow/example walkthrough.
6. **Decision:** the concrete recommendation, material alternatives/risks, unresolved user choices and exact actions approval authorizes. Link the complete saved plan and identify its version. Keep execution commands and machine-readable appendices out of the review message unless requested.

Show the architecture/data-flow visual, TDD bullets and E2E methods list in the active conversation as well as the saved artifact; a link alone is insufficient. Keep the overview concise and leave detailed task/check commands in the linked plan.

For review feedback, include each current interpretation, supporting/counter-evidence and implement/decline/already-addressed recommendation, plus exact proposed reply bodies and their thread identities. Invite the user to challenge the reasoning before approving. Do not bury consequential changes, missing permissions or publication actions in an appendix. When there are many decisions, group them clearly under the same versioned plan rather than losing actions through truncation.

Use the host's native Plan mode when it is available and selected. In Codex, the user can enter it with `/plan` or the app's Plan mode control. A skill does not itself switch system-controlled modes. If the host exposes no mode-switch capability, continue read-only planning and present the same review in chat; no separate service is required. Host command permissions and plan-mode transitions do not count as approval of the plan.

Ask for explicit approval or corrections in the active conversation, record the pending decision and end the turn. Preserve the canonical artifact for continuation. No bot may approve for the user. A scheduled run retains the pending state rather than repeatedly opening new approvals. A relayed decision requires attributable human evidence tied to the same artifact/version, review identity, source head and authorized actions. Silence, a notification acknowledgment, tool failure or approval of a materially different artifact is not approval.

On feedback, revise the same artifact and show the changed acceptance criteria, flow or actions; ask for approval of the current version. On explicit approval, retain the decision evidence and proceed with all authorized stages without routine reconfirmation. Revalidate current source and discussion state before edits or publication. Materially changed assumptions or actions return only the affected scope for review; unchanged valid approval remains usable.

## Approval purpose and next stage

Approval authorizes the scoped implementation, validation and publication actions explicitly listed in the work plan. Continue to workspace preparation or the recorded approved stage, then complete the authorized lifecycle. It does not authorize unrelated external changes, merging, releases or deployment.
