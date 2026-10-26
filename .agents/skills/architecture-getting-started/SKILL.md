---
name: architecture-getting-started
description: |
  Walk through the architecture plugin workflow from scratch. Use when onboarding to
  a multi-repo workspace, setting up the plugin for the first time, or when someone asks
  how to get started with architecture documentation. Guides through installation, adding
  repos, and generating docs in per-repo or workspace mode.
user-invocable: true
---

# Getting Started

Use this skill to guide a user through the full architecture plugin workflow:

1. Confirm the plugin is available
2. Add or verify a repository in the workspace
3. Generate per-repo architecture docs
4. Optionally generate workspace-wide summary docs
5. Point to the next skill for cross-repo exploration

Keep the flow practical. Skip steps that are already complete.

---

## Overview

This plugin provides four skills:

- `architecture-getting-started` for guided setup and onboarding
- `architecture-add-repo` for workspace repo management
- `architecture-generate-architecture-docs` for per-repo and per-workspace documentation
- `architecture-search-code-sourcegraph` for cross-repo code search

The documentation generator has two modes:

- **Per-repo**: writes `overlay/event-catalog.md`, `overlay/api-contracts.md`, and `overlay/system-map.md`
- **Per-workspace**: writes `overlay/repo-summary.md`, `overlay/system-map.md`, `overlay/event-catalog.md`, and `overlay/api-contracts.md` at the workspace root (the same `overlay/` that downstream skills read from)

---

## Prerequisites Check

Before guiding the user, check:

- Is the `architecture` plugin installed and available?
- Does the workspace contain `repos.conf`?
- Does the target repo already exist under `repos/` or at another known path?
- Does the repo already have `overlay/` docs?
- Does the workspace already have `overlay/` docs at the workspace root (including `repo-summary.md`)?

Use those checks to decide which steps to skip.

---

## Step 1: Install Plugin

If the plugin is not installed, tell the user to install it from the activities-agent-platform repository using the AI tooling installer.

If the plugin is already installed, state that and continue.

---

## Step 2: Add a Repository

If the user wants to document a repo that is not present in the workspace:

1. Ask for the Git URL and optional directory name or branch if needed.
2. Invoke the `architecture-add-repo` skill rather than cloning manually.
3. Verify the repo was added to `repos.conf`.
4. Verify the working tree exists under `repos/<name>` or the expected path.

If the repo already exists, skip this step and confirm the path you will use.

---

## Step 3: Generate Per-Repo Docs

Guide the user to run `architecture-generate-architecture-docs` in per-repo mode for the chosen repo.

Before verifying, determine the actual repo path from Step 2. This could be `repos/<name>` for workspace-managed repos or another path if the user is working in a standalone repo.

Expected result at `<repo-root>/overlay/`:

- `<repo-root>/overlay/event-catalog.md`
- `<repo-root>/overlay/api-contracts.md`
- `<repo-root>/overlay/system-map.md`

After generation, verify those files exist at the actual repo path. If they already exist, note that the repo has generated docs and they can be refreshed if the code changed.

---

## Step 4: Generate Workspace Summary

Offer this step when the workspace has multiple repos or the user wants a cross-repo view.

Guide the user to run `architecture-generate-architecture-docs` in workspace mode.

Expected result at the workspace root `overlay/`:

- `overlay/repo-summary.md`
- `overlay/system-map.md`
- `overlay/event-catalog.md`
- `overlay/api-contracts.md`

After generation, verify those files exist at the workspace root and mention that `repo-summary.md` should classify repos as:

- `generated` - Has all three overlay files
- `has_docs` - Has agentic documentation but incomplete overlay
- `no_docs` - No meaningful documentation detected

---

## Step 5: Next Steps

After setup:

- Use `architecture-search-code-sourcegraph` for cross-repo investigation and symbol tracing
- Run `architecture-generate-architecture-docs` for more repos until the workspace summary improves
- Refresh repo-local docs after significant API, event, or infrastructure changes

If the user asks for the quickest path, prefer:

1. Add repo
2. Generate per-repo docs
3. Generate workspace summary
4. Use cross-repo search as needed

---

## Operating Rules

1. Prefer action over explanation, but explain what step you are on.
2. Reuse existing workspace state instead of repeating completed setup.
3. Never clone repos manually when `architecture-add-repo` should handle it.
4. Never claim docs were generated until the expected files exist.
5. If the user only wants one repo documented, stop after Step 3 unless they ask for the workspace view.
