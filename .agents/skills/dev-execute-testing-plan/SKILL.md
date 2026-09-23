---
name: dev-execute-testing-plan
description: |
  Executes the testing plan for any MR using the dev-playwright-cli skill against a deployed environment (devstack, staging, or any URL recorded in the progress file).
  Reads the testing plan for the given JIRA ID, derives appropriate browser automation steps for each scenario, collects screenshot evidence, and updates the implementation progress file checklist with pass/fail per AC.
  Trigger when: a deploy job has completed for an MR (or the deployed URL is already recorded in the progress file), a testing plan exists at .sdd/output/testing-plan/JIRA-ID.md, and the user asks to execute, run, or verify the testing plan.
---

# Execute Testing Plan

1. Get the deployed URL
2. Read the testing plan
3. Load repo testing guidelines
4. Execute each scenario (includes creating evidence directory)
5. Update the progress file
6. Upload evidence to GitLab
7. Post MR note with collapsible evidence
8. Update MR description if an evidence table is present

---

## Step 1: Get the Deployed URL

Read `.sdd/output/implementation_progress/<jira-id>.md` for any of:
- `**Devstack URL:**`
- `**Test URL:**`
- `stack-XXXXX-www.devstack.qa.agoda.is`

**If missing**, poll GitLab CI:

1. `mcp__gitlab__get_merge_request` → `pipeline.id`, project path
2. `mcp__gitlab__list_pipeline_jobs` → find job where name contains "devstack", note `id` and `name`
3. Poll until complete — call `mcp__gitlab__get_pipeline_job(project_id=<project>, job_id=<job_id>)` every 30 seconds until `status` is `success`, `failed`, or `canceled`.
4. `mcp__gitlab__get_pipeline_job_output` → grep for `devstack.qa.agoda.is`
5. Extract URL (`https://stack-XXXXXXX-www.devstack.qa.agoda.is`) and save under `**Devstack URL:**` in the progress file.

---

## Step 2: Read the Testing Plan

Read `.sdd/output/testing-plan/<jira-id>.md`. Identify each scenario: what it checks, what page it needs, pass/fail criteria.

**Do not assume the scenarios.** Every ticket has different ACs.

| What the plan describes | Pattern to use |
|------------------------|----------------|
| "element is visible", "component renders", "text content" | DOM assertion |
| "URL contains X after clicking Y" | Navigation URL assertion |
| "API request includes param X" | Request interception |
| "API response has field Y" | Response interception |
| "icon is correct", "attribute value is X" | DOM attribute assertion |
| "page loads", "screenshot of state" | Navigate + screenshot only |

---

## Step 3: Load Repo Testing Guidelines

```bash
fd "testing-guide" .agents/skills/ --type d
```

If a skill matching `*-testing-guidelines` or `*-testing-guide` is found, invoke it via `Skill`. Use output as context for navigation in Step 4.

---

## Step 4: Execute Each Scenario

Create the evidence directory before any scenario runs:
```bash
mkdir -p $(git rev-parse --show-toplevel)/.sdd/output/testing-evidence/<jira-id>/
```

### Subagent Execution Rules

- **Use foreground subagents** — never `run_in_background: true`
- **One subagent per scenario group** (e.g. happy-path together, regression together)

Invoke the `dev-playwright-cli` skill inside each subagent, then run commands via Bash:

1. `playwright-cli open --headed <BASE_URL><path>`
2. `playwright-cli snapshot` — get element refs (`e1`, `e2`, …)
3. Interact: `playwright-cli click e5` / `playwright-cli fill e3 "text"` / `playwright-cli eval "el => el.textContent" e7`
4. Network assertions: `playwright-cli network` after the triggering interaction
5. Assert: `playwright-cli eval "document.URL"` / `playwright-cli eval "el => el.getAttribute('data-testid')" e4`
6. Screenshot: `playwright-cli screenshot --filename=$(git rev-parse --show-toplevel)/.sdd/output/testing-evidence/<jira-id>/scenario-<slug>.png`
7. `playwright-cli close`

Determine PASS/FAIL from eval output. Mark SKIP with a reason if required data is absent.

---

## Step 5: Update the Progress File

Update the testing/AC section in `.sdd/output/implementation_progress/<jira-id>.md`:

```markdown
| AC | Scenario | Result | Evidence |
|----|----------|--------|----------|
| AC1 | <description> | ✅ PASS | `.sdd/output/testing-evidence/<jira-id>/scenario-01.png` |
| AC2 | <description> | ❌ FAIL | Error: expected X but got Y |
| AC3 | <description> | ⚠️ SKIP | No matching data in live environment |
```

---

## Step 6: Upload Evidence to GitLab

1. Find all evidence files:
   ```bash
   find $(git rev-parse --show-toplevel)/.sdd/output/testing-evidence/<jira-id>/ \
     -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.mp4" \) | sort
   ```

2. Upload (requires `GITLAB_TOKEN` env var):
   ```bash
   python3 "${SKILL_ROOT}/scripts/upload-mr-evidence.py" \
     "<project_path>" <file1> <file2> ...
   ```
   If `GITLAB_TOKEN` is not set, stop and ask the user.

3. Parse the JSON output and build a `filename → {markdown, absolute_url}` mapping.

---

## Step 7: Post MR Note with Collapsible Evidence

Post using `mcp__gitlab__create_merge_request_note` (`project_id`, `merge_request_iid`, `body`).

Body format:

```markdown
## Testing Evidence — <JIRA-ID>

| AC | Scenario | Result |
|----|----------|--------|
| AC1 | <description> | ✅ PASS |
| AC2 | <description> | ❌ FAIL |
| AC3 | <description> | ⚠️ SKIP |

<details>
<summary>AC1 — <description> ✅ PASS</summary>

![scenario-ac1](absolute_url)

</details>

<details>
<summary>AC2 — <description> ❌ FAIL</summary>

**Error:** expected X but got Y

</details>

<details>
<summary>AC3 — <description> ⚠️ SKIP</summary>

No matching data available in live environment.

</details>
```

Include every AC. PASS → embed image (`absolute_url` from Step 6). FAIL → error message. SKIP → reason. Omit `<details>` if no evidence.

Construct the note URL from the returned `id`:
```
https://gitlab.agodadev.io/<project_path>/-/merge_requests/<mr_iid>#note_<note_id>
```

---

## Step 8: Update MR Description with Evidence

1. `mcp__gitlab__get_merge_request` → read current description
2. Scan for a markdown table with headers containing `Evidence`, `Screenshot`, `Result`, `AC`, or `Test` (case-insensitive). **If none found, skip this step.**
3. For each row, update the evidence cell with the uploaded image markdown. After the table, append:
   ```
   **More Evidence:** [Note (Testing Screenshots)](<note_url_from_step_7>)
   ```
4. `mcp__gitlab__update_merge_request` (`project_id`, `merge_request_iid`, `description`) — only modify evidence cells and the appended line.

---

## Troubleshooting

**Element ref not found**: Take a fresh `playwright-cli snapshot` — refs change after every navigation or DOM update. Never reuse refs across interactions.

**Devstack URL is stale**: The bot edits its MR comment in place on every push. If the stored URL returns ECONNREFUSED, check MR comments for the current URL and update the progress file.
