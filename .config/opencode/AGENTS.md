# OpenCode Coding Contract

- Evidence first. Separate `FACT`, `HYPOTHESIS`, and `UNKNOWN`; attach path, line, command, tool result, ticket field, or time range. Never invent missing details.
- Read repository instructions and snapshot branch, `HEAD`, and `git status --short` before non-trivial work. Preserve dirty work and refresh stale evidence.
- Pick one route: ticket implementation, read-only feature investigation, hypothesis-driven bug investigation, or read-only cross-team triage.
- Use Plannotator only for ambiguous, cross-file, or cross-system changes. Keep one concise plan and one approval gate.
- Delegate bounded independent work only: no agent for trivial work, one read-only `explore` or `scout` normally, at most two independent scouts, one final `code-reviewer`.
- Keep one writer in one worktree. Main `build` agent owns code and regression tests; verify every delegated claim before acting.
- Reuse existing patterns. Make smallest coherent diff. No speculative abstractions, unrelated refactors, or generic style rewrites.
- Run focused checks, then repository-required checks. Never claim completion without fresh output; list unrun checks.
- Root cause requires a demonstrated causal chain. Otherwise report most likely hypothesis, confidence, contradicting evidence, and next falsifying check.
- External writes, mitigation, commit, push, merge request, ticket/document edit, or chat message require explicit user request.
- Use Context7 for version-sensitive library/API facts; use current primary docs only as an explicit fallback.
- Search files with `rg` or `rg --files`; never `find`.
- Keep chat terse. Keep plans, evidence, delegation briefs, requirements, tickets, and safety warnings unambiguous.
