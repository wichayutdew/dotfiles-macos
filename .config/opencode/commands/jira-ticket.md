---
description: Create or update a Jira story/task from context or arguments
---

Load skill from `skills/jira-ticket/SKILL.md` and follow it.

If $ARGUMENTS provided, use as initial context (issue key to update, or draft description to create from).
If no arguments, use current conversation context as ticket input; if insufficient, prompt user interactively.
