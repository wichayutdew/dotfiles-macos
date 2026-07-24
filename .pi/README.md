# Local workflow specification

This directory defines the local workflow specification in `agent/workflows/`.
The four YAML specifications compose stage prompts in `agent/workflows/steps/`.

```mermaid
flowchart TD
    S[Workflow specification] --> W[/work.workflow.yaml/]
    S --> T[/ticket.workflow.yaml/]
    S --> R[/mr-review.workflow.yaml/]
    S --> C[/mr-comment.workflow.yaml/]

    W --> WP[plan → implement → verify]
    T --> TP[plan → implement → verify]
    R --> RP[plan → review → confirm → publish]
    C --> CP[plan → implement → verify → confirm → publish]
```

```mermaid
flowchart LR
    P[Plan] --> I[Implement]
    I --> V{Verify}
    V -->|pass| D[Done]
    V -->|needs changes| I
```

Shell search is restricted to `rg` and `rg --files`. `gh_grep` remains an
approved MCP code-search integration.

Relevant Superpowers skills are declared by stage: planning uses
`brainstorming` and `writing-plans`; implementation uses `executing-plans`,
`systematic-debugging`, and `test-driven-development`; verification uses
`verification-before-completion` and `requesting-code-review`.
