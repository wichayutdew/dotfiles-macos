---
name: dev-experiment-integration-planner
description: Prepares plan for A/B experiment integration
---

# A/B Experiment Integration Planning Guide

This reference provides guidance on planning integration or de-integration of A/B experiments after they conclude.
These stories or tasks are only created once the experiment has already run on 100% traffic, so it's safe to integrate or de-integrate.
CRITICAL: Spawn a subagent to execute the planning workflow below.

## Understanding Integration vs De-integration

- **Integration**: B side (new code) won the experiment. Remove A side (old code) and make B side the default behavior.
- **De-integration**: A side (old code) won the experiment. Remove B side (new code) and restore A side as the default behavior.

## Planning Workflow

### 1. Determine Integration or De-integration

- If a Jira ticket is provided, fetch it and read the title:
  - "Integration ACT-XXXX" or "Integrate ACT-XXXX" → **Integration** (B side won)
  - "De-Integration ACT-XXXX" or "De-Integrate ACT-XXXX" → **De-integration** (A side won)
  - If the title is ambiguous, ask the user to clarify before proceeding.
- If no Jira ticket is provided, ask the user whether this is an integration or de-integration.
- **Verify with Calculon**: Search for the experiment ID in Calculon and check the outcome:
  - "Flat - B" → B side won, integrate
  - "Flat - OFF" → A side won, de-integrate
  - If Calculon outcome **contradicts** the Jira title, STOP and flag the conflict to the user before proceeding.
- State the determined action explicitly before moving to the next step.

### 2. Initial Discovery with Sourcegraph

- Use Sourcegraph MCP to search for the exact experiment ID. Ignore log files and folder patterns in each search call.
- **Web apps** use the experiment ID directly (e.g., `"ACT-XXXX"` as a string in code).
- **Native mobile apps** (iOS/Android) use a **configuration name** instead of the experiment ID:
  - The configuration name (e.g., `EnableNewCheckoutFlow`) is used in experiment definitions and toggles.
  - It is typically found in code comments near the experiment ID (e.g., `// ACT-XXXX EnableNewCheckoutFlow`).
  - If a configuration name is discovered, search for it separately in Sourcegraph.
- List all repositories where matches were found.

Before continuing, output a repository tracking table:

| Repository | Local/Remote | Status |
|---|---|---|
| repo-a | Local | Pending |
| repo-b | Remote | Pending |

### 3. Classify References

For every match found in step 2, classify it into one of three types:

**String in code** - The experiment ID appears as a string literal (e.g., `"ACT-XXXX"` in a function call or config).
→ Directly actionable. Document file, line number, and context.

**Variable** - The experiment ID is assigned to or wrapped by a variable (e.g., `const expId = "ACT-XXXX"`).
→ Directly actionable. Document and track all usages of that variable in step 4b.

**Comment** - The experiment ID appears only in a code comment.
→ Not directly actionable on its own. **Read ±5 lines around the comment** to check for experiment definitions, toggles, or registrations on adjacent lines. If found, classify those as String or Variable. If the comment is truly standalone, document it for removal.

### 4. For Each Repository, Complete Steps 4a–4f

Update the tracking table status to "In Progress" when starting a repository and "Done" when finished. Do NOT proceed to the next repository until the current one is fully complete.

**CRITICAL**: ALL repositories must be processed - even if a repository is not the current working directory. Never skip a repository as "out of scope." A single leftover experiment reference in any repository means the experiment cannot be closed in Calculon, making the entire integration/de-integration a failure.

**CRITICAL**: Do NOT ask about team ownership or flag other repos as blockers needing a different team. If the user is integrating or de-integrating an experiment, it is their responsibility across all repos unless they explicitly say otherwise. Proceed with the plan for every repo.

#### 4a. Check Local Project Availability

- Check if the project exists locally in `$PROJECTS_DIR`
- If project is found locally:
  - Use LSP servers for precise reference finding
  - Use local file operations for detailed analysis
- If project is NOT found locally:
  - Continue using Sourcegraph MCP for all analysis
  - Use other remote tools as needed

#### 4b. Variable Tracking

- Take all Variable references from step 3, plus any definitions discovered from Comment inspections.
- For each variable:
  - **If local**: Use LSP servers to find ALL references throughout the codebase
  - **If remote**: Use Sourcegraph search to find variable usage patterns
- Track the full flow: experiment ID → configuration name → experiment definition → wrapper variable → consuming locations
- Pay special attention to: function parameters, return values, state management, props passing

#### 4c. Code Path Analysis

- Map out conditional branches: what code runs when experiment is ON vs OFF
- Identify which code represents the A side (old/control) and B side (new/variant)
- Document dependencies between files and components

#### 4d. Critical Assessment

- Be critical: identify ambiguous cases where it's unclear which code is A vs B
- Flag potential risks: shared utilities, database migrations, API contracts
- Note any inconsistencies in how the experiment is checked across different parts of the codebase

#### 4e. Execution Plan Creation

Create a detailed table with these columns:

- **File Path**: Where the code is located
- **Line Number(s)**: Specific lines to modify
- **Code Context**: Brief snippet showing the experiment check
- **Variable/Check Used**: How the experiment is being checked
- **A Side Code**: What runs when experiment is OFF
- **B Side Code**: What runs when experiment is ON
- **Action Required**: What to keep/remove based on integration or de-integration
- **Risk Level**: Low/Medium/High
- **Notes/Dependencies**: Any concerns or related changes needed

#### 4f. Recommendations

- Suggest order of operations (which files to modify first)
- **ALL code edits require high-level scrutiny** - no change is trivial when removing experiment code
- Each change should be git committed with semantic commit messages
- Tests must be run after each commit to verify nothing broke
- Recommend testing strategy for the changes
- Flag any configuration files, feature flags, or external systems that need updates

## Quality Standards

- **Completeness**: Every reference must be found. Missing even one can break production.
- **Clarity**: The plan should be detailed enough that any engineer can execute it
- **Critical Thinking**: Challenge assumptions. If something looks wrong or inconsistent, call it out explicitly
- **Planning Only**: Create the plan, don't execute code changes. Implementation is a separate step after user approval.

## Output Format

Structure the analysis as:

1. **Executive Summary**: Brief overview of the experiment footprint (X files, Y references, Z variables)
2. **Direct References Table**: All places where experiment ID is used directly
3. **Variable References Table**: All wrapper variables and their usage locations
4. **Execution Plan Table**: The comprehensive action plan described above
5. **Risk Assessment**: High-level risks and concerns
6. **Recommended Approach**: Step-by-step order of operations with git commit points
7. **Questions/Ambiguities**: Anything that needs clarification before proceeding

## Critical Considerations

- Experiments can have complex interdependencies - trace them thoroughly
- Configuration files and feature flag systems often cache experiment states - don't forget to check those
- A missed reference in production can break user experience for millions of users
- Be thorough, be critical, be comprehensive.
- Every change should be committed and tested - never batch multiple file changes into one commit.
- **CRITICAL - Final Verification**:
    - Search the ENTIRE codebase for ANY remaining experiment ID references (`ACT-XXXX`, `ACT_XXXX`, or variants)
    - Even ONE leftover reference = integration BLOCKED. You cannot mark the experiment as integrated.
    - This includes: comments, logs, config files, test fixtures, documentation
    - If ANY reference must be kept, STOP immediately and get explicit user approval before proceeding

## Example Workflow

```text
User: "Integrate ACT-4100."

Your Response:
1. Fetch Jira ticket → title says "Integration ACT-4100"
   Verify with Calculon → outcome is "Flat - B"
   → Both agree: **Integration** (B side won, remove A side)
2. Search for "ACT-4100" using Sourcegraph MCP (ignores log files and folders)
3. Output repository tracking table:
   | Repository       | Local/Remote | Status  |
   | supply-service   | Local        | Pending |
   | checkout-web     | Remote       | Pending |
4. For supply-service (Local → In Progress):
   a. Find wrapper variables (e.g., `isNewCheckoutEnabled`)
   b. Use LSP to find all references to these variables
   c. Read relevant files for detailed analysis
   d. Create execution plan table
   e. Assess risks → Mark "Done"
5. For checkout-web (Remote → In Progress):
   a. Use Sourcegraph for variable tracking
   b. Use search patterns to find all usage
   c. Create execution plan table
   d. Assess risks → Mark "Done"
6. Present comprehensive plan for user approval
```

Remember: Your role is to be thorough and systematic. Missing a reference can cause production incidents. Take the time to trace every usage completely.

## Anti-Patterns to Avoid

- Skipping a repository because it's not the current working directory or "out of scope."
- Deferring work to another team - asking "who is the team owner?" or flagging a repo as a blocker needing a different team. It's the user's responsibility unless they say otherwise.
- Treating comments as non-actionable without inspecting ±5 surrounding lines. Comments are breadcrumbs to experiment definitions.
- Only searching for the experiment ID (`ACT-XXXX`) and missing the configuration name used in native mobile apps.
- Skipping the Calculon verification in step 1 and assuming integration/de-integration from the Jira title alone.
- Executing code changes without user approval. This skill produces a plan, not an implementation.
- Batching multiple file changes into a single commit during implementation.
