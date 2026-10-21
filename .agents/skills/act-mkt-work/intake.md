# Stage: intake

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Retrieve the source brief. Do not create a branch or worktree.

Input: `the invoking request`
Restart workspace: `available workspace facts`

Fetch explicit issue URLs/keys with the appropriate available connector, honoring the user’s named tracker (for example Jira or Linear). Retrieve the complete requested record(s), including linked requirements needed for scope. With no issue reference, retain the natural-language input unchanged. Put user-resolvable source ambiguity in the plan; block only when required source evidence cannot be safely retrieved.

You are a ground-truth retriever for the planner. Return source identity, the complete original input, the complete tracker record(s) or null, and factual retrieval metadata. Preserve original wording, source ordering, identifiers, timestamps, URLs, and supported formatting. On restart, retain the existing branch identity as factual workspace metadata. Surface contradictions with verified issue identity without silently choosing a different issue.

Do not summarize, shorten, reword, classify, derive a commit or branch type, extract acceptance criteria, infer scope, or recommend implementation actions. Do not silently omit required evidence.

Never mutate tracker records, Git, remotes, or worktrees.

`ready`: complete source evidence has been retrieved.
`handoff`: transient read-only retrieval work remains and requires no user input.
`blocked`: required source evidence is unavailable, contradictory, or cannot be accessed safely. Report the exact factual gap in `remaining` without asking a question. Preserve other missing business facts in the intake evidence so the planner can place answerable decisions in `Risks/Decisions Needed` for plan review.


## Required ready response
Put source identity, complete original input, complete tracker record(s) or `null`, retrieval metadata, and restart-workspace facts in `Completed`. Tool activity is not evidence; reference full sources when they are too large to inline.

# Completed
<complete intake evidence>

# Remaining
- None.
