---
name: dev-add-experiment
description: Add experiment and feature flag in Activities repositories.
---

# Add Experiment

## Instructions

- Ask user Experiment Id if not clear using AskUserQuestion tool.
- Use `git remote get-url origin 2>/dev/null || basename $(pwd)` to verify the repository name.
- Check `${SKILL_ROOT}/references/` dir with repository name.
- Strictly follow the instuctions mentioned in repository reference file.
- If repository guidelines cannot be determined, exit and let user know.
- After finishing the repository guidelines, commit the changes and exit.

## Examples

- For example user asks to add experiment for ACT-6156-AT experiment in activities web, then agent follows below steps.
- Assuming that user is working in `$HOME/projects/activities-web`.
- Read `${SKILL_ROOT}/references/activities-web.md` file and understand the instructions and implement accordingly.

