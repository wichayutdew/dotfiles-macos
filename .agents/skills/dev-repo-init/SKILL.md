---
name: dev-repo-init
description: Generate project and module documentation using reference templates
---

# Repository Initialization

Generate comprehensive documentation for the project root and all modules using standardized templates.

## Step 1: Generate Root Documentation

### 1a. Read Root Context Template

Read the root context structure template:
`${SKILL_ROOT}/references/root-context-structure.md`

### 1b. Analyze Project Structure

Analyze the repository to understand:
- Project components and architecture
- Available development commands
- Tech stack (languages, frameworks)
- Build/test configurations
- GitHub workflows

### 1c. Generate Root CLAUDE.md

Create `CLAUDE.md` at the repository root following the template structure:

**Sections to populate:**
- Repository Overview (projects, components, core concepts)
- Development Commands (quick actions, workflows, language-specific commands)
- Technical Guidelines (language-specific best practices)
- Development Conventions (TODO annotations, patterns)
- Additional Resources

**Critical:** Use actual project information discovered from analysis, not placeholder text.

## Step 2: Discover Project Modules

Run the module discovery script:
```bash
bash ${SKILL_ROOT}/scripts/get-project-modules.sh
```

Parse the JSON output to get list of modules with:
- `name`: Module name
- `language`: Primary language(s)
- `path`: Relative path from repo root

If script returns error, report to user and stop.

## Step 3: Generate Module Documentation

For each module discovered in Step 2:

### 3a. Read Module Context Template

Read the module context structure template:
`${SKILL_ROOT}/references/module-context-structure.md`

### 3b. Analyze Module

For the current module, analyze:
- Module purpose and architecture
- Technology stack and frameworks
- Communication protocols (if applicable)
- Build/test commands
- Logging locations
- Key features and components
- Testing approach and locations

### 3c. Generate Module CLAUDE.md

Create `CLAUDE.md` in the module directory (at `<module-path>/CLAUDE.md`) following the template structure:

**Sections to populate:**
- Overview/Introduction (description, architecture, tech stack)
- Tips and Tricks (component preferences, patterns, verification commands)
- Guidelines (framework conventions, best practices, deprecated patterns)
- Testing (runner info, file locations, philosophy)
- Feature-Specific Sections (if applicable)

**Critical:**
- Use actual module information discovered from analysis
- Tailor content to the module's language and framework
- Skip sections that don't apply to the module

### 3d. Progress Tracking

After completing each module, report progress to user:
`✓ Generated documentation for module: <module-name> (<language>)`

## Step 4: Summary Report

After all modules are processed, provide summary:

```
=== Repository Initialization Complete ===

Root Documentation: ✓ /CLAUDE.md
Modules Documented: X/Y

Module List:
- <module-name> (<language>) - ✓ <module-path>/CLAUDE.md
...

===
```

## Notes

- Use Task tool with subagent for each module to isolate context
- Each module documentation should be independent and self-contained
- Focus on practical, actionable information developers need
- Avoid generic boilerplate - use actual project/module details
- If a module already has CLAUDE.md, ask user if they want to overwrite or skip

## Anti-Patterns to Avoid

- Using placeholder or generic text instead of actual project details
- Overwriting existing CLAUDE.md without asking user first
- Running all modules in a single context instead of using Task subagents
- Including boilerplate sections that don't apply to the module
