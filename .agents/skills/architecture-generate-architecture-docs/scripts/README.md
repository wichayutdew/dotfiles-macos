# Architecture Documentation Scripts

These scripts provide deterministic checks for workspace and repository documentation status, making the architecture documentation generation process more reliable and consistent.

## Scripts

### check-workspace.sh

Checks workspace structure and properties.

**Usage:**
```bash
./check-workspace.sh [workspace-path]
```

**Output:** JSON with workspace properties
```json
{
  "workspace_root": "/path/to/workspace",
  "has_repos_conf": true,
  "has_overlay": true,
  "overlay_is_symlink": false,
  "overlay_target": "",
  "is_spawned_workspace": false
}
```

**Use cases:**
- Detect if running in a spawned workspace (overlay is symlink)
- Check if workspace has proper structure before generating docs
- Verify workspace root before running per-workspace mode

### classify-repo.sh

Classifies a repository's documentation readiness into one of three categories:
- `generated` - Has complete overlay/ documentation (all three files)
- `has_docs` - Has agentic documentation (CLAUDE.md, AGENTS.md, architecture/, ADRs)
- `no_docs` - No meaningful documentation detected

**Usage:**
```bash
./classify-repo.sh [repo-path]
```

**Output:** JSON with classification details
```json
{
  "repo_path": "/path/to/repo",
  "classification": "has_docs",
  "reason": "Has agentic documentation but missing complete overlay set",
  "has_complete_overlay": false,
  "has_claude_md": true,
  "has_agents_md": false,
  "has_architecture_dir": false,
  "has_adrs": false,
  "doc_paths": ["CLAUDE.md"],
  "overlay_files": {
    "event_catalog": false,
    "api_contracts": false,
    "system_map": false
  }
}
```

**Use cases:**
- Determine which repos need documentation generation
- Create repo-summary.md with accurate classification
- Decide which supporting material to read for workspace docs

## Integration with SKILL.md

These scripts are called during the documentation generation workflow:

1. **Workspace Validation (Per-Workspace Step 0):** Call `check-workspace.sh` to detect spawned workspaces
2. **Repo Classification (Per-Workspace Step 3):** Call `classify-repo.sh` for each repo to classify documentation readiness

Mode detection is handled directly by Claude interpreting the user's request — no script needed.
