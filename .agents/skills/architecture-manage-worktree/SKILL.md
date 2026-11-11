---
name: architecture-manage-worktree
description: >
  Manage git worktree workspaces in this multi-repo project. Use whenever the
  user wants to create an isolated workspace or sandbox for a ticket, feature,
  or experiment; list or check active workspaces; remove or clean up a workspace
  they're done with; repair broken symlinks in a workspace; or orchestrate
  multiple agents working in parallel across repos. Triggers on: "set up a
  workspace", "spin up a sandbox", "start on ACTB-XXXX", "what workspaces do I
  have", "clean up / remove the X workspace", "my overlay/symlinks are broken",
  "run agents in parallel on these repos", or any request to create or manage
  isolated per-ticket or per-feature development environments.
allowed-tools: Bash, Read
user-invocable: true
---

# Worktree Workspace Manager

Creates and manages isolated git worktree workspaces via
the bundled `manage-worktrees.sh` script beside this `SKILL.md`. Each workspace lives under
`worktrees/<name>/` and contains:
- `<repo-name>/` — one git worktree per selected repo, directly in workspace root
- `overlay/`, `CLAUDE.md`, `AGENTS.md`, `.claude/` — symlinked from main workspace
- `.branch` and `.repos` metadata files

Script: `skills/architecture-manage-worktree/manage-worktrees.sh`
in this repository, or the bundled `manage-worktrees.sh` beside this
`SKILL.md` in an installed skill cache. Run it from a multi-repo workspace
root or a child directory of one.

---

## Multi-Agent Orchestration Pattern

Workspaces exist so **multiple agents can work in parallel without interfering**.
The correct pattern has three levels:

1. **Orchestrator** (this session, main workspace root) — creates the workspace, then spawns one worker agent per worktree.
2. **Worker agents** — each rooted at `worktrees/<name>/` (the workspace root, not a repo subdirectory). They see `CLAUDE.md`, `AGENTS.md`, and `overlay/` via symlinks, plus isolated `.claude/` state. Each worker coordinates work within its worktree and spawns subagents per repo.
3. **Repo subagents** — spawned by worker agents, each rooted at `worktrees/<name>/<repo>/`. They do the actual code changes.

```
Orchestrator (main workspace)
  └─ creates worktrees/ACTB-1234/
       └─ Worker agent (working_dir: worktrees/ACTB-1234/)
            ├─ Repo subagent A (working_dir: worktrees/ACTB-1234/SEOGPTContent/)
            └─ Repo subagent B (working_dir: worktrees/ACTB-1234/seo-backoffice/)
```

**Never** have a single agent `cd` between repos — create a workspace and use separate repo subagents instead.

### Spawning worker agents

After creating the workspace, spawn one worker agent per worktree:

```
Worker agent:
  working_dir: worktrees/ACTB-1234/
  task: <overall task context — worker will spawn repo subagents as needed>
```

The worker agent then spawns repo subagents:

```
Repo subagent for SEOGPTContent:
  working_dir: worktrees/ACTB-1234/SEOGPTContent
  task: <repo-specific instructions>

Repo subagent for seo-backoffice:
  working_dir: worktrees/ACTB-1234/seo-backoffice
  task: <repo-specific instructions>
```

Each subagent picks up the workspace's `CLAUDE.md` and `overlay/` automatically.

---

## Available actions

| Action | Command |
|--------|---------|
| **Create** (interactive TUI) | `skills/architecture-manage-worktree/manage-worktrees.sh -n <name>` |
| **Create** (specific repos) | `skills/architecture-manage-worktree/manage-worktrees.sh -n <name> -r Repo1,Repo2` |
| **Create** (existing branch) | `skills/architecture-manage-worktree/manage-worktrees.sh -n <name> -r Repo1 -b feature/my-branch` |
| **Create** (new branch) | `skills/architecture-manage-worktree/manage-worktrees.sh -n <name> -r Repo1 -B feature/new-branch` |
| **Create** (shallow cache, opt in) | `bash skills/architecture-manage-worktree/manage-worktrees.sh -n <name> -r Repo1 --depth 1` |
| **List** | `skills/architecture-manage-worktree/manage-worktrees.sh --list` |
| **Remove** | `skills/architecture-manage-worktree/manage-worktrees.sh --remove <name>` |
| **Repair** (all) | `skills/architecture-manage-worktree/manage-worktrees.sh --repair` |
| **Repair** (one) | `skills/architecture-manage-worktree/manage-worktrees.sh --repair <name>` |

---

## Step 1: Determine intent

- **Creating**: derive name from ticket/task, select repos, pick branch strategy.
- **Listing**: run `--list`, show output.
- **Removing**: confirm name, warn irreversible before running.
- **Repairing**: use when symlinks break after moving or re-cloning the workspace.

---

## Step 2: Name the workspace

- Ticket-based: `ACTB-1234`, `SEO-567-fix-indexing`
- Feature-based: `mse-tiktok-redirect`, `content-pipeline-v2`
- Experimental: `perf-test`, `debug-session`

Script auto-converts spaces and `/` to `-`.

---

## Step 3: Select repos

From `repos.conf`:

| Repo | Domain |
|------|--------|
| SEOGPTContent | SEO content generation |
| seo-backoffice | SEO admin + frontend |
| seo-spark-jobs | SEO Spark ETL jobs |
| activity-backoffice | Activities admin |
| activity-content-api | Activity content serving |
| activity-marketing | Activity marketing service |
| activity-search | Activity search |
| activities-web | Activities web frontend |
| activities-agent-platform | Agent platform |
| sitemap-generator | Sitemap generation |
| agoda-url-generator | URL generation |
| agoda-prerender | Prerender service |
| universal-mq-injector | Message queue injection |
| cronos-seo | SEO cron jobs |
| hk-activity-svc | Activity ETL workflow |
| hk-activity-mkt-svc | Marketing ETL workflow |
| client-android | Android client app |
| konsole-android | Android Konsole app |
| activity-marketing-spark | Marketing Spark jobs |
| pricing_backend | Pricing backend |

---

## Step 4: Branch strategy

1. **Default** (no flag): creates `ws/<name>` from `origin/<default>`. Good for exploration.
2. **Existing** (`-b <branch>`): checks out an existing branch.
3. **New** (`-B <branch>`): creates branch from `origin/<default>`. Good for new features/tickets.

### Optional shallow acquisition

Full acquisition remains the default. Use `--depth N` (positive integer) when
limited history is sufficient for the task:

```bash
bash skills/architecture-manage-worktree/manage-worktrees.sh -n experiment -r Repo1 -B experiment --depth 1
```

- A new cache clones one branch with the requested depth. `-b <branch>` selects
  that branch; otherwise Git selects the remote default. The cache's initial
  branch also supplies the base for later default and `-B` worktrees.
- Reusing a shallow cache with `--depth` bounds its fetch to that depth. An
  explicit `-b` fetches the requested remote branch even if the initial clone
  did not include it. A missing remote branch fails before adding its worktree.
- Reusing a full cache with `--depth` keeps its full history. Omitting the option
  on a shallow cache keeps the existing shallow boundary; it does not request
  full history. Each repository has one shared object cache for all its tasks.

Shallow history limits blame, merge-base, historical search and commits available
for checkout. Tasks needing older commits must explicitly fetch them or deepen
the cache. These network operations affect every worktree sharing that cache:

```bash
git -C repo-cache/Repo1.git fetch --deepen=100 origin
# To restore full history in a shallow cache:
git -C repo-cache/Repo1.git fetch --unshallow origin
```

This opt-in changes acquisition only. Validate task results with the same rubric
before promoting it into a workflow default.

---

## Step 5: Run the command

```bash
# Create with interactive TUI repo picker
skills/architecture-manage-worktree/manage-worktrees.sh -n ACTB-1234

# Create with specific repos on a new branch
skills/architecture-manage-worktree/manage-worktrees.sh -n ACTB-1234 -r SEOGPTContent,seo-backoffice -B ACTB-1234

# List all workspaces
skills/architecture-manage-worktree/manage-worktrees.sh --list

# Remove a workspace (irreversible — warn user first)
skills/architecture-manage-worktree/manage-worktrees.sh --remove ACTB-1234
```

TUI picker: ↑/↓ navigate, space toggle, `a` all, enter confirm, `q` quit.

---

## Step 6: After creation — orchestrate agents

Report workspace path and repo branches. Then, if the user wants work done:

1. Spawn one worker agent per worktree with `worktrees/<name>/` as working directory and the overall task context.
2. Each worker agent spawns repo subagents — one per repo, each with `worktrees/<name>/<repo>/` as working directory.
3. Collect results back in this orchestrator session from the worker agents.

Do not spawn repo subagents directly from the orchestrator, and do not have a single agent work across multiple repos sequentially.

---

## Notes

- Bare clones cached in `repo-cache/<name>.git` — first clone slow, subsequent workspaces fast.
- `--repair` re-links `overlay/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.codex/`.
- Two live worktrees cannot share a branch — use `-B` for a new branch if already checked out elsewhere.
- Script uses `set -euo pipefail` — exits on first error with a clear message.
