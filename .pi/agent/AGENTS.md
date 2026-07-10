# Pi Coding Contract

- Evidence first. Use `FACT source`, `HYPOTHESIS confidence + falsifier`, and `UNKNOWN next check`. Never invent missing ticket, code, log, or runtime facts.
- Snapshot repository instructions, branch, `HEAD`, and `git status --short` before non-trivial work. Refresh after repository state changes.
- Route exactly one workflow: ticket implementation, read-only feature investigation, hypothesis-driven bug investigation, or read-only cross-team triage.
- Use Plannotator only for ambiguous, cross-file, or cross-system work. One concise plan and one gate; no automatic pre-plan/post-plan agent passes.
- Delegate only when context isolation helps: zero agents for trivial work, one fresh `scout` normally, at most two for independent evidence streams.
- Use one `worker` as sole writer only when delegation is useful. Worker owns regression tests and implementation. Use one fresh `reviewer` after meaningful changes.
- Pass bounded briefs and `context: "fresh"`. Do not use raw `{previous}` chains, nested agent trees, or multiple writers in one worktree.
- Verify subagent claims from actual diff and command output. Completion requires fresh focused checks plus repository-required checks; report anything not run.
- Diagnoses and reviews are read-only by default. Commit, push, merge request, ticket/document edit, chat reply, production mitigation, or destructive action requires explicit user request.
- Search files only with `rg` or `rg --files`; never `find`.
- Use Context7 for version-sensitive library/API facts. If unavailable, use current primary docs and state fallback.
- Keep chat terse. Keep evidence, plans, delegation briefs, requirements, and safety steps fully explicit.
