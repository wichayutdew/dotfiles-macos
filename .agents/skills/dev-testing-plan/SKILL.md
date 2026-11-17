---
name: dev-testing-plan
description: Generate a manual testing plan with evidence collection guidance for merge requests. Use when you need to verify changes work correctly and want a structured plan for collecting proof (screenshots, videos, API responses).
---


# Testing Plan

Generate a structured manual testing plan for collecting evidence that changes work correctly. Uses research and implementation artifacts as the primary source of truth, with git diff as fallback.

## Instructions

### 1. Identify JIRA ID and Load Artifacts

If the user hasn't provided a JIRA ID (e.g., ACT-1234), ask for it. As fallback, extract from the current branch name:

```bash
git branch --show-current | grep -oE '[A-Z]+-[0-9]+'
```

#### Primary Source: Research Artifact

```bash
# Check for research artifact
ls .sdd/output/research/<jira-id>.md
```

If found, read it. It contains:
- Overview of what's being implemented and why
- Acceptance Criteria Mapping (with verification methods)
- Current State Analysis / Desired End State
- Implementation phases with files to create/modify
- Testing Strategy section (unit, integration, manual steps)
- Success Criteria per phase

#### Secondary Source: Implementation Progress

```bash
# Check for implementation progress artifact
ls .sdd/output/implementation_progress/<jira-id>.md
```

If found, read it for phases completed, decisions made, and current status.

#### If Neither Artifact Exists

Inform the user that no research/implementation artifacts were found and fall back to **Step 1b**.

### 1b. Fallback - Git Diff Analysis

Only execute this step when no research or implementation artifacts exist.

Determine the base branch:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'
```

Then analyze the diff:

```bash
# Summary of changed files
git diff origin/<base-branch>...HEAD --stat

# Full diff content
git diff origin/<base-branch>...HEAD
```

From the diff, identify:
- Changed files and their types
- Categories of changes: UI, API, business logic, config, data layer

### 2. Detect Project Type

Run the module detection script to get structured project info:

```bash
bash ${SKILL_ROOT}/scripts/get-project-modules.sh .
```

This outputs a JSON array of `{name, language, path}` for each module in the project. Use the languages to classify:

| Module Languages | Project Type |
|---|---|
| TypeScript, JavaScript (with React/Next.js/Vue) | **Frontend** |
| Scala, Kotlin, C#, Python, Java (with controllers/routes) | **Backend API** |
| Both frontend and backend languages present across modules | **Full-stack** |

If the script returns an error (unknown project type), fall back to file marker detection:

```bash
# Frontend markers
fd -e tsx -e jsx -e css . --max-depth 3 | head -5

# Backend markers
fd 'build.sbt|go.mod' . --max-depth 2 | head -5
```

The detected type determines the evidence collection strategy in Step 4. The module list also helps identify which modules were affected by the changes.

### 3. Check for Repo-Specific Testing Skills

If the repo has any skills related to testing guidelines, test environments, or QA conventions, invoke them to get repo-specific context (environments, test accounts, evidence conventions, regression areas). Incorporate their output into the testing plan.

### 4. Generate Testing Plan

Output a structured markdown plan with these sections:

#### Section 1: Change Summary

- What was changed and why (from research plan overview + acceptance criteria, or from diff analysis)
- JIRA ticket reference
- Implementation phases completed (if artifacts exist)

#### Section 2: Acceptance Criteria Verification

Only include this section when research artifacts exist.

- Map each AC from the research plan to a concrete manual test
- Include the verification method already specified in the research plan's AC table
- Add evidence type needed for each: screenshot / video / API response

#### Section 3: Test Scenarios

For each affected area, create scenarios:

```markdown
**Scenario**: [Scenario name]
- **Pre-conditions**: [What must be true before testing]
- **Steps**:
  1. [Step-by-step actions]
  2. ...
- **Expected Result**: [What should happen]
- **Evidence**: [screenshot / video / API response / log output]
```

Cover:
- Happy path for each change
- Error/edge cases
- Boundary conditions where relevant

#### Section 4: Evidence Collection Guide

Based on detected project type:

**Frontend projects:**
- Browser screenshots (before/after states)
- Screen recordings of user flows
- Responsive checks (mobile, tablet, desktop)
- Accessibility verification (keyboard nav, screen reader)
- Tooling: Browser DevTools, Lighthouse

**Backend API projects:**
- Postman/curl request + response pairs
- API response diffs (before/after)
- Log output showing correct behavior
- Database state verification
- Tooling: Postman, curl commands, database client

**Full-stack projects:**
- Combination of both frontend and backend evidence
- End-to-end flow recordings showing UI through to API

Include concrete curl/Postman examples where API endpoints are identifiable from the changes.

#### Section 5: Regression Checks

- If research artifact exists: reference the "What We're NOT Doing" section for areas to spot-check
- Adjacent features that share modified files (identify from the diff)
- Smoke test critical paths that touch the same modules

#### Section 6: Environment & Setup

- Where to test: local / staging / preview deploy
- Setup needed: feature flags, test data, accounts
- If repo-specific testing skills provided environment details, reference them
- Any configuration or mock data requirements

### 5. Present and Save

1. Output the full testing plan to the user
2. Ask where to save - default: `.sdd/output/testing-plan/<jira-id>.md`
3. Ask if they want to adjust any section

## Convention: Repo-Specific Testing Skills

Repos can define their own skills to provide testing context. These skills should cover things like:

- Project-specific test environments (URLs, staging endpoints)
- Common test accounts or test data
- Evidence conventions (where to upload screenshots, naming format)
- Repo-specific flows that should always be regression tested
- Team-preferred tools (Postman collections, browser testing setups)
- Areas of the app that are fragile and need extra attention

## Examples

**User**: "Generate a testing plan for ACT-1234"

1. Read `.sdd/output/research/ACT-1234.md` → found, load AC mapping and phases
2. Read `.sdd/output/implementation_progress/ACT-1234.md` → found, 3 of 4 phases done
3. Detect project type → Frontend (React + TypeScript)
4. No repo-specific testing skills found
5. Generate plan with AC-based scenarios, frontend evidence guide
6. Ask user where to save

**User**: "Create test plan" (no artifacts exist)

1. No JIRA ID provided → extract `ACT-567` from branch name
2. No research/implementation artifacts found → inform user, fall back to diff
3. Analyze `git diff origin/main...HEAD` → 5 files changed (2 API controllers, 1 service, 2 tests)
4. Detect project type → Backend API (Scala + sbt)
5. Repo has a `qa-guidelines` skill → invoke it, get staging URLs and test accounts
6. Generate plan with diff-based scenarios, backend evidence guide, repo-specific env details
7. Ask user where to save
