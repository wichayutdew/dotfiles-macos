---
name: commit-format
description: Draft repository-compatible conventional commit messages, branch names, and merge-request descriptions. Use only when the user requests commit or merge-request text.
---

# Commit and Merge-Request Text

Read repository conventions and actual diff first. Do not stage, commit, push, amend, rebase, or create a merge request unless explicitly asked.

## Commit

```text
<type>(<scope>): <imperative summary>

<optional reason, risk, or migration note>

<optional issue reference>
```

- Follow repository types and scopes; otherwise use `feat`, `fix`, `refactor`, `test`, `docs`, or `chore`.
- Keep subject imperative, specific, and at most 72 characters; prefer 50 when clear. No period.
- Add body only for non-obvious why, breaking behavior, security, migration, or operational risk.
- Use `<issue-id>` placeholders when source does not provide a real issue reference.
- No AI attribution, invented impact, or unsupported test claims.

## Branch

Follow repository pattern. If none exists, propose `<type>/<issue-id>-<short-slug>` without creating it.

## Merge Request

```markdown
## Summary

What changed and why.

## Changes

- Scoped behavior changes.

## Verification

- `<command>` — observed result.

## Risks

- Known risk, rollout need, or `None identified`.
```

Mention only checks that actually ran. Mark unverified items explicitly. Output paste-ready text.
