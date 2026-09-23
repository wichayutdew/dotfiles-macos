---
name: dev-getting-started
description: First-run onboarding for new engineers on the activities-agent-platform. Verifies tooling and auth, then narrates the ticket-to-MR workflow from dev-research-epic to dev-research-ticket to dev-implement-ticket to dev-testing-plan to dev-create-merge-request to dev-mr-babysit to dev-mr-assist. Use when a new engineer says "I'm new", "how do I start", "onboard me", "/dev-getting-started".
---

# Getting Started

## Input

No arguments required.

## What this skill does

Narrates the ticket-to-MR workflow. It does not execute any workflow step on your behalf. It tells you which command to run at each stage.

## Response contract

When responding, answer the user's immediate starting-point question first, then still include all seven stages. Do not compress the workflow to fewer stages. For every stage, give the command, purpose, produced output, and skip-if condition.

If the user asks an unrelated question, keep the answer brief, point them to the relevant skill when known, then still include the full seven-stage workflow with command, purpose, produced output, and skip-if condition.

For first-run onboarding prompts, tell the user they can re-run `/dev-getting-started` to see the guide again.

---

# Workflow: ticket to merged MR

Seven stages. Run them in order. You can skip a stage if its "Skip if" condition matches your situation.

---

## 1. dev-research-epic

**Purpose:** Break a JIRA epic into implementable stories. The epic owner runs this before contributors pick up individual tickets.

**Run:**
```
/dev-research-epic <jira-epic-id>
```

**Produces:** A sign-off document on Confluence listing each story with scope, acceptance criteria, and dependencies.

**Skip if:** You have a single ticket (not an epic), or your tech lead already broke down the epic. Go to stage 2.

---

## 2. dev-research-ticket

**Purpose:** Understand a JIRA ticket and map the required code changes before writing anything.

**Run:**
```
/dev-research-ticket <jira-ticket-id>
```

**Produces:** A research plan at `.sdd/output/research/<ticket-id>.md` and a testing plan at `.sdd/output/testing-plan/<ticket-id>.md`. These files are the handoff to `/dev-implement-ticket`.

**Skip if:** A research plan already exists for your ticket and you trust it is up to date.

---

## 3. dev-implement-ticket

**Purpose:** Execute the research plan phase by phase. Writes code, runs checks, and opens the MR in the default auto mode.

**Run:**
```
/dev-implement-ticket <jira-ticket-id>
```

Use manual mode when you want to approve each phase commit and the final MR action:
```
/dev-implement-ticket <jira-ticket-id> --manual
```

**Produces:** Commits on your feature branch, updated progress notes, and in auto mode a GitLab MR opened as a draft. In manual mode, it waits for approval before each phase commit and before creating or updating the MR.

**Skip if:** The MR already exists and code is written. Use `/dev-mr-assist` or `/dev-mr-babysit` instead.

---

## 4. dev-testing-plan

**Purpose:** Generate or regenerate a structured manual testing plan when scope has changed since research.

**Run:**
```
/dev-testing-plan <jira-ticket-id>
```

**Produces:** A testing plan at `.sdd/output/testing-plan/<ticket-id>.md` with per-acceptance-criteria steps and evidence requirements.

**Skip if:** `/dev-research-ticket` already produced a testing plan and scope has not changed.

---

## 5. dev-create-merge-request

**Purpose:** Create or update the GitLab MR description when `/dev-implement-ticket` did not do it automatically, manual mode stopped before MR creation, or the description needs refreshing.

**Run:**
```
/dev-create-merge-request
```

**Produces:** A GitLab MR with a structured description, labels, and reviewer assignments.

**Skip if:** `/dev-implement-ticket` already opened or updated the MR and the description is current.

---

## 6. dev-mr-babysit

**Purpose:** Monitor the MR lifecycle continuously (pipeline status, CodeBuddy review, human review, merge readiness) and take unblocking actions where safe.

**Run:**
```
/dev-mr-babysit
```

**Produces:** Repeated status reports every 2 minutes until the MR is merged or blocked on a human decision. Retries flaky jobs and invokes `/dev-mr-assist` when needed.

**Skip if:** You prefer to monitor the MR manually. You can still use `/dev-mr-assist` for specific failures.

---

## 7. dev-mr-assist

**Purpose:** Resolve a specific MR blocker: pipeline failure, merge conflict, or reviewer feedback.

**Run:**
```
/dev-mr-assist
```

**Produces:** Code fixes committed to the MR branch, pipeline retried, or unresolved threads addressed, depending on what is blocking the MR.

**Skip if:** The MR has no failures or feedback to act on.
