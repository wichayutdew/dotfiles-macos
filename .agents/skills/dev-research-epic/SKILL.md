---
name: dev-research-epic
description: Research a JIRA epic and break it down into implementable stories with sign-off documentation.
---

---
description: Research a JIRA epic and break it down into implementable stories with sign-off documentation
argument-hint: [epic_id]
---

# Research Epic

User will invoke this command to research a JIRA epic comprehensively, create sign-off documentation, and break it down into JIRA stories.

## Input

$ARGUMENTS (expected: JIRA Epic ID, e.g., ACT-1000)

## Workflow Overview

- The skill will handle the entire workflow:
  1. Fetch epic from JIRA by spawning a subagent with `Agent(skill="dev-fetch-jira-context", args=<epic-id>)`
  2. Align understanding with user through early validation questions
  3. Collects context from Figma, repositories, Slack, Grafana, and documentation using general-purpose subagents
  4. Validates findings with user through targeted questions
  5. Breaks down epic into discrete JIRA stories with user approval
  6. Creates comprehensive sign-off document with test cases, acceptance criteria, and story breakdown
  7. Creates JIRA stories with complete, actionable descriptions

## Instructions

### Phase 1: Epic Discovery and Context Gathering

#### 1.1 Get Epic Details from JIRA

If the user provides an epic ID (e.g., ACT-1000), fetch it directly. Otherwise, ask for the epic ID.

Spawn a subagent with this spec: `Agent(skill="dev-fetch-jira-context", args=<epic-id>)`.

Pass the Epic ID as `<epic-id>`. The main thread must not load or execute `dev-fetch-jira-context` directly. The spawned subagent must load the skill and return only the structured Jira context markdown.

Verify the returned primary ticket type is "Epic". If not, stop and inform the user.

Parse the returned epic description to extract:
- Business context and motivation
- High-level goals
- Success metrics
- Any referenced URLs, Figma links, document links, Slack threads
- Acceptance criteria from the returned Acceptance Criteria section

#### 1.2 Find Linked Issues

Search for all issues linked to the epic:

```bash
# Using JQL to find child issues
```

Call `mcp__plugin_agoda-skills_at__searchJiraIssuesUsingJql`:
- `cloudId: "agoda.atlassian.net"`
- `jql: "parent = <epic-id> OR 'Epic Link' = <epic-id>"`
- `fields: ["summary", "description", "status", "issuetype", "priority"]`

Document existing child stories and their status. This helps identify gaps in coverage.

#### 1.3 Align Understanding with User

Before diving into detailed context gathering, validate your understanding with the user.

Call `AskUserQuestion` to confirm alignment on:

**Epic Understanding:**
- "Based on the epic description, my understanding is [summarize the goal and key requirements]. Is this correct?"
- "What are the main success criteria from your perspective?"
- "Are there any specific constraints or non-functional requirements I should be aware of?"

**Scope Clarification:**
- "Which platforms are in scope: Web, iOS, Android, or all?"
- "Are there any features explicitly out of scope?"

**Context Availability:**
- "Are there design mockups or Figma links I should reference?"
- "Which repositories will be affected by this work?"
- "Were there any previous discussions in Slack or documentation I should review?"

Limit to 3-4 most critical alignment questions. Document user responses — these will guide the depth and focus of subsequent context gathering phases.

#### 1.4 Extract and Validate Figma Links

From the epic description and linked issues, extract all Figma URLs:
- `figma.com/design/:fileKey/:fileName?node-id=:nodeId`
- `figma.com/board/:fileKey/:fileName`

**IMPORTANT**: Delegate Figma design analysis to the `dev-fetch-figma-context` skill in a spawned subagent. The main thread must not call Figma MCP tools directly.

For each `figma.com/design/...` URL found, spawn a subagent with this spec:

`Agent(skill="dev-fetch-figma-context", args=<figma-design-url>)`

Pass the full Figma design URL as `<figma-design-url>`. The spawned subagent must load the skill and return only the structured Figma design context markdown.

The returned design context should document:
- Design system components used
- UI flows and states
- Responsive breakpoints
- Interaction patterns
- Accessibility requirements noted in design

If the URL is a board, slides, make, branch, or page-level URL, ask the user for a specific `figma.com/design/...` selection link.

If no Figma links found, note this gap and ask user for designs during the alignment step (1.3).

#### 1.5 Repository Analysis

**1.5a Identify Affected Repositories**

Search for repository references in:
- Epic description (explicit repo mentions or GitLab links)
- Existing child issue descriptions
- Component labels on the epic

If repositories are mentioned, check if they exist locally:

```bash
# Check for local repositories
ls -d $PROJECTS_DIR/<repo-name> 2>/dev/null
```

**1.5b Analyze Codebase Context**

For each identified repository:

**If local:**
- Please see code structure from `${SKILL_ROOT}/references`
- Use Grep/Glob to find related features, components, or modules
- Read relevant files to understand current implementation
- Identify patterns, utilities, and existing conventions
- Look for related tests and documentation

**If remote or unclear:**
- Use Agent with subagent_type=Explore to research:
  - Existing features related to epic goals
  - Architectural patterns used
  - Component structure and conventions
  - Testing patterns and coverage
- Please see code structure from `${SKILL_ROOT}/references`

Document:
- Files/modules that will likely be affected
- Existing patterns to follow or extend
- Technical constraints or dependencies
- Reusable components or utilities

#### 1.6 Search Slack for Context

**IMPORTANT**: Delegate Slack analysis to a general-purpose subagent. The operations below should be performed by the subagent, not the main agent.

Launch a general-purpose agent to:

Call `mcp__plugin_agoda-skills_slack__slack_search_public_and_private`:
- `query: "<epic-id>"` to find discussions about the epic
- Also search for key terms extracted from epic summary
- **Note**: Searching by epic-id may return a limited subset of conversations. Consider expanding to related feature names, component names, or broader keywords if the initial search yields few results.

For each relevant thread found:
- Call `mcp__plugin_agoda-skills_slack__slack_read_thread` to get full conversation

The subagent should extract:
  - Technical decisions and rationale
  - Edge cases or concerns raised
  - User feedback or requirements
  - Implementation blockers or dependencies
  - Team agreements or consensus

#### 1.7 Search Documentation with Glean

Call `mcp__plugin_agoda-skills_glean__search`:
- Search for epic ID, feature name, and related keywords
- Look for: PRDs, design docs, technical specs, runbooks, team decisions

For each relevant document:
- Call `mcp__plugin_agoda-skills_glean__read_document` to get full content
- Extract:
  - Requirements and specifications
  - Architecture decisions
  - Integration points
  - Performance considerations
  - Security and compliance requirements

#### 1.8 Grafana Analysis (if applicable)

If the epic involves changes to observable systems (APIs, metrics, logging):

**IMPORTANT**: Delegate Grafana analysis to a general-purpose subagent. The operations below should be performed by the subagent, not the main agent.

Launch a general-purpose agent to:

Call `mcp__plugin_agoda-skills_grafana__search_dashboards`:
- Search for dashboards related to affected services or features
- Identify metrics that will need monitoring

For relevant dashboards:
- Call `mcp__plugin_agoda-skills_grafana__get_dashboard_by_uid`

The subagent should document:
  - Current metrics and thresholds
  - Monitoring and alerting strategy
  - Performance baselines
  - Metrics to add or modify for the new feature

### Phase 2: Validation with User

Create a structured set of questions to validate your understanding and fill gaps:

Call `AskUserQuestion` with focused questions about:

**Connections and Integration:**
- "How does [Component A] connect with [Component B]?" (if unclear from research)
- "Should this feature integrate with [existing system]?" (if integration is ambiguous)
- "Which API endpoints will be affected?" (if multiple candidates exist)

**Data and State:**
- "Where should [data type] be stored?" (if storage strategy is unclear)
- "What happens to existing [data] during migration?" (if data migration is needed)
- "How should we handle [edge case] data?" (if edge cases are identified)

**Scope and Priority:**
- "Should [feature variant] be included in this epic or deferred?" (for scope clarification)
- "Which platform(s) are in scope: Web, iOS, Android?" (if not explicit)
- "Are there any out-of-scope items we should explicitly document?" (to set boundaries)

**Missing Information:**
- "I couldn't find [Figma designs / Slack discussion / technical spec]. Can you provide links?" (for any gaps in Phase 1)
- "Who are the key stakeholders we should align with?" (for communication planning)

**Technical Decisions:**
- "Should we use [approach A] or [approach B] for [technical decision]?" (when multiple valid approaches exist)
- "What's the rollout strategy: feature flag, gradual rollout, or immediate?" (for deployment planning)

Limit to 3-4 most critical questions per AskUserQuestion call. Use multiSelect: true when multiple options apply.

Document user responses carefully. These answers will inform the sign-off document and story breakdown.

### Phase 3: Epic Breakdown into Stories

Before creating the sign-off document, break down the epic into discrete, implementable stories. This breakdown will be included in the sign-off document.

#### 3.1 Create Minimal Story Breakdown

**CRITICAL**: Break down into MINIMAL stories to enable parallel development.

**Reference**: Follow all story breakdown patterns and ticket format from dev-jira-ticket skill template format (reference the dev-jira-ticket skill prompt), including:
- Implementation phases and parallel execution waves
- **Priority**: High, Medium, Low
- **Dependencies**: List as "Story #" or "None" (ONLY essential blocking dependencies)
- **ACs Covered**: Which acceptance criteria this story addresses
- **Can Parallel** (optional, Format A only): List story numbers that can run simultaneously

**Important**: The final story should be ONE E2E/QA/Sign-off story that covers all testing, validation, and epic sign-off.

#### 3.2 Create Story Drafts for Review

Before asking for confirmation, create detailed story drafts in markdown format:

**CRITICAL**: Do NOT create JIRA tickets yet. Save story drafts as markdown files for user review first.

For each story in the breakdown:
1. **Use the Write tool** to create a markdown file for each story:
   - File path format: `.sdd/output/epic-signoff/story-drafts-<epic-id>/story-<number>-<slug>.md`
   - Example: `.sdd/output/epic-signoff/story-drafts-ACT-1000/story-1-frontend-search-ui.md`
   - You MUST call Write tool once per story to create these files
2. Use dev-jira-ticket skill template format for story content (Context, What Needs to Happen, Acceptance Criteria, Technical Notes, etc.)
3. Include specific file paths, affected repositories, and implementation details
4. Reference acceptance criteria from the epic

**Example:**
```
Epic: ACT-1000

Story 1: [FE] Search UI Component
→ Write tool: .sdd/output/epic-signoff/story-drafts-ACT-1000/story-1-frontend-search-ui.md

Story 2: [BE] Search API Endpoint  
→ Write tool: .sdd/output/epic-signoff/story-drafts-ACT-1000/story-2-backend-search-api.md

Story 3: [E2E] Sign-off
→ Write tool: .sdd/output/epic-signoff/story-drafts-ACT-1000/story-3-e2e-signoff.md
```

#### 3.3 Confirm Story Breakdown with User

**IMPORTANT**: Present the story breakdown table to the user and explicitly ask for approval before proceeding.

Show the user:
- Story breakdown table with titles, types, priorities, dependencies
- Implementation phases and parallelization strategy
- Location of story draft files for detailed review

Call `AskUserQuestion`:
- "I've created a breakdown of X stories. Please review the story drafts in `.sdd/output/epic-signoff/story-drafts-<epic-id>/`. Does this breakdown look correct?"
- Options: "Approve - proceed to create sign-off document", "Request changes - I'll provide feedback"

**CRITICAL**: Wait for user approval before proceeding to Phase 4. If user requests changes:
- Ask what changes are needed
- Update story drafts accordingly
- Re-confirm with user

### Phase 4: Sign-Off Document Creation

After user approves the story breakdown, create a comprehensive sign-off document at `.sdd/output/epic-signoff/<epic-id>.md` that includes the approved story breakdown from Phase 3.

#### Document Structure: please use signoff template from `${SKILL_ROOT}/template/signoff-doc-template.md`

Save this document and present it to the user.

**CRITICAL**: Do NOT proceed to Phase 5 (JIRA creation) automatically. Present deliverables and wait for explicit user confirmation.

Present to the user:
1. **Sign-Off Document**: `.sdd/output/epic-signoff/<epic-id>.md` - comprehensive epic documentation
2. **Story Drafts**: `.sdd/output/epic-signoff/story-drafts-<epic-id>/` - detailed story descriptions in markdown format
3. **Summary**: Number of stories, implementation phases, dependencies

Example:
```markdown
# Epic Research Complete: ACT-XXXX

## Deliverables Created

✅ **Sign-Off Document**: `.sdd/output/epic-signoff/ACT-XXXX.md`
- X requirements documented
- Y acceptance criteria defined
- Z test scenarios defined

✅ **Story Drafts**: X stories in `.sdd/output/epic-signoff/story-drafts-<epic-id>/`

| # | Title | Type | Priority | Dependencies |
|---|-------|------|----------|--------------|
| 1 | ... | ... | ... | ... |

**Next Step**: Review the deliverables above. If approved, I can create JIRA tickets from these drafts.
```

### Phase 5: Create JIRA Stories (User Must Confirm)

**CRITICAL**: Only proceed with this phase if the user explicitly approves and requests JIRA ticket creation.

Call `AskUserQuestion`:
- "The epic research is complete. Would you like me to create JIRA tickets from the approved story drafts?"
- Options: "Yes - create JIRA tickets now", "No - I'll review first and ask you later"

**If user selects "No"**: Stop here. Do NOT create JIRA tickets. User can invoke the skill again later or manually create tickets from the drafts.

**If user selects "Yes"**: Proceed with creating JIRA stories below.

For each story in the approved breakdown:

#### 5.1 Read Story Draft and Construct Description

Read the story draft from `.sdd/output/epic-signoff/story-drafts-<epic-id>/story-<number>-<slug>.md`

Use the content from the draft as the JIRA description (already in dev-jira-ticket template format):

**CRITICAL**: There should be only ONE E2E/QA/Sign-off story per epic (not separate E2E, QA, and sign-off stories).

For the **E2E/QA/Sign-off story**, use the following sections from `.sdd/output/epic-signoff/<epic-id>.md` as the description:

**Required Sections:**
1. **Test Strategy** - Complete test strategy section
2. **Test Scenarios** - All detailed test scenarios with steps and evidence requirements
3. **💟 Test Scenarios** - Test scenarios table
**Conditional Sections** (only include if mentioned in epic):
- **🈚️ CMS Translation** - Only if CMS translations mentioned
- **♿️ Accessibility** - Only if accessibility requirements mentioned

**Story Title Format**: `[E2E] Sign-off of epic name` or `[QA] Epic epic name sign-off`

Do NOT create separate stories for E2E, QA, and sign-off - they are all the same story.

#### 5.2 Create Story in JIRA

Call `mcp__plugin_agoda-skills_at__createJiraIssue`:
- `cloudId: "agoda.atlassian.net"`
- `fields.project.key: "ACT"` (or extracted from epic)
- `fields.parent.key: "<epic-id>"` (link to epic)
- `fields.summary: "<story-title>"`
- `fields.description: "<markdown-description>"` (use Markdown, NOT wiki markup or ADF JSON)
- `fields.issuetype.name: "Story"`
- `fields.priority.name: "Medium"` (or derived from story table)
- `fields.components`: Copy from epic if applicable

Capture the created story key (e.g., ACT-1234).

#### 5.3 Track Progress

Create a task for each story using `TaskCreate`:
- Task name: Story title
- Status: Pending → In Progress → Done

Update task status as each story is created:
- Call `TaskUpdate` with status "done" after successful JIRA creation
- If creation fails, update task with error details and ask user how to proceed

Maintain a summary:

```markdown
## Story Creation Progress

- ✅ Story 1: ACT-1234 created
- ✅ Story 2: ACT-1235 created
- ⏳ Story 3: In progress...
- ❌ Story 4: Failed - [error message]
```

#### 5.4 Update Epic with Story Links

After all stories are created, update the epic description to include:

```markdown
## Child Stories

This epic is broken down into the following stories:

- [ACT-1234](link) - [FE] Story title
- [ACT-1235](link) - [BE] Story title
- ...

For detailed implementation plan and sign-off criteria, see:
`.sdd/output/epic-signoff/<epic-id>.md`
```

Call `mcp__plugin_agoda-skills_at__editJiraIssue` to append this section to the epic description.

### Phase 6: Final Deliverables (JIRA Tickets Created)

**This phase only runs if user approved JIRA ticket creation in Phase 5.**

After all JIRA stories are successfully created, present the final summary to the user:

1. **Sign-Off Document**: `.sdd/output/epic-signoff/<epic-id>.md`
2. **Story Drafts**: `.sdd/output/epic-signoff/story-drafts-<epic-id>/` (markdown files used to create tickets)
3. **Created Stories**: List of JIRA story keys with links
4. **Story Breakdown Summary**: The tracking table with final story IDs
5. **Next Steps**: Suggested order of implementation based on dependencies

**Do NOT create a README.md file.** Present the summary directly to the user.

Example output:

```markdown
# Epic Research Complete: ACT-1000

## ✅ Deliverables

**Sign-Off Document**: `.sdd/output/epic-signoff/ACT-1000.md`
- 12 requirements documented
- 8 test scenarios defined
- 3 repositories analyzed

**Story Drafts**: 7 markdown files in `.sdd/output/epic-signoff/story-drafts-ACT-1000/`

**JIRA Stories Created**: 7 stories
```

## Quality Standards

- **Completeness**: Every requirement from the epic must be captured in stories
- **Traceability**: Each story must clearly link back to epic requirements and acceptance criteria
- **Actionability**: Stories must have enough detail (file paths, patterns, dependencies) for any engineer to start immediately
- **Testability**: Every AC must have a concrete test scenario in the sign-off document
- **Clarity**: No ambiguous language. Use specific file paths, component names, and API endpoints.

## Anti-Patterns

- **Creating JIRA tickets without user confirmation**: NEVER create JIRA tickets automatically - always ask user explicitly after presenting story drafts
- **Creating README.md at the end**: Do NOT create a README.md file - present the summary directly to the user
- **Skipping story draft creation**: Always create markdown story drafts in `.sdd/output/epic-signoff/story-drafts-<epic-id>/` for user review BEFORE creating JIRA tickets
- **Skipping validation questions**: Always ask user to confirm connections and clarify ambiguities - assumptions lead to rework
- **Generic test scenarios**: "Test the feature works" is not actionable - specify exact steps, inputs, and expected outputs
- **Missing Figma context**: If Figma links are broken or missing, flag immediately and ask user - don't proceed without design clarity
- **Forgetting customfield_10096**: Acceptance criteria in this field are critical - always fetch and incorporate them
- **Creating stories without epic link**: All stories MUST have `fields.parent.key` set to link them to the epic
- **Using wiki markup or ADF JSON**: Always use Markdown for descriptions - the Atlassian MCP tool auto-converts to ADF
- **Vague file paths**: "Update the search component" is incomplete - must specify exact file path like `src/components/Search/SearchBar.tsx`
- **Ignoring story dependencies**: Some stories must be implemented before others - document and sequence them correctly
- **Not documenting out-of-scope items**: Explicitly state what's NOT included to prevent scope creep and misalignment
- **Skipping repository analysis**: Never create stories without understanding current codebase structure and patterns via Phase 1.5
- **Batching all questions at once**: Ask targeted questions after each phase - don't overwhelm user with 20 questions upfront
- **Skipping early alignment (step 1.3)**: Always confirm understanding with user BEFORE deep context gathering - prevents wasted effort on wrong assumptions
- **Proceeding without story breakdown approval**: After Phase 3.3, wait for user approval before creating sign-off document

## Examples

### Example 1: Full Epic Research

**User**: "Research epic ACT-1000"

**Response**:
1. Fetch ACT-1000 from JIRA → Type is "Epic" ✓
2. Extract requirements and ACs from description + customfield_10096
3. Ask user 3 alignment questions about scope, platforms, and constraints (Phase 1.3)
4. Spawn `dev-fetch-figma-context` subagents for Figma analysis, one per design URL
5. Identify 2 affected repos: activities-web (local), checkout-service (remote)
6. Launch general-purpose agent for Slack analysis → Search "ACT-1000", find 2 relevant threads, extract technical decisions
7. Search Glean for "new checkout flow" → Find PRD and technical spec
8. Launch general-purpose agent for Grafana analysis → Search dashboards for "checkout", find monitoring dashboard
9. Ask user 3 questions about integration points and edge cases (validation phase)
10. Break down into 6 stories
11. Create story drafts in `.sdd/output/epic-signoff/story-drafts-ACT-1000/` (6 markdown files)
12. Ask user: "Please review story drafts. Does this breakdown look correct?" → User approves
13. Create sign-off document with 10 test scenarios
14. Present deliverables: sign-off doc + story drafts
15. Ask user: "Would you like me to create JIRA tickets from these drafts?" → User approves
16. Create all 6 stories in JIRA linked to epic
17. Present final deliverables with JIRA links and implementation order

### Example 2: Epic with Missing Information

**User**: "Research ACT-2000 and break it down"

**Response**:
1. Fetch ACT-2000 → Epic found
2. Ask user alignment questions about understanding and scope (Phase 1.3)
3. Description mentions Figma but no link provided
4. Launch general-purpose agent to search Slack for "ACT-2000" → No threads found
5. Repository is unclear from description
6. Ask user:
   - "Can you provide the Figma link for the designs?"
   - "Which repository should these changes go in?"
   - "Were there any Slack discussions I should reference?"
7. Wait for user responses before proceeding to detailed context gathering
8. Launch Figma, Slack, and Grafana analysis as needed, using `dev-fetch-figma-context` subagents for Figma design URLs
9. Break down into stories, create story drafts
10. Ask user: "Please review story drafts. Does this breakdown look correct?" → User approves
11. Create sign-off document
12. Present deliverables
13. Ask user: "Would you like me to create JIRA tickets?" → User says "No - I'll review first"
14. Stop here. Do NOT create JIRA tickets. User can ask later after review.

### Example 3: Epic Already Has Some Stories

**User**: "Break down epic ACT-3000"

**Response**:
1. Fetch ACT-3000 and find 3 existing child stories
2. Analyze existing stories to understand what's already covered
3. Ask user alignment questions about scope and constraints (Phase 1.3)
4. Launch agents to collect context from all sources, using `dev-fetch-figma-context` subagents for Figma design URLs
5. Analyze repositories locally or via Explore agent
6. Search documentation via Glean
7. Break down remaining requirements into new stories
8. Create story drafts for the 4 new stories only (not duplicating existing ones)
9. Ask user: "Found 3 existing stories. Proposing 4 additional stories. Please review drafts." → User approves
10. Create sign-off document noting which requirements are already covered
11. Present deliverables: "3 existing stories + 4 new story drafts"
12. Ask user: "Would you like me to create JIRA tickets for the 4 new stories?" → User approves
13. Create only the new stories (avoiding duplicates)
14. Update epic description with full story list including pre-existing ones
