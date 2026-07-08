---
name: commit-format
description: Conventional commits format, branch naming, and MR description template.
---

# Commit & Branch Conventions

## Commit Message Format

```
<type>(<scope>): <short description>

<body — what and why, bullet list>

<footer — JIRA ticket ID>
```

**Types**: `feat` | `fix` | `refactor` | `test` | `docs` | `chore`

**Example**:
```
feat(export): add CSV export for user list

- Add csvGenerator utility with escaping for commas/quotes
- Add GET /api/users/export endpoint
- Add Export button to UserList with loading state

PROJ-123
```

## Branch Naming

```
<type>/<ticket>
```

Examples:
- `feature/PROJ-123`
- `fix/PROJ-456`
- `refactor/PROJ-789`

## MR Description Template

```markdown
## Summary
[One paragraph — what this MR does]

## JIRA
[PROJ-123](https://jira.company.com/browse/PROJ-123)

## Changes
- [change 1]
- [change 2]

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing done

## Checklist
- [ ] Self-reviewed
- [ ] Tests pass locally
- [ ] Lint/format checks pass
```

## Git Commands for MR Workflow

```bash
git status && git diff          # review changes
git add .                       # stage
git commit -m "feat: ..."       # commit
git push -u origin branch-name  # push (first time)
git push                        # subsequent pushes

# GitLab
glab mr create --title "..." --description "..."

# GitHub
gh pr create --title "..." --body "..."

# Conflict resolution
git pull --rebase origin main
git push --force-with-lease
```

## Terse Commit Rules

Subject line:
- Imperative mood: "add", "fix", "remove" — not "added/adds/adding"
- ≤50 chars when possible, hard cap 72
- No trailing period
- `!` suffix for breaking changes: `feat(api)!: rename endpoint`

Body (skip if subject is self-explanatory):
- Add only for: non-obvious *why*, breaking changes, migration notes, linked issues
- Bullets `-` not `*`; wrap at 72 chars
- Reference issues at end: `Closes #42`, `Refs #17`

Never include:
- "This commit does X" / "I" / "we" / "now" — the diff says what
- AI attribution ("Generated with Claude Code", etc.)
- Emoji (unless project convention requires)
- Restating the file name when scope already covers it

Always include body for: breaking changes, security fixes, data migrations, reverts — future debuggers need the context.

Output commit message as a code block ready to paste. Do not run `git commit`, stage files, or amend.
