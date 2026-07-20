---
description: Implement a Jira ticket as a verified local commit
argument-hint: "<issue-id-or-description>"
---
Implement $@ as the smallest verified local change.

1. Read the ticket, repository instructions, branch, HEAD, status, and relevant code. Extract scope, non-goals, dependencies, and testable acceptance criteria. Never invent missing ticket fields.
2. For non-trivial work, run one `scout` with `context: "fresh"` for a bounded evidence packet. Use at most two scouts only for independent code and external-doc questions. Main agent verifies their sources.
3. Use Plannotator only when scope is ambiguous, cross-file, or cross-system. Do not also run brainstorming or another planning workflow.
4. Resolve or create the current Pi session's one canonical worktree before writing. Run one fresh `worker` there when implementation benefits from isolation. Pass accepted requirements plus verified path:line evidence. Worker owns regression test, code, and focused checks. Keep one writer; never create another worktree for a follow-up.
5. Inspect the diff and test output. Run one fresh `reviewer` for meaningful changes, then resolve supported blockers and rerun relevant checks.
6. After review and required checks, stage only scoped paths and create one SemVer-compatible Conventional Commit in the canonical session worktree. Report its SHA, requirement-to-change-to-test mapping, and unrun checks. Do not edit Jira, push, tag, bump versions, or create a merge request unless explicitly requested.
