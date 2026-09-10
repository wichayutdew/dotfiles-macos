# Workflow Specifications

This directory defines autonomous workflow specifications in `agent/workflows/` composed from stage prompts in `agent/workflows/steps/`. A `handoff` outcome from any step re-enters that same step with its handoff context.

---

## 1. `/work` — Requirement or Jira Work
Normalizes a free-form requirement or verifies one Jira key, then drafts a Plannotator plan **before** creating the approved deterministic worktree branch. It implements with TDD, independently verifies, and publishes one PR/MR. Existing PR/MR titles remain unchanged; repeated publication changes only workflow-owned description markers.

```mermaid
flowchart TD
    Start([Start: /work]) --> Intake[intake]
    Intake -->|ready| Plan[plan + Plannotator]
    Intake -->|blocked| Pause[$pause]

    Plan -->|ready| Prep[prepare-workspace]
    Plan -->|blocked| Pause

    Prep -->|ready| Imp[implement]
    Prep -->|gaps| Plan
    Prep -->|blocked| Pause

    Imp -->|ready| Ver[verify]
    Imp -->|blocked| Pause

    Ver -->|ready| Pub[publish]
    Ver -->|gaps| Imp
    Ver -->|blocked| Pause

    Pub -->|ready| Done([$done])
    Pub -->|blocked| Pause
```

The plan gate requires: Goal/Acceptance Criteria, Non Goal, Implementation Steps and Tests, Validation, Risks/Decisions Needed, Publications Contract/Metadata, and Execution appendix (machine-readable). Branches are `type/JIRA-123` for verified Jira work or `type/semantic-summary` otherwise; no random suffixes are allowed.

---

## 2. `/investigate` — Evidence & Findings
Retrieves scope/Jira context, gates scope through Plannotator, investigates facts/root causes, and validates findings before writing report.

```mermaid
flowchart TD
    Start([Start: /investigate]) --> Intake[intake]
    Intake -->|ready| Plan[plan + Plannotator]
    Intake -->|blocked| Pause[$pause]

    Plan -->|ready| Res[research]
    Plan -->|blocked| Pause

    Res -->|ready| Val[validate]
    Res -->|blocked| Pause

    Val -->|ready| Report[write-report]
    Val -->|gaps| Res
    Val -->|blocked| Pause

    Report -->|ready| Done([$done])
    Report -->|blocked| Pause
```

---

## 3. `/mr-review` — Hosted Code Review
Fetches MR/PR context and discussions, drafts an evidence-based review with proposed inline comments, gates those comments through Plannotator, then publishes them.

```mermaid
flowchart TD
    Start([Start: /mr-review]) --> Fetch[fetch]
    Fetch -->|ready| Review[review]
    Fetch -->|blocked| Pause[$pause]

    Review -->|ready| Plan[plan + Plannotator]
    Review -->|blocked| Pause

    Plan -->|ready| Pub[publish]
    Plan -->|blocked| Pause

    Pub -->|ready| Done([$done])
    Pub -->|blocked| Pause
```

---

## 4. `/mr-comment` — Review Comment Fixes
Fetches unresolved review discussions, checks out the branch, plans code fixes and discussion replies for Plannotator approval, implements fixes, verifies, and publishes commits + replies.

```mermaid
flowchart TD
    Start([Start: /mr-comment]) --> Fetch[fetch]
    Fetch -->|ready| Checkout[checkout-source]
    Fetch -->|blocked| Pause[$pause]

    Checkout -->|ready| Plan[plan + Plannotator]
    Checkout -->|blocked| Pause

    Plan -->|ready| Imp[implement]
    Plan -->|blocked| Pause

    Imp -->|ready| Ver[verify]
    Imp -->|blocked| Pause

    Ver -->|ready| Del[deliver]
    Ver -->|gaps| Imp
    Ver -->|blocked| Pause

    Del -->|ready| Done([$done])
    Del -->|blocked| Pause
```

---

## 5. `/sprint-triage` — Support Ticket Triage & Knowledge Base
Collects configured OpsBot ticket rows and complete Slack threads as factual source evidence, then gates a staged knowledge-base report, its integrity hash, ledger, human-guide fragment, and publication metadata through Plannotator. Only after approval, it creates and binds the KB worktree, copies the approved staged report verbatim, writes the approved index and any distinct approved ledger, then publishes the GitLab MR and top-inserted Confluence guide.

```mermaid
flowchart TD
    Start([Start: /sprint-triage]) --> Collect[collect]
    Collect -->|ready| Plan[plan + Plannotator]
    Collect -->|blocked| Pause[$pause]

    Plan -->|ready| Checkout[checkout]
    Plan -->|blocked| Pause

    Checkout -->|ready| Imp[implement]
    Checkout -->|blocked| Pause

    Imp -->|ready| Pub[publish]
    Imp -->|blocked| Pause

    Pub -->|ready| Done([$done])
    Pub -->|blocked| Pause
```

