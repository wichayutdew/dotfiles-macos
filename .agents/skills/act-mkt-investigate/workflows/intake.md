# Understand the investigation

Establish or recover the artifact directory and persist its absolute paths using [task directory](../generic/task-directory.md). Capture the invocation cwd first; new investigations use `<ticket-ID>-<brief-description>/`, or `<brief-description>/` without a ticket. Continuations retain their existing root.

Read the user's idea, feature, question, or existing report. Identify the audience, questions to answer, requested depth, known constraints, and supplied sources. Fetch referenced tracker records or documents only as needed to understand and refine scope at this stage; no tracker identifier is required for a standalone idea or general question.

Match the requested depth and format, including a short answer or narrow edit to existing content. Honor a supplied template; when a report structure is useful, choose RFC for a proposal or investigation result for an explanation. Use chat as the default output; reuse the exact existing file/document if the user supplied one. Do not ask for a report path when chat output is sufficient.

Restate the proposed question, audience, in/out of scope and expected output in the active conversation. Treat a detailed user request as supplied scope rather than asking them to repeat it. Ask focused questions where a material gap would change what is investigated or reported. Until those material scope questions are resolved, limit reads to source discovery needed to clarify scope; do not begin substantive research or report drafting. This is scope refinement, not a formal plan-approval ceremony.

When revising, read the latest canonical report and feedback first. Keep accepted decisions, user edits, and protected contracts. Reopen scope discussion only when the new request materially changes it. Do not insert an upfront scope-plan approval stage unless explicit user/AGENTS instructions require one.

Record the established scope, user-supplied decisions and resolved questions in `.task-context.json`. Carry the full request and readable source references, selected report/template/destination, and remaining evidence questions into the [plan step](plan.md), then research. Reading a source does not authorize editing it or creating tickets.
