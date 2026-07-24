Workflow: local-work

Load `caveman` at ultra intensity for chat, Superpowers `brainstorming` for plan quality, and repository-relevant skills. Keep evidence, requirements, plans, tests, and safety steps explicit.

Stay in Plannotator planning until approval. Planning is read-only except the plan file. This workflow remains active until `/workflow-done` passes or `/workflow-abort`.

1. Use the complete workflow input as the requirement. Classify implementation, bug fix, or read-only investigation.
2. Explore every relevant repository or directory before planning. Read nearest instructions, branch, `HEAD`, status, architecture/build docs, representative code, callers, and tests. Use `rg`, `rg --files`, `ast-grep`, read-only Git/CLI commands, connected MCP tools, and read-only hosted-code or documentation tools as useful. Use one fresh bounded `scout`; use `researcher` only for independent current facts. Label claims `FACT`, `HYPOTHESIS` with confidence and falsifier, or `UNKNOWN` with next check.
3. Use Superpowers `brainstorming` plus gathered evidence to write one solid implementation plan. First line stays `Workflow: local-work`. Use headings `Goal`, `In scope`, `Out of scope`, `Evidence`, `Things to implement`, `Implementation plan`, `Requirement-to-test mapping`, `Done when`, `Verification contract`, `Skill recommendation`, `Open questions`, and `Risks`. Every acceptance criterion appears as `- [ ]` under `Done when` and maps to an implementation item plus exact verification.
4. Submit the plan through Plannotator. Feedback means revise the same plan and resubmit. Implement nothing until approval.
5. Code plans may span multiple repositories. Use `caveman` to derive one non-empty lowercase ASCII hyphen summary, at most 20 characters. For each repository use branch `<summary>` and directory `<source-repository-name>-<summary>` beneath configured `worktreeBaseDir`. The user stays in the shared checkout. Put every repository in one `Verification contract` JSON object:

```json
{
  "repositories": [
    {
      "cwd": "/absolute/worktree/git-root",
      "sourceCwd": "/absolute/source-repository-git-root",
      "baseHead": "exact-source-HEAD-object-id",
      "branch": "lowercase-summary",
      "commitTitle": "fix(scope): concise semantic title",
      "acceptanceCriteria": ["Exact criterion copied from Done when"],
      "worker": [{ "id": "focused-tests", "command": "exact command", "timeoutMs": 120000 }],
      "reviewer": [
        { "id": "full-tests", "command": "exact complete test command", "timeoutMs": 600000 },
        { "id": "format", "command": "exact non-fixing format check", "timeoutMs": 120000 },
        { "id": "lint", "command": "exact non-fixing lint check", "timeoutMs": 120000 }
      ]
    }
  ]
}
```

For read-only work, write exactly `Not applicable - read-only plan.` under `Verification contract`. After approval, run one foreground fresh `scout` in the approved plan cwd with attested acceptance, exact `Done when` criteria, per-criterion evidence, and a structured report.

After approval, create or reuse each exact worktree from its approved `sourceCwd` and `baseHead`; new worktrees use `git -C <sourceCwd> worktree add -b <branch> <cwd> <baseHead>`, and reused worktrees must share the source Git common directory. Launch one foreground parallel subagent call with one fresh `worker` task per repository. Each worker is sole writer for its repository, uses Superpowers `test-driven-development`, proves the same approved test command failed RED before it passed GREEN, copies every exact acceptance criterion in order with evidence, names tests added or updated, runs exact commands, stages only scoped paths, creates the exact approved Conventional Commit, and leaves a clean worktree. Independent repositories run in parallel. Then run one fresh `reviewer` task per repository in parallel with exact ordered per-criterion evidence and a clean-worktree check. Findings return to affected workers, followed by fresh worker and reviewer gates. Never push, publish, tag, bump versions, or mutate external systems unless separately authorized. Stop only after every `Done when` criterion and every repository gate passes.
