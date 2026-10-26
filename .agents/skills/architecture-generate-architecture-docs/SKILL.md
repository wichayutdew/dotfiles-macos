---
name: architecture-generate-architecture-docs
description: |
  Generate standardized architecture documentation for any repository or workspace.
  Two modes: (1) per-repo scans a single repo and writes event-catalog, api-contracts,
  and system-map to <repo>/overlay/. (2) per-workspace scans repos listed in repos.conf
  and writes aggregated docs (including a repo-summary) to overlay/ at the workspace root.
  Use when onboarding a repo, documenting integrations, updating docs after changes,
  or generating a workspace-wide architecture overview. Works with any language or framework.
user-invocable: true
---

# Generate Architecture Documentation

This skill supports two output modes:

- **Per-repo mode** writes repo-local docs to `<repo-root>/overlay/`
- **Per-workspace mode** writes aggregated docs to `overlay/` at the workspace root

Read the codebase thoroughly before writing anything. Do not guess. Extract facts from source files, configs, and existing documentation. If something cannot be confirmed from the repo, mark it as `(inferred)`.

Never modify application code. This skill only creates or updates documentation files.

When writing documentation, use repository-relative or workspace-relative paths only. Never use absolute filesystem paths like `/Users/...` or `~/`. When commands depend on location, specify "run from the workspace root" or use relative paths like `repos/<repo>/`.

---

## Sourcegraph Annotations

Overlay docs use HTML-comment annotations for live code lookups:

- `<!-- sg:verify keyword_search query="..." -->` — the fact IS stated in prose; run the query to confirm it is still true
- `<!-- sg:lookup keyword_search query="..." -->` — the content is NOT in prose; run the query to get current details

In YAML files, use `#` comments instead: `# sg:lookup keyword_search query="..."`.

When regenerating docs, preserve all existing annotations adjacent to the content they reference. For full annotation details and query syntax, see the architecture-search-code-sourcegraph skill, section "Workspace Annotations".

---

## Deterministic Scripts

This skill includes helper scripts in `scripts/` that provide deterministic checks for workspace and repository status. Use these helpers for concrete filesystem checks and repo classification instead of manually checking for files. All scripts output JSON — see `scripts/README.md` for output schemas and detailed documentation.

Before running any helper, set `SKILL_DIR` to the installed directory for this skill (the directory that contains this `SKILL.md`):

```bash
SKILL_DIR="<installed-skill-dir>/architecture-generate-architecture-docs"
```

---

## Mode Detection

Classify the user's request:

- **Repo-scoped**: user names a specific repo, mentions a path like `repos/payments`, asks to document one service, or references a single codebase → use **per-repo mode**
- **Workspace-scoped**: user asks for a workspace summary, cross-repo overview, all-repo docs, or workspace docs → use **per-workspace mode**
- **Ambiguous**: the request does not clearly indicate scope (e.g., just "generate docs") → ask the user which mode they want before writing files

Decision rules:

1. If the user names a repo or path, use per-repo mode and target that repo.
2. If the user asks for workspace-wide output, use per-workspace mode.
3. If the request is ambiguous, ask the user whether they want per-repo or per-workspace mode before proceeding.
4. User intent always takes priority over directory structure. A repo-scoped request must never be widened to workspace scope.

---

## Per-Repo Mode

Write these files under `<repo-root>/overlay/`:

- `overlay/event-catalog.md`
- `overlay/api-contracts.md`
- `overlay/system-map.md`

If `overlay/` does not exist, create it first.

### Step 0: Preparation

1. Identify the repository root.
2. Detect the tech stack from build files and manifests such as `*.csproj`, `build.gradle`, `pom.xml`, `package.json`, `build.sbt`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, or deployment/config files.
3. Read the directory layout, entrypoints, routing definitions, worker/consumer entrypoints, infra manifests, and configuration files.
4. If workspace-level docs exist, optionally read them for cross-service context. Repo source code is the source of truth for this repo's internals.

### Step 1: Event Discovery -> `overlay/event-catalog.md`

Search the repository for message-driven integrations.

#### What to look for

- RabbitMQ: queue declarations, bindings, publishers, consumers, `BasicPublish`, `BasicConsume`, `IModel`
- Kafka: topics, producers, consumers, consumer groups, listeners, stream processors
- Other messaging systems: Azure Service Bus, AWS SQS/SNS, Redis Pub/Sub, gRPC streaming, WebSocket events, proprietary messaging layers
- Configuration sources: `appsettings.*`, `application.*`, `.env`, Helm values, Terraform, Kubernetes manifests, environment variable references

#### For each integration, document

- Transport type
- Queue or topic name
- Producer classes, services, jobs, or modules
- Consumer classes, services, jobs, or modules
- Payload schema from DTOs, message classes, serializers, or protobuf definitions
- Operational notes such as retries, DLQ behavior, ordering, fan-out, or environment-specific differences

#### Output format

```markdown
# Event Catalog

## [Transport] Events

### [Queue or Topic]

- **Transport:** [RabbitMQ/Kafka/etc.]
- **Producer(s):** [class/service/module]
- **Consumer(s):** [class/service/module]
- **Schema:** [brief summary or fenced json/proto snippet]
- **Notes:** [relevant details]
```

**Important:** Do not include references to external query index files in the generated output. Instead, add inline `<!-- sg:lookup keyword_search query="..." -->` annotations where a reader would want to look up current schema details.

### Step 2: API Discovery -> `overlay/api-contracts.md`

Search the repository for HTTP, gRPC, and webhook interfaces.

#### What to look for

- REST controllers, routers, annotated handlers, API versioning
- gRPC `.proto` files and service implementations
- GraphQL schemas and resolvers if present
- Webhook handlers and callback endpoints
- OpenAPI or Swagger specs
- Health, readiness, and liveness endpoints

#### For each endpoint, document

- Method and path, or gRPC service and method
- Request parameters, path params, query params, and body model
- Response model
- Authentication and authorization requirements
- Implementing module, class, or handler

#### Output format

```markdown
# API Contracts

## REST Endpoints

### [Area or Controller]

`[METHOD] [path]`

- **Description:** [what it does]
- **Request:** [summary or structured fields]
- **Response:** [summary or structured fields]
- **Auth:** [auth requirement]
- **Implemented by:** [class/module]

## gRPC Services

### [Service Name]

`rpc [Method]([Request]) returns ([Response])`

- **Description:** [what it does]
- **Implemented by:** [class/module]
```

**Important:** Do not include references to external query index files in the generated output. Instead, add inline `<!-- sg:lookup -->` annotations where a reader would want to look up current request/response schemas.

### Step 3: System Mapping -> `overlay/system-map.md`

Map how the repository fits into the broader system.

#### What to look for

- Inbound APIs from Step 2
- Outbound HTTP calls, SDK clients, and service URLs
- Outbound gRPC stubs and channels
- Event producers and consumers from Step 1
- Databases, caches, object stores, search indexes, and file stores
- Third-party services, cloud products, and shared infrastructure

#### Output format

```markdown
# System Map

## Service Overview

| Property | Value |
|----------|-------|
| **Service** | [name] |
| **Language** | [language/framework] |
| **Role** | [brief description] |
| **Port** | [port or N/A] |

## Dependencies

### Outbound

| Target | Protocol | Purpose |
|--------|----------|---------|
| [service] | [HTTP/gRPC/etc.] | [why] |

### Inbound

| Source | Protocol | Entry Point |
|--------|----------|-------------|
| [service] | [HTTP/Event/etc.] | [endpoint/topic] |

### Data Stores

| Type | Name | Purpose |
|------|------|---------|
| [Postgres/Redis/etc.] | [identifier] | [why] |

### Events

| Direction | Transport | Queue or Topic | Purpose |
|-----------|-----------|----------------|---------|
| Produces | [type] | [name] | [why] |
| Consumes | [type] | [name] | [why] |

## Mermaid Diagram

Include one diagram that shows the major inbound interfaces, outbound dependencies, data stores, and messaging links.
```

### Step 4: Review

Before finishing:

1. Cross-check that every event in `event-catalog.md` appears in the Events section of `system-map.md`.
2. Cross-check that every API in `api-contracts.md` appears in the Inbound section of `system-map.md`.
3. Verify the Mermaid diagram includes the major external connections.
4. Ensure files were written under `overlay/`, not the repo root.
5. Confirm no application code changed.

---

## Per-Workspace Mode

Read `repos.conf` from the workspace root and generate these files in `overlay/` at the workspace root:

- `overlay/repo-summary.md`
- `overlay/system-map.md`
- `overlay/event-catalog.md`
- `overlay/api-contracts.md`

If `overlay/` does not exist at the workspace root, create it first.

### repos.conf Format

Each non-blank, non-comment line has the form:

```
<directory-name>  <git-url>  [branch]
```

- `directory-name` maps to `repos/<directory-name>`
- `branch` is optional; defaults to the repo's default branch
- Lines starting with `#` are comments

### Step 0: Detect Spawned Workspaces

Run the check-workspace script:

```bash
"${SKILL_DIR}/scripts/check-workspace.sh" .
```

If `is_spawned_workspace` in the JSON output is `true`, **refuse to run workspace mode** and inform the user:

```
ERROR: Cannot run workspace mode from a spawned workspace.

Detected: overlay/ is a symlink (points to main workspace)

Spawned workspaces only have a subset of repos checked out. Running workspace mode
here would regenerate the shared overlay docs from partial data and mark missing
repos as unavailable, corrupting the canonical documentation.

To generate workspace docs, run this skill from the main workspace root (where
overlay/ is a real directory, not a symlink).
```

If `is_spawned_workspace` is `false`, proceed to Step 1.

### Step 1: Read Existing Workspace Docs

If `has_overlay` is `false` from Step 0, skip to Step 2 (you will generate docs from scratch).

If workspace-level overlay docs exist:

1. Read `overlay/system-map.md`, `overlay/event-catalog.md`, `overlay/api-contracts.md`
2. **Extract Sourcegraph annotations**: Capture all `<!-- sg:lookup -->` and `<!-- sg:verify -->` comments for preservation
3. Treat existing workspace docs as the **baseline** — your goal is to augment and update them with fresh repo data, not replace them from scratch
4. If detailed workflow docs exist under `docs/domain/`, read the relevant ones as supporting baseline material for concise workflow summaries in `overlay/system-map.md`

**Annotation Preservation Rules:**

When regenerating workspace overlay docs, preserve all extracted annotations:
- Place them adjacent to the content they reference (events, APIs, dependencies)
- If correct placement is unclear, preserve at end of original section
- Verify in Step 6 that annotation count matches (no annotations dropped)

### Step 2: Enumerate Repositories

1. Read `repos.conf`.
2. Build the repo list and resolve each repo path.
3. Skip missing repos, but record them as unavailable in the summary.

### Step 3: Classify Documentation Readiness

For each repo in `repos.conf`, run the classification script. These calls are independent and can be issued in parallel:

```bash
"${SKILL_DIR}/scripts/classify-repo.sh" repos/<repo-name>
```

The `classification` field in the JSON output will be `generated` (complete overlay), `has_docs` (partial docs), or `no_docs`. Record the classification and `doc_paths` array for each repo for use in Steps 4-5.

### Step 4: Read Supporting Material

Use the existing workspace docs loaded in Step 1 as your baseline (if they exist). Then gather additional content from repos:

1. **`generated` repos** — read repo-local `overlay/` docs (the three files listed in `doc_paths`). Use these to update or augment the workspace docs.
2. **`has_docs` repos** — read the docs listed in `doc_paths` (e.g., `CLAUDE.md`, `AGENTS.md`, `architecture/`). Note what they cover. Use to fill gaps.
3. **`no_docs` repos** — do not fabricate details. Flag as needing doc generation in the summary.

This approach preserves existing workspace knowledge and enhances it with per-repo data.

### Step 5: Generate Aggregated Outputs

#### `overlay/repo-summary.md`

For each repo, include:

- Repo name and path
- Classification: `generated`, `has_docs`, or `no_docs`
- Links to relevant docs (from `doc_paths`)
- What's covered and what's missing
- Recommended next action

Use a table or grouped sections so someone can quickly scan workspace readiness.

Path rules for `repo-summary.md`:

- Show repo paths relative to the workspace root, for example `repos/activity-content-api/`
- For workspace-wide regeneration, instruct the reader to run the skill "from the workspace root" instead of showing an absolute `cd /Users/...` command
- For repo-local regeneration, prefer `cd repos/<repo-name>` or an equivalent relative path

#### `overlay/system-map.md`

Create a cross-repo dependency map that highlights:

- Major services or repos
- Shared data stores or infrastructure
- Cross-repo HTTP/gRPC dependencies
- Cross-repo messaging links
- Unknown edges marked as `(inferred)` when necessary

Include one Mermaid diagram for the workspace view.

**Cross-Repo Workflows:** Add a "Cross-Repo Workflows" section that traces the major end-to-end flows (e.g., content enhancement trigger chain, ETL pipelines). For each workflow, show the sequence of services involved, the transport between them, and the trigger mechanism. If detailed workflow docs already exist under `docs/domain/`, read the relevant ones in Step 1 and use them as the baseline for this section.

Keep this workflow section concise. Use it as an index, not as the full narrative:
- Limit each workflow to a short summary of trigger, services, transport, and downstream effect
- If detailed workflow docs already exist under `docs/domain/`, link to them instead of copying long prose into `overlay/system-map.md`

Apply the Annotation Preservation Rules from Step 1.

#### `overlay/event-catalog.md`

Aggregate all confirmed events across `generated` repos, and optionally include `has_docs` events only when they are explicit in existing docs.

For each event, show:

- Repo
- Transport
- Queue or topic
- Producer(s)
- Consumer(s)
- Notes

Apply the Annotation Preservation Rules from Step 1.

#### `overlay/api-contracts.md`

Aggregate all confirmed APIs across `generated` repos, and optionally include `has_docs` APIs only when explicit in existing docs.

For each API, show:

- Repo
- Protocol
- Endpoint or service/method
- Purpose
- Auth requirement if known

Apply the Annotation Preservation Rules from Step 1.

### Step 6: Review

Before finishing:

1. Verify every repo from `repos.conf` appears in `repo-summary.md`.
2. Verify `generated` repos contribute data to the aggregated docs when source docs exist.
3. Ensure `has_docs` and `no_docs` repos are not overstated.
4. Verify annotation count matches Step 1 extraction (none dropped).
5. Ensure all workspace outputs are written under `overlay/` at the workspace root.

---

## Example Invocations

### Per-Repo Mode

**User request:** "Generate architecture docs for activity-content-api"

**Action:** The skill scans `repos/activity-content-api/` and produces:
- `repos/activity-content-api/overlay/event-catalog.md`
- `repos/activity-content-api/overlay/api-contracts.md`
- `repos/activity-content-api/overlay/system-map.md`

### Per-Workspace Mode

**User request:** "Generate a workspace-wide architecture overview"

**Action:** The skill reads `repos.conf`, scans all repos, and produces:
- `overlay/repo-summary.md` (classification of all repos)
- `overlay/system-map.md` (includes cross-repo workflows section)
- `overlay/event-catalog.md` (aggregated events)
- `overlay/api-contracts.md` (aggregated APIs)

### When to Re-Run

- After adding a new repo to the workspace
- After significant API, event, or infrastructure changes in a repo
- After updating `repos.conf` with new entries
- When baseline assumptions in workspace docs become stale
