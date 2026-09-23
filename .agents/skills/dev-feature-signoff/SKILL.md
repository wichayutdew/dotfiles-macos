---
name: dev-feature-signoff
description: Automate feature sign-off documentation with test scenarios, A/B URLs, screenshot capture, and video recording for JIRA tickets
---

# Feature Sign-off Automation Skill

Automate feature sign-off documentation with screenshots, videos, and interactive editing support.

**Repository-aware** — detects current repository and uses domain-specific URL patterns from skill references.

## Usage

- `/dev-feature-signoff ACTD-370` - Start document generation
- `/dev-feature-signoff ACTD-370 edit` - Open editing mode
- `/dev-feature-signoff ACTD-370 capture` - Start media capture (screenshots/videos)
- `/dev-feature-signoff ACTD-370 publish` - Publish to Confluence (ADF format with embedded images)

## Configuration

**Default Confluence Host**: `agoda.atlassian.net`

To use a different Confluence instance, set the `CONFLUENCE_HOST` environment variable before running the skill:

```bash
export CONFLUENCE_HOST="yourcompany.atlassian.net"
/dev-feature-signoff ACTD-370 publish
```

The skill will:
1. Look for credentials under `hosts.yourcompany.atlassian.net` in `~/.confluence/feature-sign-off-publish-config.yml`
2. Build Confluence URLs using `https://yourcompany.atlassian.net`
3. Support multiple hosts in the same config file (credentials are stored per-host)

## Authentication Architecture

**IMPORTANT**: This skill uses **two separate authentication mechanisms** for different purposes:

1. **YML File Authentication** (`~/.confluence/feature-sign-off-publish-config.yml`):
   - Used for: **Confluence publishing workflow** (uploading screenshots, embedding images)
   - Why: MCP **cannot** upload binary files (images)
   - Format: Email + Personal Access Token (PAT)
   - Stored in: `~/.confluence/feature-sign-off-publish-config.yml`
   - All REST API calls in `publish` use these credentials

2. **MCP Authentication** (Atlassian OAuth):
   - Used for: **Document generation workflow** (fetching JIRA tickets, finding MRs, searching pages)
   - Why: Convenient for read-only operations
   - Configured via: Claude Code's MCP settings
   - NOT used for file uploads or binary operations

**Key Point**: When you run `publish`, the script **only checks yml file** for credentials. MCP may connect in the background for other operations, but publishing uses yml credentials exclusively.

## Input

$ARGUMENTS

---

## Step 1: Parse Arguments

Parse user input:
- **Position 1**: JIRA ID (required) - Format: `ACT[A-Z]?-\d+`
- **Position 2**: Command (optional) - Values: `generate` (default), `edit`, `capture`, `publish`

**Validation**:
- No arguments → Error: "Please provide a JIRA ID. Usage: `/dev-feature-signoff ACTD-370`"
- Invalid format → Error: "Invalid JIRA ID format. Expected: ACTD-XXX or ACT-XXX"

Store: `jira_id = {extracted}`, `command = {extracted or "generate"}`

---

## Step 2: Route to Workflow

**IMPORTANT**: If command is `publish`, show this message FIRST before any operations:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Confluence Publishing Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This workflow uploads images and publishes to Confluence using:

✓ Credentials from: ~/.confluence/feature-sign-off-publish-config.yml
✓ Authentication: Email + PAT (Personal Access Token)
✓ API: Confluence REST API

⚠️  IMPORTANT:
    • MCP authentication is NOT used for this workflow
    • If you see MCP connection prompts, ignore them
    • Only yml file credentials are used for uploading/publishing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

| Command | Workflow |
|---------|----------|
| `generate` or empty | [Document Generation](#workflow-1-document-generation) |
| `edit` | [Interactive Editing](#workflow-2-interactive-editing) |
| `capture` | [Media Capture](#workflow-3-media-capture) |
| `capture` | [Screenshot Capture](#workflow-3-screenshot-capture) |
| `publish` | [Confluence Publishing](#workflow-4-publishing) |
| `full-auto` | [Full Automation](#workflow-5-full-automation) |

Unknown command → Error: "Unknown command. Use: generate, edit, capture, publish, or full-auto"

---

# Workflow 1: Document Generation

## Step 1: Fetch JIRA Context

Use `mcp__atlassian__getJiraIssue`:
```
cloudId: "agoda.atlassian.net"
issueKey: {jira_id}
```

Extract: Summary, Description, Acceptance Criteria, Epic Link, Experiment ID (ACT-XXX pattern), Figma Links (figma.com URLs)

Show summary:
```
📋 JIRA Ticket: {jira_id}
Title: {summary}
Epic: {epic_link or "None"}
Experiment: {experiment_id or "Not specified"}
Description: {first 200 chars}...
```

Fail → Error: "Failed to fetch JIRA ticket {jira_id}. Check ID and permissions."

---

## Step 2: Ask MR Analysis Preference

Via AskUserQuestion:

**Question:** "Would you like to analyze related merge requests for detailed test scenarios?"

**Options:**
- **Skip MR Analysis (Recommended)** - Generate sign-off from JIRA ticket only. Faster, suitable when JIRA has clear acceptance criteria and description.
- **Include MR Analysis** - Find and analyze related MRs (Basic/Hybrid/Deep). Useful when JIRA lacks details or you want to validate implementation against requirements.

**Store:** `include_mr_analysis = {true|false}`

**Routing:**
- If `false` → Skip to [Step 7: Query Top 10 Activities](#step-7-query-top-10-activities)
- If `true` → Continue to Step 3

---

## Step 3: Find Related MRs

**Note:** This step only runs if `include_mr_analysis = true`

**Phase 1: Determine Scope**

Fetch ticket with `mcp__atlassian__getJiraIssue`, check `issuetype`:
- **If Epic** → Find children: `searchJiraIssuesUsingJql` with `jql: 'parent = "{epic_id}"'`
- **If Story** → Get epic from `parent`/`customfield_10014`, find siblings

Store all: `ticket_ids = [epic, story, siblings...]`

**Phase 2: Search GitLab**

For each ticket ID:
1. Try `mcp__gitlab__get_merge_request` with `source_branch: {ticket_id}`
2. Extract: `iid, title, state, url, project_path, source_ticket`
3. Log: `✓ Found !{iid}: {title} ({state})`

Try projects: `activities-web`, `activities-bff`, `activities-api`

**Phase 3: Fallback - Jira Remote Links**

If GitLab search fails, use `mcp__atlassian__getJiraIssueRemoteIssueLinks`:
- Parse URLs: `gitlab.agodadev.io/.*/merge_requests/(\d+)`
- Fetch MR details

**Phase 4: Deduplicate & Show**

Dedupe by `{project}!{iid}`. Display:
```
📦 Found {count} merge request(s):
✓ !4278 (activities-web) [MERGED] - ACTD-367: Add Image Gallery
✓ !4420 (activities-web) [OPENED] - ACTD-441: Analytics tracking
Summary: {total} MRs, {merged} merged, {open} open
```

No MRs found → Error: "No MRs found for {jira_id}. Add MR links to JIRA or provide manually."

---

## Step 4: Ask Analysis Depth

**Note:** This step only runs if `include_mr_analysis = true`

Via AskUserQuestion:
- **A. Basic** (~30s) - Files changed + descriptions
- **B. Hybrid** (~2min) - Files + keyword scanning (components, flags, APIs)
- **C. Deep** (~5min) - Full diff analysis, comprehensive impact

Store: `analysis_depth`

---

## Step 5: Analyze MRs

**Note:** This step only runs if `include_mr_analysis = true`

For each MR:
1. Fetch details: `mcp__gitlab__get_merge_request`
2. Fetch diffs: `mcp__gitlab__get_merge_request_diffs`
3. Analyze based on depth:

**Basic**: List changed files, categorize (UI: `*.tsx`, API: `*Controller.*`, Config: `*.json`, Test: `*.test.*`)

**Hybrid** (Basic +): Scan diff keywords:
- Components: `export (function|const) \w+Component`
- Experiments: `ACT-\d+`
- API routes: `@(Get|Post)Mapping`
- New components, modified flows, A/B flags

**Deep** (Hybrid +): Line-by-line parsing:
- Import statements → affected components
- Form fields, navigation routes, data types, state changes

---

## Step 6: Generate Test Scenarios

**Primary source: JIRA Acceptance Criteria**

Always start by parsing JIRA ticket for test requirements:
- **Acceptance Criteria** (primary) — Each AC item must map to at least one test scenario
- **Description** — Feature details and business context
- **Experiment ID** (if exists) → A/B variant tests (mandatory)
- **Figma links** (if exists) → Visual regression tests

**If `include_mr_analysis = true`:**

Supplement AC-based scenarios with MR analysis for technical validation:
- UI changes → Visual regression (screenshots A/B)
- Form changes → Validation, submission tests
- API changes → Data validation, error handling
- Experiment flags → A/B variant tests (mandatory)
- Responsive changes → Multi-platform tests
- i18n → Translation tests

**Important:** AC items take precedence. MR analysis adds detail but does not replace AC coverage. Every AC item must have at least one test scenario.

**If `include_mr_analysis = false`:**

Use AC as the sole source for test scenarios. Infer common scenarios (page load, navigation, error handling) only when AC is incomplete.

**Generate 2 formats:**

1. **Quick Reference Table**:
```markdown
| Test Scenario | Variant A | Variant B | Platform | Priority | Rationale |
|---|---|---|---|---|---|
| Detail page loads | ✅ | ✅ | Desktop | High | AC-1: Page must load |
```

2. **Detailed Narrative** (for each scenario):
- Description, Pre-conditions, Test Steps, Expected Result, Evidence Required, AC Coverage

Show draft. Ask: Approve / Edit / Regenerate (or with different MR depth if analysis was included)

---

## Step 7: Query Top 10 Activities

Show SQL query (from `${SKILL_ROOT}/references/query-examples.md`):
```sql
SELECT fba.activity_id, da.activity_title, COUNT(*) AS booking_count, 
       da.city_id, da.activity_main_category_name
FROM bi_dw.fact_booking_activity fba
INNER JOIN bi_dw.dim_activity da ON fba.activity_id = da.activity_id
WHERE fba.whitelabel_id = 1 AND da.activity_servable = 1 
  AND fba.datadate >= CAST(DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 90 DAY), '%Y%m%d') AS INT)
GROUP BY fba.activity_id, da.activity_title, da.city_id, da.activity_main_category_name
ORDER BY booking_count DESC LIMIT 10;
```

Wait for user to paste results or type "skip".

**Parse results**: Extract `activity_id, title, city_id, category`
**Manual input**: Accept comma-separated IDs, ask for cityId per activity

No data → Error: "Cannot generate without activity data."

---

## Step 8: Generate Document

### Step 7.0: Detect Repository and Load URL Pattern

**Detect current repository:**

Use bash command to get repository name:
```bash
git remote get-url origin 2>/dev/null || basename $(pwd)
```

Extract repository name from URL:
- `git@gitlab.agodadev.io:Activities/activities-web.git` → `activities-web`
- `https://gitlab.agodadev.io/Activities/activities-web.git` → `activities-web`

Store: `repo_name = {extracted_name}`

**Load repository-specific URL pattern:**

**For activities-web repository:**
- Invoke `/activities-web-ui-testing-guidelines` skill to get:
  - Base URL (production: `https://hkg.agoda.com`)
  - Detail page URL format: `<BASE_URL>/activities/detail?activityId={id}&cityId={city}&explist={exp}={variant}`
  - Multi-experiment format: `explist=ACT-5017=A,ACTD-370=B`
  - Anti-patterns to avoid (search page URLs)

**For other repositories:**
- Check `${SKILL_ROOT}/references/` directory for `{repo_name}.md`
- If not found → Exit with error: "No URL pattern configuration found for {repo_name}"

Show confirmation:
```
📋 Loaded URL pattern for {repo_name}
Format: {url_format_example}
```

Store: `url_pattern = {parsed_pattern}`

**If URL pattern cannot be determined:**

Exit and show error:
```
❌ No URL pattern configuration found for repository: {repo_name}

Currently supported repositories:
- activities-web

To add support for {repo_name}, create:
${SKILL_ROOT}/references/{repo_name}.md

See ${SKILL_ROOT}/references/activities-web.md for template.
Contact Platform team for assistance.
```

Stop execution. Do not continue to document generation.

---

### Step 7.1: Fill Template

Read template from `${SKILL_ROOT}/references/signoff-template.md`.

**Fill placeholders:**
- **Metadata**: date, epic_link, figma_link, experiment_id, calculon_link, behavior_name, scope, platforms, complexity
- **Feature Details**: description (from JIRA), experiment_goals, acceptance_criteria, user_journey
- **Design References**: figma_link, key_components, interaction_states, responsive_behavior
- **Technical Context**: affected_repos (from MR analysis), dependencies, integration_points
- **Test Scenarios**: Both quick reference table AND detailed narrative format
- **Sanity Testing Table**: Generate URLs using `url_pattern` from Step 7.0:
  
  Build URLs by replacing placeholders in the pattern:
  - `{id}` → activity/entity ID
  - `{city}` → cityId
  - `{exp}` → experiment ID
  - `{variant}` → A or B
  
  **Table format:**
  ```
  | Entity ID | Variant A URL | When EXP=A | Variant B URL | When EXP=B | Remarks |
  | {id} | {url_with_variant_A} | [ ] | {url_with_variant_B} | [ ] | |
  ```
- **Monitoring Plan**: Include alert thresholds
- **Stakeholders**: Designer, PO, Engineering Lead
- **Out of Scope**: Extract from JIRA or mark "TBD"
- **References**: JIRA, Figma, MRs, Slack, Grafana links

**Sections to leave as placeholders:**
- E2E test cases (specific test names)
- Data sources & stored procs (if applicable)
- CMS translations (if applicable)
- Performance testing (if applicable)
- Accessibility (if applicable)

### Write Document

Create output directories:
```bash
mkdir -p .sdd/output/signoff/{jira_id}/{scripts,media}
```

Write document:
```
Write({
  file_path: `.sdd/output/signoff/{jira_id}/signoff.md`,
  content: {filled_template}
})
```

### Show Summary

```
✅ Sign-off document created!

📄 Location: .sdd/output/signoff/{jira_id}/signoff.md
📊 Includes: Metadata, {count} test scenarios, {count} activities with A/B URLs

Next steps:
1. Review document
2. Edit: /dev-feature-signoff {jira_id} edit
3. Generate test scripts (optional): Continue to Step 8
```

---

## Step 9: Generate Test Scripts (Optional)

Ask user via AskUserQuestion:

**Question:** "Would you like to generate media capture scripts now?"

**Header:** "Script Generation"

**Options:**

1. **Screenshots Only (Recommended)** - Generate screenshot capture script from the sanity table. Best for A/B visual comparison.
   
2. **Videos Only** - Generate video recording script from detailed test scenarios. Shows interactive flows and dynamic behavior.

3. **Both Screenshots and Videos** - Generate both scripts for complete testing evidence.

4. **Chrome Recorder** - I have a Chrome DevTools Recorder JSON export. Convert it to a playwright-cli script.

5. **Skip** - Skip for now. Generate scripts later with `/dev-feature-signoff {jira_id} capture`.

**Store choice:** `script_generation_choice`

**Routing:**
- Choice 1 (Screenshots Only) → Continue to [Option B: AI Auto-generate Screenshots](#option-b-ai-auto-generate-screenshots)
- Choice 2 (Videos Only) → Continue to [Option C: AI Auto-generate Videos](#option-c-ai-auto-generate-videos)
- Choice 3 (Both) → Continue to [Option D: AI Auto-generate Both](#option-d-ai-auto-generate-both)
- Choice 4 (Chrome Recorder) → Continue to [Option A: Chrome Recorder](#option-a-chrome-recorder)
- Choice 5 (Skip) → Show completion message and exit

**Exit message (if Skip):**
```
✅ Sign-off document complete!

Next steps:
1. Review: .sdd/output/signoff/{jira_id}/signoff.md
2. Edit document: /dev-feature-signoff {jira_id} edit
3. Capture media: /dev-feature-signoff {jira_id} capture

When you're ready to capture screenshots/videos, run the capture command.
It will generate the scripts and execute them in test-first mode.
```

---

## Option A: Chrome Recorder

### Request JSON

Show instructions:
1. Open DevTools (F12) → Recorder tab
2. Record test flow → Export as JSON
3. Paste JSON below

Wait for user input.

### Validate & Parse JSON

Parse and validate:
- Must have `title` (string) and `steps` (array)
- Each step needs `type` field

Invalid → Error: "Invalid format. See `${SKILL_ROOT}/references/chrome-recorder-spec.md`"

Extract from recording:
1. **URLs** - activity IDs (regex: `activityId=(\d+)`), city IDs, experiment params
2. **Actions** - clicks, form fills, scrolls
3. **Test intent** - A/B test, purchase flow, validation

### Generate playwright-cli Command Script

**Reference:** See `${SKILL_ROOT}/references/captureScreenshot.md` for script structure and playwright-cli commands.

**Conversion mapping** (see `references/chrome-recorder-spec.md` for complete spec):
- Convert Chrome Recorder JSON steps to playwright-cli commands
- Map action types: `navigate` → `goto`, `click` → `click`, `change` → `fill`, etc.
- Add screenshot commands after key actions
- Generate two flows for A/B variant testing (use URLs from sanity table)
- Insert resize commands before screenshots

**Output:**
1. Generate script at `.sdd/output/signoff/{jira_id}/scripts/capture.sh`
2. Make executable: `chmod +x scripts/capture.sh`
3. Continue to [Workflow 3](#workflow-3-screenshot-capture) to execute

---

## Option B: AI Auto-generate Screenshots

### Analyze Document & MRs

Read generated document + MR diffs. Extract:
- Activity IDs from sanity table
- Test scenarios (determine critical user flows)
- Experiment flags (A/B variants)

### Generate playwright-cli Screenshot Script

**Reference:** See `${SKILL_ROOT}/references/captureScreenshot.md` for complete script structure.

**Generate script:**
1. Extract activity IDs, city IDs, and variant URLs from sanity table
2. Use script template from `captureScreenshot.md` reference
3. Fill `ACTIVITIES` array with pipe-delimited entries
4. Generate loops for capturing each activity's A/B variants
5. Save to `.sdd/output/signoff/{jira_id}/scripts/capture.sh`
6. Make executable: `chmod +x scripts/capture.sh`

Continue to [Workflow 3](#workflow-3-media-capture) to execute.

---

## Option C: AI Auto-generate Videos

### Analyze Document Test Scenarios

Read generated document. Extract from "Detailed Test Scenarios" section:
- Scenario descriptions
- Test steps (navigate, click, fill, select, etc.)
- Expected results
- A/B variant URLs from sanity table

### Generate playwright-cli Video Script

**Reference:** See `${SKILL_ROOT}/references/videoCapture.md` for complete script structure with per-scenario element mapping.

**Generate script:**
1. Parse detailed test scenarios section
2. Extract scenario ID, name, start URL, and test steps
3. Use script template from `videoCapture.md` reference
4. Fill `SCENARIOS` array with pipe-delimited entries: `{id}|{name}|{url}|{step1}|{step2}|...`
5. Include helper functions: `fuzzy_match()`, `build_element_map()`, `execute_step()`
6. Generate per-scenario element mapping workflow (navigate → snapshot → map → record)
7. Save to `.sdd/output/signoff/{jira_id}/scripts/capture-video.sh`
8. Make executable: `chmod +x scripts/capture-video.sh`

**Key Implementation Notes:**
- Element references (e5, e12, etc.) change between pages/variants
- Must capture fresh snapshot and rebuild element map for EACH scenario
- Use fuzzy matching to auto-map action text to element names
- Include test-first workflow support (`--test-only` flag)

Continue to [Workflow 3](#workflow-3-media-capture) to execute.

---

## Option D: AI Auto-generate Both

### Generate Both Scripts

Execute both Option B and Option C workflows:

1. **Screenshot Script:**
   - Follow [Option B](#option-b-ai-auto-generate-screenshots) steps
   - Save to `.sdd/output/signoff/{jira_id}/scripts/capture.sh`

2. **Video Script:**
   - Follow [Option C](#option-c-ai-auto-generate-videos) steps
   - Save to `.sdd/output/signoff/{jira_id}/scripts/capture-video.sh`

Show confirmation:
```
✅ Scripts generated:
1. Screenshots: scripts/capture.sh
2. Videos: scripts/capture-video.sh

Next: Test-first workflow will run screenshots first, then videos.
```

Continue to [Workflow 3](#workflow-3-media-capture) to execute.

---

# Workflow 2: Interactive Editing

## Standard Edit Flow

**Pattern**: Read document → Find section/field → Edit → Confirm

**Success message format**: `✅ {Action} updated\n{Preview}\nDocument saved: .sdd/output/signoff/{jira_id}/signoff.md`

---

## Step 1: Check Document

Use Read tool on `.sdd/output/signoff/{jira_id}/signoff.md`

Not found → Error: "No document exists. Run `/dev-feature-signoff {jira_id}` first."

Found → Show welcome:
```
📝 Interactive Editing Mode
Document: .sdd/output/signoff/{jira_id}/signoff.md

Commands:
1. add overview: <text> - Update feature description
2. remove activity <id> - Remove from sanity table
3. change experiment to <exp_id> - Update all URLs
4. add activity <id> - Add to sanity table
5. update section <name>: <content> - Update any section
6. list activities - Show current activities
7. show config - Show metadata
```

---

## Step 2: Parse & Execute Commands

**Command patterns** (case-insensitive regex):

| Command | Pattern | Target | Action |
|---------|---------|--------|--------|
| add overview | `^add overview:\s*(.+)` | `## ✨ Feature Details` → `* **Feature Description**:` | Replace |
| remove activity | `^remove activity\s+(\d+)` | Sanity table row with `| {id} \|` | Delete row |
| change experiment | `^change experiment to\s+([A-Z]+-\d+)` | All `explist={old}=` patterns + metadata table | Replace all |
| add activity | `^add activity\s+(\d+)` | End of sanity table | Insert row (ask cityId first) |
| update section | `^update section\s+(.+?):\s*(.+)` | Fuzzy match `## {name}` | Replace section content |
| list activities | `^list activities` | Parse sanity table | Display formatted list |
| show config | `^show config` | Parse metadata + counts | Display config |

**No match** → Show error with command list

### Execute: add overview
Find `* **Feature Description**:` line → Replace content

### Execute: remove activity
Find table row `| {activity_id} |` → Delete entire row

### Execute: change experiment
1. Replace `explist={old}=` with `explist={new}=` (replace_all: true)
2. Update metadata table `| **Experiment** |` row
3. Count replacements

### Execute: add activity
1. Ask cityId via AskUserQuestion
2. Generate URLs: `https://hkg.agoda.com/activities/detail?activityId={id}&cityId={city}&explist={exp}=A/B`
3. Insert row at end of sanity table

### Execute: update section
1. Fuzzy match section heading (try exact → partial → ask if multiple matches)
2. Replace content between `## {heading}` and next `##`

### Execute: list activities
Parse sanity table → Show:
```
📋 Activities: {count} total
| Activity ID | City ID | Variant A | Variant B | Status |
| 1252815 | 2656 | ✅ | ✅ | Tested |
| 9876543 | 3952 | [ ] | [ ] | Pending |
```

### Execute: show config
Parse metadata table + count activities/scenarios → Show config summary

---

## Step 3: Continue or Exit

After command: Ask "Enter another command / type 'help' / 'done' / 'show'"

- `help` → Show command list
- `done` → Exit with summary
- `show` → Read and display full document
- Another command → Go to Step 2

---

# Workflow 3: Media Capture

## Step 0: Choose Capture Type

Ask via AskUserQuestion:

**Question:** "What type of media would you like to capture for testing evidence?"

**Header:** "Capture Type"

**Options:**

1. **Screenshots Only (Recommended)** - Capture static A/B variant screenshots for sanity testing table. Fast and suitable for visual regression checks.

2. **Videos Only** - Record interactive test scenarios from the "Detailed Test Scenarios" section. Best for demonstrating user flows and dynamic behavior.

3. **Both Screenshots and Videos** - Complete evidence package with both static screenshots and scenario videos. Most comprehensive but takes longer.

**Store choice:** `capture_type = {screenshots | videos | both}`

**Routing:**
- `screenshots` → Continue to Step 1 (Screenshot Workflow)
- `videos` → Skip to Step 6 (Video Recording Workflow)
- `both` → Continue to Step 1, then proceed to Step 6 after screenshots complete

---

## Step 1: Check Prerequisites (Screenshots)

### 1.1: Check Document

Read `.sdd/output/signoff/{jira_id}/signoff.md`

Not found → Error: "No document exists. Run `/dev-feature-signoff {jira_id}` first."

### 1.2: Check playwright-cli Availability

```bash
which playwright-cli || echo "Install: npm install -g @playwright/cli"
```

Not available → Error: "playwright-cli not found. Install: npm install -g @playwright/cli"

### 1.3: Check for Existing Script

Check if `.sdd/output/signoff/{jira_id}/scripts/capture.sh` exists:

```bash
ls -lh .sdd/output/signoff/{jira_id}/scripts/capture.sh 2>/dev/null
```

**If script exists:**

Read and analyze the script:
```bash
cat .sdd/output/signoff/{jira_id}/scripts/capture.sh
```

Show summary:
```
📜 Existing script found
Created: {modification_date}
Activities: {count from ACTIVITIES array}
Total screenshots: {count × 2}

The script appears to be configured for the current document.
```

Ask via AskUserQuestion:

**Question:** "A capture script already exists. What would you like to do?"

**Options:**
- **Reuse existing script (Recommended)** - Use the current script without changes. Skips to test capture (Step 3).
- **Edit script manually** - Opens the script file for you to modify, then continues to test capture (Step 3).
- **Regenerate from document** - Deletes the old script and generates a fresh one from the current document's sanity table (Step 2).

**Routing:**
- **Reuse** → Skip to [Step 3](#step-3-test-first-workflow)
- **Edit** → Show file path, wait for user confirmation, then go to [Step 3](#step-3-test-first-workflow)
- **Regenerate** → Delete script, continue to Step 2

**If script doesn't exist:**
- Continue to Step 2 (generate script)

---

## Step 2: Generate Script

**Note:** This step only runs if:
- No existing script found in Step 1.3, OR
- User chose "Regenerate script" in Step 1.3

### Step 2.1: Parse Activity Table

Extract from document (`.sdd/output/signoff/{jira_id}/signoff.md`):
- Experiment ID: From metadata table
- Activity rows: Parse sanity table → `{activity_id, cityId, urlA, urlB}`

Parse the sanity testing table (look for section `## 🧪 Sanity Testing`):
```markdown
| Entity ID | Variant A URL | When EXP=A | Variant B URL | When EXP=B | Remarks |
| 1252815 | https://... | [ ] | https://... | [ ] | |
| 9876543 | https://... | [ ] | https://... | [ ] | |
```

Extract each row → Store as array: `activities = [{id, cityId, urlA, urlB}, ...]`

### Step 2.2: Show Preview & Confirm

```
📊 Capture Plan
Activities: {count}
Variants: 2 (A, B)
Platforms: Desktop (1920×1080)
Total: {count × 2} screenshots
Estimated: ~{count × 10} seconds

Using playwright-cli for browser automation

Activities to capture:
1. {activity_id_1} (City: {city_id_1})
2. {activity_id_2} (City: {city_id_2})
...

Proceed with script generation?
```

User confirms → Continue to Step 2.3  
User cancels → Exit workflow

### Step 2.3: Generate playwright-cli Script

**Reference:** See `${SKILL_ROOT}/references/captureScreenshot.md` for complete script structure, playwright-cli commands, and best practices.

**Generate script:**
1. Parse activities from document's sanity testing table
2. Extract: `{activity_id, cityId, url_A, url_B}` per row
3. Use script template from `captureScreenshot.md` reference
4. Fill `ACTIVITIES` array with pipe-delimited entries: `"{id}|{city}|{urlA}|{urlB}"`
5. Write to `.sdd/output/signoff/{jira_id}/scripts/capture.sh`
6. Make executable: `chmod +x scripts/capture.sh`

**Script features:**
- `./capture.sh --test-only` - Test mode (first activity only)
- `./capture.sh` - Batch mode (all activities)
- Error handling with success/failure counts
- Real-time progress output

---

## Step 3: Test-First Workflow

### Step 3.1: Run Test Capture

Execute the generated script in **test mode** (captures first activity only):

```bash
cd .sdd/output/signoff/{jira_id}
./scripts/capture.sh --test-only
```

**Expected output:**
```
🧪 Test Mode: Capturing first activity only...
Activities: 1
Variants: A, B
Platform: Desktop (1920×1080)

[1/1] Capturing Activity {id}...
  ✅ Variant A captured
  ✅ Variant B captured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Capture complete!
Success: 2
Failed: 0
Screenshots: media/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**On failure:**
- Show error output
- Offer: [Retry] / [Adjust URLs] / [Cancel]

### Step 3.2: Request Approval

Check captured files:
```bash
ls -lh media/{first_activity_id}_*_desktop.png
```

Show preview: 
```
✅ Test capture successful!
Files:
  - {id}_A_desktop.png ({size} KB)
  - {id}_B_desktop.png ({size} KB)
```

Ask via AskUserQuestion:
- **Approve batch** - Run full capture for all activities
- **Retry test** - Re-run test capture (adjust if needed)
- **Adjust settings** - Modify script before batch
- **Cancel** - Stop and review

If **Approve** → Continue to Step 4

---

## Step 4: Batch Capture

### Step 4.1: Execute Full Batch

Show confirmation:
```
🚀 Starting batch capture
Activities: {count}
Variants per activity: 2 (A, B)
Total screenshots: {count × 2}
Estimated time: ~{count × 10} seconds

This will run in the foreground with real-time progress.
```

Run the script in **batch mode** (all activities):

```bash
cd .sdd/output/signoff/{jira_id}
./scripts/capture.sh
```

The script will:
1. Open browser once (reuse for all captures)
2. Loop through all activities from the sanity table
3. For each activity:
   - Navigate to Variant A URL
   - Resize to 1920×1080
   - Wait 5 seconds for page load
   - Capture screenshot: `media/{id}_A_desktop.png`
   - Navigate to Variant B URL
   - Resize to 1920×1080
   - Wait 5 seconds
   - Capture screenshot: `media/{id}_B_desktop.png`
4. Close browser
5. Report summary

### Step 4.2: Monitor Progress

The script outputs progress in real-time:
```
🚀 Batch Mode: Capturing all activities...
Activities: 10
Variants: A, B
Platform: Desktop (1920×1080)

[1/10] Capturing Activity 1252815...
  ✅ Variant A captured
  ✅ Variant B captured

[2/10] Capturing Activity 9876543...
  ✅ Variant A captured
  ✅ Variant B captured

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Capture complete!
Success: 20
Failed: 0
Screenshots: media/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4.3: Report Results

Parse script output and show summary:
```
✅ Batch capture complete!
✅ Success: {success_count}
❌ Failed: {failure_count}
Time: {elapsed}s
Screenshots: .sdd/output/signoff/{jira_id}/media/

{if failures}
⚠️ Failed captures:
  - Activity {id} (Variant A): {error}
  - Activity {id} (Variant B): {error}
{endif}

Next: Update document? [Yes] [No]
```

---

## Step 5: Update Document

### Step 5.1: Count Captures

List files: `ls -1 media/*.png`
Parse filenames: `{activityId}_{variant}_{platform}.png` → Build success map

### Step 5.2: Update Table

For each activity with screenshots:
- Mark `[x]` in "When ACTX=A" column if `{id}_A_desktop.png` exists
- Mark `[x]` in "When ACTX=B" column if `{id}_B_desktop.png` exists

Use Edit tool with `replace_all: false` per row.

Optional: Add screenshot links in Remarks column: `[A](media/{id}_A_desktop.png) [B](media/{id}_B_desktop.png)`

### Step 5.3: Show Summary and Route

**If `capture_type == "screenshots"` (screenshots only):**

```
✅ Screenshot capture complete!
Updated: {count} activities
Checkmarks: Variant A ({count_a}), Variant B ({count_b})

🎉 Workflow complete!
📄 Document: .sdd/output/signoff/{jira_id}/signoff.md
📸 Screenshots: media/ ({count} files)
📜 Script: scripts/capture.sh

You can:
1. Review: open media/
2. Edit: /dev-feature-signoff {jira_id} edit
3. Re-capture: /dev-feature-signoff {jira_id} capture
```

End workflow.

**If `capture_type == "both"` (screenshots and videos):**

```
✅ Screenshot capture complete!
Updated: {count} activities
Checkmarks: Variant A ({count_a}), Variant B ({count_b})

📸 Screenshots: media/ ({count} files)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now proceeding to video recording workflow...
```

Continue to [Step 6: Video Recording Workflow](#step-6-video-recording-workflow)

---

# Step 6: Video Recording Workflow

**Reference:** See `${SKILL_ROOT}/references/videoCapture.md` for complete video capture patterns, script structure, and playwright-cli video commands.

**Note:** This step runs when `capture_type == "videos"` or `"both"` (after screenshot workflow completes)

---

## Step 6.1: Check Prerequisites & Existing Script

Check document exists and playwright-cli is available. Then check for existing video script at `.sdd/output/signoff/{jira_id}/scripts/capture-video.sh`.

**If script exists:**
- Show summary (creation date, scenario count)
- Ask via AskUserQuestion: [Reuse (Recommended)] / [Edit manually] / [Regenerate from document]
- **Reuse** → Skip to Step 6.3 | **Edit** → Show path, wait for confirmation, then Step 6.3 | **Regenerate** → Delete script, continue to Step 6.2

**If script doesn't exist:** Continue to Step 6.2

---

## Step 6.2: Generate Video Script

### Parse Test Scenarios from Document

Extract from `## 📋 Detailed Test Scenarios` section:
- Scenario ID, Name, Start URL, Test Steps (numbered list)
- Convert to: `scenarios = [{id, name, url, steps[]}, ...]`

**Reference:** See `${SKILL_ROOT}/references/videoCapture.md` → "Step Mapping Guide" for mapping narrative steps to executable commands (Navigate, Click, Fill, Select, Scroll, Wait, etc.)

### Show Preview & Confirm

```
📊 Video Capture Plan
Scenarios: {count}
Platform: Desktop (1920×1080)
Total videos: {count}
Estimated time: ~{count × 20} seconds
Element mapping: Automated (fuzzy matching per scenario)

Scenarios to record:
1. {scenario_name_1} ({step_count_1} steps)
2. {scenario_name_2} ({step_count_2} steps)
...

Proceed with script generation?
```

User confirms → Continue | User cancels → Exit

### Generate Script with Automated Element Discovery

**CRITICAL CONCEPT:** Element references (e5, e12, etc.) change between pages. Element mapping must happen **at runtime for each scenario**.

**Generate script using template from `videoCapture.md`:**
1. Fill `SCENARIOS` array: `"{id}|{name}|{url}|{step1}|{step2}|..."`
2. Include Bash 3.2 compatible helper functions (fuzzy matching, confidence scoring)
3. Implement per-scenario workflow: Navigate → Snapshot → Map → Record → Clear map
4. Write to `.sdd/output/signoff/{jira_id}/scripts/capture-video.sh`
5. Make executable: `chmod +x scripts/capture-video.sh`

**Show summary:**
```
✅ Video script generated: scripts/capture-video.sh

📊 Configuration:
Scenarios: {count}
Element mapping: Automated (fuzzy matching per scenario)
Output format: .webm

⚠️  Test-first workflow is MANDATORY
Run: ./scripts/capture-video.sh --test-only

Script features:
• --test-only: Record first scenario (validate mappings)
• --scenario N: Record specific scenario
• Batch mode: Record all scenarios
• Runtime element discovery with confidence scores
• Bash 3.2 compatible (macOS default)

📖 Full details: ${SKILL_ROOT}/references/videoCapture.md
```

---

## Step 6.3: Test-First Workflow

### Run Test Recording

Execute: `cd .sdd/output/signoff/{jira_id} && ./scripts/capture-video.sh --test-only`

Script will: Open browser → Navigate → Snapshot & map elements → Execute steps → Record → Report

**On failure:** Show error, offer [Retry] / [Edit Script] / [Cancel]

### Validate Auto-Mapped Elements

**CRITICAL:** User must verify correct elements were clicked.

Show validation prompt:
```
✅ Test recording complete!
File: scenario_1_{name}.webm ({size} MB)

🎯 VALIDATION REQUIRED:
Please watch the video and verify:
1. Correct buttons/elements were clicked
2. Flow proceeded as expected
3. No errors or wrong interactions

📊 Element Mappings Used:
- "Click book button" → e5 (Book Now) - confidence: 90%
- "Select date" → e12 (Select Date) - confidence: 100%
- "Add to cart" → e20 (Add to Cart) - confidence: 100%

⚠️  Low confidence mappings (< 80%):
- "Enter email" → e25 (Email) - confidence: 65% - VERIFY THIS

Watch video: open media/videos/scenario_1_{name}.webm
```

Ask via AskUserQuestion: [Yes, approve batch] / [No, wrong elements] / [Adjust low-confidence mappings] / [Cancel]

**Routing:**
- **Approve** → Continue to Step 6.4
- **Wrong elements** → Guide user to fix mappings, return to test
- **Adjust** → Help fix low-confidence mappings, return to test
- **Cancel** → Exit with manual editing instructions

---

## Step 6.4: Batch Recording

### Execute Full Batch

Show confirmation, then run: `cd .sdd/output/signoff/{jira_id} && ./scripts/capture-video.sh`

Script handles browser lifecycle, per-scenario mapping, recording, and cleanup with real-time progress.

### Report Results

```
✅ Batch recording complete!
✅ Success: {success_count}
❌ Failed: {failure_count}
Time: {elapsed}s
Videos: .sdd/output/signoff/{jira_id}/media/videos/

{if failures}
⚠️ Failed recordings:
  - Scenario {id} ({name}): {error}
{endif}

Next: Update document? [Yes] [No]
```

---

## Step 6.5: Update Document

### Add Video Evidence Section

Count videos: `ls -1 media/videos/*.webm`

If "Video Evidence" section doesn't exist, add after "Detailed Test Scenarios":

```markdown
## 🎬 Video Evidence

| Scenario | Video | Duration | Status | Notes |
|----------|-------|----------|--------|-------|
```

### Populate Video Table

For each successfully recorded scenario:
1. Get duration: `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 media/videos/{filename}.webm 2>/dev/null || echo "N/A"`
2. Add row: `| {scenario_name} | [📹 Watch](media/videos/{filename}.webm) | {duration}s | ✅ Pass | Recorded successfully |`

### Show Final Summary

```
✅ Document updated with video evidence!
Updated: Video Evidence section
Videos: {count} recordings

🎉 Video workflow complete!
📄 Document: .sdd/output/signoff/{jira_id}/signoff.md
📹 Videos: media/videos/ ({count} files, {total_size} MB)
📜 Script: scripts/capture-video.sh

You can:
1. Review videos: open media/videos/
2. Re-record specific scenario: ./scripts/capture-video.sh --scenario {N}
3. Edit document: /dev-feature-signoff {jira_id} edit
4. Re-capture: /dev-feature-signoff {jira_id} capture
```

**If `capture_type == "both"`:**

Show combined summary:
```
🎉 Complete media capture workflow finished!

📸 Screenshots: {screenshot_count} files
📹 Videos: {video_count} files
📄 Document: .sdd/output/signoff/{jira_id}/signoff.md

Evidence collected:
✅ Sanity testing screenshots (Variant A/B comparison)
✅ Test scenario videos (User flow demonstrations)

All evidence has been linked in the sign-off document.
```

---

# Workflow 4: Confluence Publishing

**CRITICAL - Technology Choice:**

> **This workflow uses Confluence REST API ONLY (not Atlassian MCP)** because:
> - Atlassian MCP **CANNOT** upload binary attachments (media files limitation)
> - Atlassian MCP **CANNOT** get `fileId` needed for embedded images
> - REST API is the **ONLY** way to properly upload and embed images
> 
> **Authentication**: Credentials are stored and read from `~/.confluence/feature-sign-off-publish-config.yml` ONLY.
> - This workflow **NEVER** uses MCP for authentication
> - All REST API calls use email + PAT from the yml file
> - MCP is only used later for page metadata fetching (Step 2.2)

**CRITICAL - Always Use ADF Format:**

> **This workflow ONLY uses ADF (Atlassian Document Format)** for Confluence publishing.
> Never use HTML or Markdown formats as they do not support embedded images properly.

**How Images Work in Confluence ADF:**
- All images are stored as Confluence page attachments (separate files)
- Images are uploaded via REST API (not MCP) to get proper `fileId`
- ADF uses media nodes with `fileId` references: `{"type": "media", "attrs": {"id": "uuid-of-attachment"}}`
- The `fileId` (UUID) tells Confluence which attachment to render inline
- Images are NEVER embedded in the document (no base64, no binary data)
- ADF media nodes specify WHERE to display (which table cell) and SIZE (width in pixels)

**Key Point:** Images are references, not embedded data. This workflow:
1. Uploads screenshots as attachments → gets `fileId` for each
2. Builds ADF document with media nodes referencing the `fileId`
3. Confluence renders the attachments inline where media nodes appear

**What this workflow does:**
1. **Upload screenshots as Confluence attachments** (or reuse existing ones)
   - Each upload returns: `attachmentId`, `fileId` (UUID), `collection`
   - The `fileId` is what we need for ADF media nodes
2. **Parse markdown** sanity testing table for activity data
3. **Build ADF document** with media nodes that reference the attachments:
   - Media nodes use `fileId` to reference which attachment to display
   - Media nodes specify WHERE to display (which table cell)
   - Media nodes specify SIZE (width in pixels)
4. **Update Confluence page** - Confluence reads ADF, finds media nodes, renders the referenced attachments inline

**Result:** Same attachments as markdown, but displayed inline in table cells instead of only at page bottom.

**Visual Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Upload Image Files                                  │
│ POST /rest/api/content/{pageId}/child/attachment            │
│                                                             │
│ image.png (binary) ──→ Confluence Attachment Storage        │
│                        └─ Returns: fileId (UUID)            │
│                                   attachmentId              │
│                                   collection                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create ADF with Media References (not image data)   │
│ PUT /wiki/api/v2/pages/{pageId}                             │
│                                                             │
│ ADF JSON:                                                   │
│ {                                                           │
│   "type": "media",                                          │
│   "attrs": {                                                │
│     "id": "36b93822...",  ← References the attachment       │
│     "collection": "contentId-2462155480",                   │
│     "width": 300                                            │
│   }                                                         │
│ }                                                           │
│                                                             │
│ (Note: No image bytes in ADF, only the UUID reference)      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Confluence Renders Page                             │
│                                                             │
│ 1. Reads ADF from page storage                              │
│ 2. Finds media node with fileId                             │
│ 3. Fetches attachment from storage using fileId             │
│ 4. Displays image inline at the media node location         │
│                                                             │
│ User sees: Image rendered inside table cell                 │
└─────────────────────────────────────────────────────────────┘
```

**Why This Matters for the Agent:**
- Don't try to "embed" images in ADF JSON directly (will fail)
- ALWAYS upload as attachment first, get fileId second, reference in ADF third
- Re-running publish is safe: script checks for existing attachments by filename, reuses fileId
- If you see "UNKNOWN_MEDIA_ID" on page: the fileId is wrong or attachment was deleted

## Step 1: Prerequisites Check & Auto-Generate

**IMPORTANT**: Before running checks, show this message to user:

```
🔐 Confluence Publishing - Authentication Info

This workflow uses ~/.confluence/feature-sign-off-publish-config.yml for credentials.
MCP authentication is NOT required for publishing.

If you see MCP connection prompts, you can ignore them - 
they're not used for uploading images or updating pages.

Checking prerequisites...
```

**Run single combined prerequisite check** (1 tool call instead of 5):

```bash
cd .sdd/output/signoff/{jira_id} && \
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" && \
echo "📋 Confluence Publishing Prerequisites Check" && \
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" && \
echo "" && \
echo "ℹ️  This workflow uses ~/.confluence/feature-sign-off-publish-config.yml" && \
echo "ℹ️  MCP authentication is NOT required" && \
echo "" && \
# Check document
if [ ! -f "signoff.md" ]; then
  echo "ERROR: signoff.md not found. Run /dev-feature-signoff {jira_id} first"
  exit 1
fi && \
# Check screenshots (exclude test_*) - supports png, jpg, jpeg, gif
SCREENSHOT_COUNT=$(find media -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" \) ! -iname "test_*" 2>/dev/null | wc -l | tr -d ' ') && \
if [ "$SCREENSHOT_COUNT" -lt 1 ]; then
  echo "ERROR: No screenshots found. Run /dev-feature-signoff {jira_id} capture first"
  exit 1
fi && \
# Check Python & dependencies
python3 --version > /dev/null 2>&1 || { echo "ERROR: Python 3.8+ required"; exit 1; } && \
python3 -c "import requests, yaml" 2>/dev/null || pip install -q -r ${SKILL_ROOT}/scripts/requirements.txt && \
# Show summary
echo "✓ Prerequisites complete" && \
echo "  Document: signoff.md" && \
echo "  Screenshots: $SCREENSHOT_COUNT files" && \
echo "  Python: $(python3 --version 2>&1)" && \
echo "  Dependencies: installed"
```

**Benefits:**
- **1 tool call** instead of 5 separate checks
- Fails fast with clear error messages
- Auto-installs dependencies if needed
- Shows summary at the end

**If prerequisites fail:**
- Missing document → User must run `/dev-feature-signoff {jira_id}` first
- No screenshots → User must run `/dev-feature-signoff {jira_id} capture` first
- Missing Python → Error with install instructions

---

## Step 2: Verify Confluence Authentication & Check for Existing Page

**IMPORTANT**: This step uses **ONLY** the yml file for credentials. No MCP authentication is needed for publishing.

### Step 2.1: Verify Confluence Authentication

**IMPORTANT**: Show this message to user FIRST (before any bash commands):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 Checking Confluence Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: ~/.confluence/feature-sign-off-publish-config.yml
Method: Email + PAT (Personal Access Token)

Note: If you see MCP connection prompts, ignore them.
      This workflow only uses yml file credentials.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Check for existing credentials in `~/.confluence/feature-sign-off-publish-config.yml`:**

```bash
CONFIG_FILE="$HOME/.confluence/feature-sign-off-publish-config.yml"
CONFLUENCE_HOST="${CONFLUENCE_HOST:-agoda.atlassian.net}"  # Default to agoda.atlassian.net

echo "" && \
echo "📁 Config file: $CONFIG_FILE" && \
echo "🌐 Confluence host: $CONFLUENCE_HOST" && \
echo ""

if [ ! -f "$CONFIG_FILE" ]; then
  echo "⚠️  No credentials found"
  echo "  Config file: $CONFIG_FILE"
  exit 2
fi

# Test credentials by attempting to read current user
# Python script will load credentials from config file
python3 -c "
import yaml
import sys
import requests
from requests.auth import HTTPBasicAuth

host = '$CONFLUENCE_HOST'

try:
    with open('$CONFIG_FILE') as f:
        config = yaml.safe_load(f)
    
    email = config['hosts'][host]['email']
    token = config['hosts'][host]['token']
    
    if not email or not token:
        print(f'⚠️  Incomplete credentials for {host} in config file', file=sys.stderr)
        sys.exit(2)
    
    # Test credentials
    auth = HTTPBasicAuth(email, token)
    resp = requests.get(f'https://{host}/wiki/rest/api/user/current', auth=auth, timeout=10)
    
    if resp.status_code == 200:
        print(f'✓ Authentication successful for {host}')
        print(f'  Email: {email[:3]}...@{email.split(\"@\")[1]}')
        print(f'  Config: $CONFIG_FILE')
        sys.exit(0)
    else:
        print(f'❌ Saved credentials are invalid or expired for {host}', file=sys.stderr)
        print('', file=sys.stderr)
        print('Possible causes:', file=sys.stderr)
        print('  - PAT token expired (tokens expire after 90 days)', file=sys.stderr)
        print('  - Email changed or account disabled', file=sys.stderr)
        print('  - Network issue connecting to Atlassian', file=sys.stderr)
        print('', file=sys.stderr)
        print('To fix: Re-run this command to enter new credentials', file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f'❌ Error checking credentials for {host}: {e}', file=sys.stderr)
    sys.exit(2)
" 2>&1

EXIT_CODE=$?
exit $EXIT_CODE
```

**Exit codes:**
- `0` = Credentials valid → Continue to Step 2.2
- `1` = Credentials invalid → Re-prompt user
- `2` = Config file missing or incomplete → First-time setup

**If credentials not found or invalid, prompt user:**
   
Show clear instructions:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 Confluence Authentication Required
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You need a Personal Access Token (PAT) to publish to Confluence.

⚠️  IMPORTANT: This is NOT your MCP/OAuth token!
    We need email + PAT for uploading images via REST API.

Create PAT at:
👉 https://id.atlassian.com/manage-profile/security/api-tokens

Steps:
1. Click "Create API token"
2. Name it: "Feature-sign-off Confluence Upload"
3. Copy the token

Your credentials will be saved to:
📁 ~/.confluence/feature-sign-off-publish-config.yml

Why we need this:
• MCP cannot upload binary files (images)
• REST API needs email + PAT authentication
• Separate from MCP OAuth (used for other operations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
   
Ask for credentials via text input:
- **Email**: Store as `email_input`
- **PAT Token**: Store as `pat_input`

**Test and save credentials** (1 tool call):
   
```bash
# Replace {email_input} and {pat_input} with actual values from user
email_input="{email_input}"
pat_input="{pat_input}"
CONFLUENCE_HOST="${CONFLUENCE_HOST:-agoda.atlassian.net}"  # Default to agoda.atlassian.net

echo "Testing credentials for $CONFLUENCE_HOST..."

# Test authentication first
if ! curl -u "$email_input:$pat_input" \
  "https://$CONFLUENCE_HOST/wiki/rest/api/user/current" \
  --silent --fail > /dev/null 2>&1; then
  echo "❌ Invalid credentials for $CONFLUENCE_HOST"
  echo "Please check:"
  echo "  - Email is correct (must be your Atlassian account email)"
  echo "  - PAT token is valid (create new one if expired)"
  echo "  - Host is correct: $CONFLUENCE_HOST"
  exit 1
fi

# Create config directory and file
CONFIG_DIR="$HOME/.confluence"
CONFIG_FILE="$CONFIG_DIR/feature-sign-off-publish-config.yml"

mkdir -p "$CONFIG_DIR"

# Check if config file exists and merge with existing hosts
if [ -f "$CONFIG_FILE" ]; then
  # Backup existing config
  cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
  
  # Add or update host entry (using Python for YAML manipulation)
  python3 -c "
import yaml
import sys

try:
    with open('$CONFIG_FILE') as f:
        config = yaml.safe_load(f) or {}
except:
    config = {}

if 'hosts' not in config:
    config['hosts'] = {}

config['hosts']['$CONFLUENCE_HOST'] = {
    'email': '$email_input',
    'token': '$pat_input',
    'wiki_path': '/wiki'
}

with open('$CONFIG_FILE', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
" || {
    # Fallback: overwrite entire file if Python fails
    cat > "$CONFIG_FILE" << EOF
hosts:
  $CONFLUENCE_HOST:
    email: $email_input
    token: $pat_input
    wiki_path: /wiki
EOF
}
else
  # Create new config file
  cat > "$CONFIG_FILE" << EOF
hosts:
  $CONFLUENCE_HOST:
    email: $email_input
    token: $pat_input
    wiki_path: /wiki
EOF
fi

# Set secure permissions (read/write owner only)
chmod 600 "$CONFIG_FILE"

echo "✓ Authentication successful!"
echo "  Credentials saved to: $CONFIG_FILE"
echo "  Host: $CONFLUENCE_HOST"
echo "  Email: ${email_input:0:3}...@${email_input##*@}"
```

**If authentication fails (exit code 1):**
   - Ask user via AskUserQuestion: [Re-enter credentials] [Cancel]
   - If re-enter → Go back to credential prompt
   - If cancel → Exit with error

**Show success message:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Authentication Successful!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ✓ Credentials saved to: ~/.confluence/feature-sign-off-publish-config.yml
   ✓ File permissions: 600 (secure)
   ✓ Host: {CONFLUENCE_HOST}
   
   Your credentials are now ready for Confluence publishing.
   
   ℹ️  These credentials are:
       • Used ONLY for REST API (uploading images, updating pages)
       • Separate from MCP OAuth
       • Stored locally like glab/gh CLI tools
   
   ⚠️  Security Note:
       - Token stored in plaintext (standard for CLI tools)
       - Keep this file secure, never commit to git
       - Revoke anytime at:
         https://id.atlassian.com/manage-profile/security/api-tokens
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

**How it works**:
- Credentials stored in `~/.confluence/feature-sign-off-publish-config.yml` (same pattern as glab)
- File permissions set to 600 (owner read/write only)
- Python scripts read credentials directly from config file (no environment variables needed)
- No dependency on shell RC files or session environment

**Security Notes**:
- Credentials stored in config file with restricted permissions (600)
- PAT tokens can be revoked at any time from Atlassian account settings
- Credentials never exposed in command line arguments (safe from `ps aux`)
- Config file should never be committed to git (add to .gitignore)

**Error handling**:
- If config file cannot be written → Show error and exit
- If config file is corrupted → Python shows YAML parsing error
- If credentials are missing → Python shows detailed error with expected structure

---

### Step 2.2: Check for Existing Sign-off Page

**NOTE**: This step uses MCP for **metadata only** (fetching JIRA summary to build page title and searching for existing pages). The actual file uploads and page updates in Step 3 use REST API with yml credentials only.

1. **Fetch JIRA context** for page metadata:
   ```
   mcp__atlassian__getJiraIssue(
     cloudId: "agoda.atlassian.net",
     issueKey: {jira_id},
     fields: ["summary", "issuetype", "parent"]
   )
   ```

2. **Determine page title**:
   - Format: `[Sign-off] {JIRA Summary} - {JIRA ID}`
   - Example: `[Sign-off] Image Gallery Revamp - ACTD-370`
   - Store: `page_title = {formatted_title}`

3. **Search for existing page** under parent:
   ```
   mcp__atlassian__searchConfluenceUsingCql(
     cloudId: "agoda.atlassian.net",
     cql: "type=page AND space=ACV AND ancestor=760316915 AND title~\"{jira_id}\""
   )
   ```
   
   This searches for pages containing the JIRA ID in their title under the "Create Feature Sign-Off" parent.

4. **If existing page found**:
   - Extract: `existing_page_id`, `existing_page_url`, `existing_page_title`
   - Show to user:
     ```
     ⚠️  Existing Sign-off Page Found
     
     Title: {existing_page_title}
     URL: {existing_page_url}
     Last updated: {last_updated_date}
     
     What would you like to do?
     ```
   - Use AskUserQuestion with options:
     - **Reuse existing page** - Update this page with new content and screenshots
     - **Create new page** - Create a new sign-off page (old page will remain)
   
   - If "Reuse existing":
     - Store: `page_id = existing_page_id`, `page_url = existing_page_url`
     - Show: "✓ Reusing existing page: {existing_page_url}"
     - Skip to Step 3
   
   - If "Create new page":
     - Modify title to include timestamp: `[Sign-off] {JIRA Summary} - {JIRA ID} - {YYYY-MM-DD HH:MM}`
     - Continue to step 5

5. **Create new published page** via MCP with ADF format:
   ```
   mcp__atlassian__createConfluencePage(
     cloudId: "agoda.atlassian.net",
     spaceId: "165445635",  # ACV space
     parentId: "760316915",  # "Create Feature Sign-Off" page
     title: {page_title},
     body: '{"version":1,"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Feature Sign-Off Document"}]},{"type":"paragraph","content":[{"type":"text","text":"Uploading attachments and content..."}]}]}',
     contentFormat: "adf",  # CRITICAL: Always use ADF, never HTML or markdown
     status: "current"  # CRITICAL: Must be "current" not "draft" for immediate publishing
   )
   ```
   
   **CRITICAL SETTINGS**: 
   - **contentFormat: "adf"** - ALWAYS use ADF format. Never use "html" or "markdown"
   - **status: "current"** - Page is published immediately (not draft)
   - Published pages allow immediate attachment uploads and proper media node rendering
   - The page can still be edited multiple times after creation

6. **Extract page ID** from response:
   - Store: `page_id = response.id`
   - Store: `page_url = response.webUrl`
   - Show: "✓ Created new page: {page_url}"

**Error handling**:
- JIRA fetch fails → Use JIRA ID in title: `[Sign-off] {JIRA ID}`
- Space/parent not found → Error: "Cannot access ACV space. Check permissions."
- Page creation fails → Error: "Failed to create Confluence page: {error}"
- Authentication fails → Prompt for credentials (covered in Step 2.1)

---

## Step 3: Publish with Complete Script

**DETERMINISTIC FLOW** - Only one method is supported:

**Script**: `${SKILL_ROOT}/scripts/confluence_publish_complete.py`

**AUTHENTICATION**: 
- Script reads credentials from `~/.confluence/feature-sign-off-publish-config.yml` ONLY
- Uses HTTP Basic Auth (email + PAT) for all REST API calls
- **NO MCP authentication** - all uploads/updates use yml credentials
- Credentials were validated in Step 2.1 above

**What this script does**:
1. **Loads credentials** from `~/.confluence/feature-sign-off-publish-config.yml` (not MCP)
2. Checks for existing attachments and reuses them (no duplicate uploads)
3. Uploads new screenshots via REST API using yml credentials
4. Gets `fileId` (UUID) for each attachment
5. If `media/videos/` exists, uploads any `.webm` files as attachments the same way (no transcoding)
6. Converts markdown to ADF format
7. Injects media nodes into sanity table using `fileId` references
8. Links uploaded videos into the "🎬 Video Evidence" table's Video column (matched by filename; videos with no matching row are uploaded but left unlinked, with a warning)
9. Updates Confluence page with complete ADF content using yml credentials

**CRITICAL**: 
- Images MUST be uploaded via REST API (not MCP) to get proper `fileId`
- ALL REST API calls authenticate with yml credentials (email + PAT)
- Final page update MUST use ADF format (not HTML or markdown)
- The script handles ALL steps - don't try alternative approaches
- Videos are uploaded and **linked** (not inline-embedded) in the Video Evidence table — same as the plain-text filenames the table already had, but now clickable and pointing at the real Confluence attachment

---

### Step 3.1: Validate Screenshots Exist

1. **List all image files** in media directory:
   ```bash
   ls .sdd/output/signoff/{jira_id}/media/*.{png,jpg,jpeg,gif} 2>/dev/null
   ```

2. **Filter out test screenshots**:
   - Exclude files matching pattern: `test_screenshot*` or `test_*`
   - Show which files are excluded:
     ```
     ⚠️  Excluding test files:
     - test_screenshot.png
     - test_activity.jpg
     ```

3. **Count valid screenshots**:
   - If count < 1:
     - Show error: "No valid screenshots found in media directory."
     - Ask user via AskUserQuestion: [Capture screenshots now] [Cancel]
     - If "Capture screenshots now" → Invoke [Workflow 3: Screenshot Capture](#workflow-3-screenshot-capture)
     - If "Cancel" → Exit with error
   
   - If count >= 1:
     - Show summary:
       ```
       📸 Found {count} screenshot(s) ready for upload
       Media directory: .sdd/output/signoff/{jira_id}/media/
       ```

---

### Step 3.2: Run Complete Publishing Script

**This one script does everything: uploads screenshots, converts to ADF, embeds images, updates page.**

**Run the complete publishing script** (1 command):

```bash
# Use CONFLUENCE_HOST environment variable or default to agoda.atlassian.net
CONFLUENCE_HOST="${CONFLUENCE_HOST:-agoda.atlassian.net}"

cd .sdd/output/signoff/{jira_id} && \
python3 ${SKILL_ROOT}/scripts/confluence_publish_complete.py \
  --config ~/.confluence/feature-sign-off-publish-config.yml \
  --host "$CONFLUENCE_HOST" \
  --page-id {page_id} \
  --media-dir ./media \
  --video-dir ./media/videos \
  --markdown-file ./signoff.md
```

   `--video-dir` defaults to `{media-dir}/videos` if omitted, and is skipped entirely if that directory doesn't exist — safe to leave off when there's no video evidence.

   **What this script does** (all in one command):
   - Loads credentials from config file (`~/.confluence/feature-sign-off-publish-config.yml`)
   - Checks for existing attachments, reuses if found
   - Uploads new screenshots (excluding `test_*` files automatically)
   - Uploads new videos from `media/videos/` (if present)
   - Gets `fileId` (UUID) for each attachment
   - Converts full markdown document to ADF format
   - Injects media nodes into sanity testing table cells using `fileId` references
   - Links uploaded videos into the Video Evidence table by matching filenames
   - Gets current page version from Confluence
   - Updates page with complete ADF content + embedded images + linked videos
   
   **Script uses**:
   - Credentials from config file (loaded via `--config` parameter)
   - Confluence URL: `https://agoda.atlassian.net` (hardcoded in script)
   - ADF format exclusively (never HTML or markdown)

2. **Monitor script output** (stderr):
   ```
   === Step 1: Upload Screenshots ===
   Processing 20 files...
     ✓ 1252815_A_desktop.png (existing, reusing)
     ✓ 1252815_B_desktop.png (uploaded new)
     ✓ 1041196_A_desktop.png (uploaded new)
     ...
   
   Successfully mapped 20/20 files
   
   === Step 2: Build ADF Document ===
     Converting full markdown document to ADF...
     Injecting 20 images into sanity table...
   
   Built ADF with 20 embedded images
   
   === Step 3: Get Current Page Version ===
   Current version: 1, will update to: 2
   
   === Step 4: Update Confluence Page ===
   ✅ Page updated successfully!
   🔗 https://agoda.atlassian.net/wiki/spaces/ACV/pages/{page_id}
   ```

3. **Verify success**:
   - Script exit code 0 → Success
   - Script exit code 1 → Failure (check stderr for error details)

**Error handling**:
- Script execution fails → Show stderr, ask user to retry or check credentials
- File upload errors → Script retries 3 times with exponential backoff
- Page update fails → Check page ID is valid and page status is "current"
- ADF conversion errors → Check markdown formatting in signoff.md

**IMPORTANT**: After this step completes successfully, **proceed to Step 4** (Success Summary). 
The complete script already handled everything - Steps 4-5 marked as obsolete are not needed.

---

## Step 4: [OBSOLETE - Skip this step]

**This step is no longer used.** The `confluence_publish_complete.py` script in Step 3A.2 handles everything.

If you see this step, you're following an outdated workflow. Go directly to Step 6.

---

## Step 5: [OBSOLETE - Skip this step]

**This step is no longer used.** The `confluence_publish_complete.py` script in Step 3A.2 handles everything.

If you see this step, you're following an outdated workflow. Go directly to Step 6.

---

## Step 4: Success Summary
**[Current workflow - use this step]**

Show final summary to user:

```
✅ Published to Confluence!

📄 Page: {page_url}
📸 Images: {success_count}/{total_count} uploaded and embedded

Next steps:
1. Visit page: {page_url}
2. Review images display correctly
3. Update JIRA ticket with Confluence link
```

---

## [DEPRECATED - Old Workflow Below - Do Not Use]

**The following sections describe the old multi-step approach.**  
**They are preserved for reference only until the new flow is fully tested.**  
**Current workflow jumps directly to Step 4 (Success Summary) above.**

---

## Step 6: Success Summary [OLD WORKFLOW - DEPRECATED]

2. **Replace image paths** with Confluence URLs:
   - Find pattern: `![alt-text](media/{filename})`
   - Replace with: `![alt-text]({confluence_url})`
   - Apply all mappings from Step 3

   Example:
   ```markdown
   # Before
   ![Activity 123 Variant A](media/activity_123_A.png)

   # After
   ![Activity 123 Variant A](https://agoda.atlassian.net/download/attachments/.../activity_123_A.png)
   ```

3. **Validate replacements**:
   - Count replaced: Must match successful uploads count
   - Unreplaced images → Warning: "Some images not found in document: {list}"

**Error handling**:
- Document read fails → Error: "Cannot read sign-off document"
- No images found in markdown → Warning: "No image references found in document. Expected {count} based on media directory."

---

## Step 5: Update Confluence Page with Final Content [OLD WORKFLOW - DEPRECATED]

### Option A: Simple Markdown Update (Recommended for Quick Publishing)

Use this when images are uploaded but don't need to be embedded inline (they'll appear as attachments).

1. **Update page** via MCP:
   ```
   mcp__atlassian__updateConfluencePage(
     cloudId: "agoda.atlassian.net",
     pageId: {page_id},
     title: {page_title},  # Keep same title
     body: {signoff_markdown},
     contentFormat: "markdown",
     versionComment: "Published from /dev-feature-signoff - {jira_id}"
   )
   ```

2. **Verify update**:
   - MCP returns updated page version
   - Page shows content + attachments section at bottom

**Error handling**:
- Update fails → Error: "Failed to update page content: {error}. Page created at {page_url} but content not updated."
- Markdown conversion error → Error: "MCP failed to convert markdown to ADF: {error}. Check markdown syntax. Common issues: unclosed tables, invalid links."

---

### Option B: ADF with Embedded Images (Recommended - Shows Images Inline)

**This is the default and recommended approach** - creates full document with images embedded in table cells.

1. **Run the complete publishing script**:
   ```bash
   cd .sdd/output/signoff/{jira_id}
   python3 ${SKILL_ROOT}/scripts/confluence_publish_complete.py \
     --page-id {page_id} \
     --media-dir ./media \
     --markdown-file ./signoff.md
   ```

   **What this script does**:
   - Checks for existing attachments (reuses if already uploaded, skips 400 errors)
   - Uploads new screenshots if needed
   - Extracts activity data from markdown sanity testing table
   - Builds complete ADF document with proper 7-column table structure:
     - Column 1: Activity ID
     - Column 2: Category
     - Column 3: A side URL (clickable link)
     - Column 4: When {EXPERIMENT}=A (✅ checkmark + full size image)
     - Column 5: B side URL (clickable link)
     - Column 6: When {EXPERIMENT}=B (✅ checkmark + full size image)
     - Column 7: Remarks (note text + small thumbnails)
   - Updates Confluence page via API v2

2. **Script output**:
   ```
   === Step 1: Upload Screenshots ===
   Processing 20 files...
     ✓ 1252815_A_desktop.png (existing, reusing)
     ✓ 1252815_B_desktop.png (existing, reusing)
     ✓ 1041196_A_desktop.png uploaded (new)
     ...
   Successfully mapped 20/20 files
   
   === Step 2: Build ADF Document ===
   Built ADF with 20 embedded images
   
   === Step 3: Update Confluence Page ===
   ✅ Page updated successfully!
   🔗 https://agoda.atlassian.net/wiki/spaces/ACV/pages/{page_id}
   ```

3. **Verify on Confluence**:
   - Open the page URL shown in output
   - Confirm all images are visible inline in the table
   - Check that images appear in both "When A" and "When B" columns
   - Verify small thumbnails also appear in Remarks column

**Error handling**:
- Existing attachment found → Reuses fileId (no re-upload)
- Upload fails → Shows error for that file, continues with others
- Invalid fileId → Shows "UNKNOWN_MEDIA_ID" on page (fix: re-run upload)
- Missing collection → Image not displayed (fix: check attachment metadata)
- Script fails → Fall back to Option A (markdown format, images in attachments)

**Key improvements** (fixed from previous version):
- ✅ Checks existing attachments before upload (no more 400 errors)
- ✅ Creates full document (not just screenshots section)
- ✅ Proper 7-column table matching markdown structure
- ✅ Images in correct cells (When A/B columns)

---

## Step 6: Prompt User for Local File Cleanup [OLD WORKFLOW - DEPRECATED]

Use AskUserQuestion:

**Question**: "Confluence publish successful! Keep or delete local media files?"

**Options**:
- **Keep local files (Recommended)** - Preserve `.sdd/output/signoff/{jira_id}/media/` as backup
- **Delete local files** - Free up disk space (warning: cannot undo)

**If Delete**:
```bash
rm -rf .sdd/output/signoff/{jira_id}/media/*
```

Show confirmation:
```
🗑️  Deleted {count} local media files
```

---

## Step 7: Show Success Summary [OLD WORKFLOW - DEPRECATED]

```
✅ Published to Confluence!

📄 Page: {page_url}
📸 Images: {success_count}/{total_count} uploaded and embedded
⚠️  Failed: {failed_count} files (see details above)
📝 Status: Draft (review before publishing)

Next steps:
1. Visit page: {page_url}
2. Review images display correctly
3. Publish page when ready (in Confluence UI)

{if failed_count > 0}
⚠️  Some uploads failed. Re-run to retry:
   /dev-feature-signoff {jira_id} publish
{endif}
```

---

## Error Recovery

**Scenario: Upload fails mid-batch**

1. Script reports partial success (e.g., 15/20 uploaded)
2. User re-runs `/dev-feature-signoff {jira_id} publish`
3. Script detects existing draft page (search by title)
4. Skip duplicate uploads (check existing attachments by filename)
5. Upload only missing files
6. Update page content

**Scenario: Page creation succeeds but update fails**

1. Draft page exists at {page_url} with placeholder content
2. Error message shows page URL
3. User can manually edit page or re-run command
4. Re-run detects existing page, skips creation, proceeds to upload + update

---

# Workflow 5: Full Automation

**Purpose**: One-command end-to-end automation — generates document, captures screenshots, publishes to Confluence.

**Usage**: `/dev-feature-signoff ACTD-489 full-auto`

---

## Execution Flow

This workflow chains Workflows 1, 3, and 4 automatically with minimal user intervention.

### Phase 1: Document Generation (if needed)

1. **Check if document exists**:
   ```bash
   test -f .sdd/output/signoff/{jira_id}/signoff.md
   ```

2. **If not found**:
   - Show: "📝 Step 1/3: Generating sign-off document..."
   - Execute [Workflow 1](#workflow-1-document-generation) with `include_mr_analysis = false`
   - Wait for completion
   - Verify document created

3. **If exists**:
   - Show: "✓ Document already exists, skipping generation"

---

### Phase 2: Screenshot Capture (if needed)

1. **Check if screenshots exist**:
   ```bash
   ls .sdd/output/signoff/{jira_id}/media/*.png 2>/dev/null | wc -l
   ```

2. **If count < 1**:
   - Show: "📸 Step 2/3: Capturing screenshots..."
   - Execute [Workflow 3](#workflow-3-screenshot-capture)
   - Wait for completion
   - Verify screenshots created

3. **If exists**:
   - Show: "✓ Found {count} screenshots, skipping capture"

---

### Phase 3: Confluence Publishing

1. Show: "☁️  Step 3/3: Publishing to Confluence..."

2. Execute [Workflow 4](#workflow-4-publishing):
   - Auto-install dependencies if needed
   - Skip user confirmation (proceed automatically)
   - Create page
   - Upload attachments
   - Update page content

3. **Final Summary**:
   ```
   🎉 Full automation complete!

   ✅ Document: .sdd/output/signoff/{jira_id}/signoff.md
   ✅ Screenshots: {count} files in media/
   ✅ Confluence: {page_url}

   What was automated:
   - Document generation ({generated_new ? "created" : "reused existing"})
   - Screenshot capture ({captured_new ? "captured {count} images" : "reused {count} existing"})
   - Confluence publishing ({success_count}/{total_count} uploads successful)

   Next steps:
   1. Review page: {page_url}
   2. Verify images display correctly
   3. Add any manual test evidence
   4. Update JIRA ticket with link
   ```

---

## Error Recovery

**At any phase**:
- If error occurs → Show which phase failed
- Display error details
- Suggest manual command to resume:
  - Phase 1 fails → `/dev-feature-signoff {jira_id} generate`
  - Phase 2 fails → `/dev-feature-signoff {jira_id} capture`
  - Phase 3 fails → `/dev-feature-signoff {jira_id} publish`

**Partial completion**:
- Completed phases are not re-run
- User can resume from failed phase
- Example: If capture fails, document is already generated and reusable

---

## Configuration Options

User can set environment variables to customize automation:

```bash
export FEATURE_SIGNOFF_SKIP_CONFIRMATION=true  # Skip all user prompts
export FEATURE_SIGNOFF_MR_ANALYSIS=true       # Include MR analysis in generation
export CONFLUENCE_BATCH_SIZE=10               # Upload 10 files in parallel
```

---

# Error Handling

## Common Errors

**JIRA not found**: "Failed to fetch {jira_id}. Check: ID format, permissions, credentials."

**Invalid Chrome JSON**: "JSON doesn't match format. Export from DevTools Recorder. See `references/chrome-recorder-spec.md`"

**No MRs found**: "No MRs for {jira_id}. Add MR links to JIRA or provide manually."

**Confluence authentication fails**: "MCP Atlassian OAuth not configured. Run `/mcp-config atlassian` to authenticate."

**Upload script not found**: "Missing upload script. Reinstall skill: `npx --yes skills add <repo> --skill dev-feature-signoff`"

**Python dependencies missing**: "Missing Python packages. Install: `pip install -r ${SKILL_ROOT}/scripts/requirements.txt`"

**Page creation fails - space not found**: "Cannot access ACV space (ID: 165445635). Check Confluence permissions."

**Page creation fails - parent not found**: "Parent page not found (ID: 760316915). Verify 'Create Feature Sign-Off' page exists in ACV space."

**All uploads fail**: "No files uploaded. Possible causes: (1) Confluence API rate limit, (2) Invalid page ID, (3) Network issue. Wait 1 minute and retry."

**Markdown conversion fails**: "MCP failed to convert markdown to ADF. Common issues: (1) Unclosed table, (2) Invalid link syntax, (3) Unsupported markdown element. Check document at `.sdd/output/signoff/{jira_id}/signoff.md`"

**Graceful degradation**:
- Confluence fetch fails → Use embedded template
- GitLab API fails → Continue with JIRA data only
- Query malformed → Ask manual input
- Chrome Recorder JSON invalid → Fall back to AI auto-generate
- Any MCP tool fails → Show error, offer alternatives

---

# References & Tools

## References (via `${SKILL_ROOT}/references/`)
- `signoff-template.md` - Document template
- `activities-web.md` - Activities Web URL pattern configuration
- `query-examples.md` - SQL templates
- `chrome-recorder-spec.md` - JSON spec
- `captureScreenshot.md` - playwright-cli screenshot script structure and command reference
- `videoCapture.md` - playwright-cli video recording script structure and command reference

**Repository-specific files:**
Additional repositories can be added by creating `{repo-name}.md` files containing URL patterns and domain-specific instructions.

## Output Structure
```
.sdd/output/signoff/{jira_id}/
├── signoff.md              # Main document
├── scripts/
│   ├── capture.sh          # Screenshot script (executable)
│   └── capture-video.sh    # Video recording script (executable)
└── media/
    ├── {id}_A_desktop.png  # Screenshots
    ├── {id}_B_desktop.png
    └── videos/             # Video recordings
        ├── scenario_1_{name}.webm
        └── scenario_2_{name}.webm
```

**Screenshot script features:**
- `./capture.sh` - Run full batch (all activities)
- `./capture.sh --test-only` - Test mode (first activity only)
- Error handling with success/failure counts
- Real-time progress output

**Video script features:**
- `./capture-video.sh` - Run full batch (all scenarios)
- `./capture-video.sh --test-only` - Test mode (first scenario only)
- `./capture-video.sh --scenario N` - Record specific scenario
- Error handling with success/failure counts
- Real-time progress output

## Tool Usage

| Tool | Purpose |
|------|---------|
| `mcp__atlassian__getJiraIssue` | Fetch ticket |
| `mcp__atlassian__searchJiraIssuesUsingJql` | Find stories |
| `mcp__gitlab__get_merge_request` | MR details |
| `mcp__gitlab__get_merge_request_diffs` | Code changes |
| `mcp__atlassian__createConfluencePage` | Create draft page |
| `mcp__atlassian__updateConfluencePage` | Update page content |
| `AskUserQuestion` | User choices |
| `Read` | Reference files |
| `Write` | Sign-off document |
| `Edit` | Update document |
| `Bash` | Directories, playwright-cli commands,  Python script |
| `playwright-cli` | Browser automation, screenshot capture |

---

# Anti-Patterns

## Document Generation
- ❌ Don't skip MR analysis when JIRA lacks details (document quality depends on it)
- ❌ Don't skip entity data (needed for sanity testing URLs)
- ❌ Don't hardcode URLs (use repository-specific pattern from Step 7.0)
- ❌ Don't use search/list page URLs (use entity detail pages only)
- ❌ Don't crash on MCP failures (offer alternatives)
- ❌ Don't assume entity titles without query (IDs only OK)

## Script Generation & Execution
- ❌ Don't embed scripts in document (keep in scripts/ directory)
- ❌ Don't generate test scripts during document generation (optional Step 8)
- ❌ Don't use TypeScript for capture scripts (use playwright-cli bash scripts instead)
- ❌ Don't run captures in background without progress tracking (run in foreground)
- ❌ Don't execute playwright-cli commands manually (generate script once, execute with test + batch)
- ❌ Don't skip test mode (always run --test-only before full batch)

## Screenshot Capture
- ❌ Don't open/close browser per screenshot (open once, reuse for all)
- ❌ Don't mix screenshot and video in same script (separate scripts)
- ❌ Don't skip sleep delays after navigation (pages need time to load)

## Video Recording
- ❌ Don't record overly long scenarios (split into multiple recordings, max 60 seconds)
- ❌ Don't forget to stop recording before starting next one (each scenario needs separate video-start/stop cycle)
- ❌ Don't record without adequate wait times between steps (minimum 1-2 seconds for clarity)
- ❌ Don't skip test recording (always verify first scenario before batch)
- ❌ Don't hardcode selectors in execute_step() without project context (make them configurable)
- ❌ Don't record scenarios without parsing from document (auto-generate from "Detailed Test Scenarios" section)
