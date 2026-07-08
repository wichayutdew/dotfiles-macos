---
name: search-code-sourcegraph
description: |
  Search code across repositories using Sourcegraph MCP tools. Use for cross-repo
  code search, symbol tracing, commit history, diff analysis, or when overlay/ docs have
  sg:lookup annotations to resolve. Trigger this skill whenever the user wants to search
  code across repos, find symbol definitions or usages, trace code changes, or resolve
  Sourcegraph annotations in overlay/ docs.
  
license: MIT
compatibility: opencode
user-invocable: true
---


# Code Search with Sourcegraph

Search code across repositories using Sourcegraph MCP tools. No local tooling required.

**For public open-source patterns** (e.g. "how does library X implement Y?"): use `gh_grep_searchGitHub` — searches millions of public GitHub repos by code pattern.

---

## Decision Guide

| Need | Tool | Notes |
|------|------|-------|
| Find code by exact terms | `keyword_search` | Default. 1-3 terms, use `repo:`/`file:` filters |
| Find code by concept | `nls_search` | Semantic/flexible matching, "how does X work" |
| Find repos | `list_repos` | Substring match on repo name |
| Browse files | `list_files`, `read_file` | Always verify file exists before reading |
| Symbol definition | `go_to_definition` | Given a usage, find where it's defined |
| Symbol usages | `find_references` | Given a definition, find all usages |
| Commit history | `commit_search` | Search messages, authors, content, date ranges |
| Code changes | `diff_search` | Search added/removed lines across repos |
| Compare versions | `compare_revisions` | Diff between branches, tags, or commits |
| Who worked on what | `get_contributor_repos` | Find repos by contributor name/email |
| Deep research | `deepsearch` | Complex multi-step questions, architecture analysis |
| Read deep search | `deepsearch_read` | Re-open a previous deep search by URL/token |
| Public OSS patterns | `gh_grep_searchGitHub` | Search millions of public GitHub repos by code pattern |

---

## Tool Details & Best Practices

### `keyword_search` — Default for Code Search

Use for exact keyword matching. Returns top chunks from up to 15 files.

**Best practices:**
- Use 1-3 search terms (terms are AND-ed by default)
- Use `OR` between alternatives: `foo OR bar`
- Filter with `repo:` (regex), `file:` (regex), `rev:` (branch/tag/SHA)
- Use `^` and `$` anchors in repo filters: `repo:^github.com/org/repo$`
- Chain repo filters: `(repo:foo OR repo:bar) searchTerm`
- File extension filter: `file:.*.ts` (regex, not glob)
- Results are case-insensitive

**Do NOT use for:** natural language queries, conceptual/semantic searches, exploratory questions.

```
# Examples
keyword_search query: "repo:^gitlab.example.com/myteam/myrepo$ RabbitMQ"
keyword_search query: "file:.*.scala activityDetailSeo"
keyword_search query: "(repo:service-a OR repo:service-b) workflow trigger"
```

### `nls_search` — Semantic / Conceptual Search

Use when you don't know exact terms, or for broader conceptual matching. Uses stemming and OR-binding between terms.

**Best practices:**
- Extract keywords from natural language — don't pass full sentences
- Supports same `repo:` and `file:` filters as `keyword_search`
- Use for exploratory searches when you're unsure of naming conventions

```
# Examples
nls_search query: "repo:my-api gRPC content merge supplier"
nls_search query: "file:.*.cs GPT prompt template generation"
```

### `find_references` / `go_to_definition` — Symbol Tracing

Use when you've found a symbol and want to trace its definition or usages.

- `go_to_definition`: you see a call to `validateToken()` → find where it's defined
- `find_references`: you see the definition of `ActivityService` → find all usages

Both require: `repo`, `path` (file containing the symbol), `symbol` (identifier name).

### `commit_search` / `diff_search` — History & Changes

**`commit_search`:** Search commit messages, authors, content changes, with date filters.
- `repos` is required (array of repo patterns)
- `messageTerms`, `contentTerms`, `authors` each use OR within, AND across types
- Date filters: `after`, `before` (supports "1 month ago", "2025-01-01", etc.)

**`diff_search`:** Search actual added/removed code lines.
- `repos` is required, `pattern` is required
- `added: true` or `removed: true` to narrow to only additions or removals
- Supports `author`, `after`, `before`, `useRegex`

### `compare_revisions` — Branch/Commit Diffs

Compare two revisions in a single repo. Useful for PR review or release diffs.
- Use `base` (older) and `head` (newer): branch names, tags, or SHAs
- Tip: `commitHash~1` as base to see a single commit's changes

### `list_repos` / `list_files` / `read_file` — Browse & Read

- `list_repos`: find repo by substring (not regex)
- `list_files`: list directory contents (requires `repo`, optional `path`)
- `read_file`: read file content (always verify file exists first via `list_files` or search)

### `deepsearch` — Complex Research

Use for multi-step, cross-repo architectural questions. Slower but thorough — an agentic LLM performs its own searches and synthesizes findings.

Use `deepsearch_read` to re-open a previous deep search by URL or token.

---

## Workspace Annotations (`sg:verify` / `sg:lookup`)

Files in `overlay/` contain Sourcegraph query annotations as HTML comments. These are invisible in rendered markdown but parseable by Claude.

### Annotation types

| Tag | Meaning | Action |
|-----|---------|--------|
| `<!-- sg:verify keyword_search query="..." -->` | The fact IS stated in prose above | Run query to confirm it's still true (spot-check) |
| `<!-- sg:lookup keyword_search query="..." -->` | The content is NOT in prose | Run query to get current details |

In YAML files (where HTML comments aren't valid), annotations use `#` comments:
```yaml
  SEOGPTContent:
    role: GPT/LLM content generation worker
    # sg:lookup keyword_search query="repo:full-stack/-SEO/SEOGPTContent file:Strategies/.*.yaml"
```

### How to use them

1. **Before searching from scratch**, check if the relevant overlay/ doc already has an annotation for what you need.
2. **To execute an annotation**, extract the tool name and query, then call the corresponding Sourcegraph MCP tool. Markdown and YAML annotations work the same way:
   ```
   <!-- sg:lookup keyword_search query="repo:full-stack/-SEO/seo-backoffice file:.*.cs HttpPost OR HttpGet" -->
   # sg:lookup keyword_search query="repo:full-stack/-SEO/SEOGPTContent file:Strategies/.*.yaml"
   →  keyword_search query: "repo:full-stack/-SEO/seo-backoffice file:.*.cs HttpPost OR HttpGet"
   →  keyword_search query: "repo:full-stack/-SEO/SEOGPTContent file:Strategies/.*.yaml"
   ```
3. **`sg:verify`** annotations are optional — only run them when freshness is in question or the user asks to verify.
4. **`sg:lookup`** annotations should be run when the user asks for details that the prose deliberately omits (schemas, param lists, config values).

### Where annotations live

- `overlay/api-contracts.md` — endpoint summary tables + `sg:lookup` for request/response schemas
- `overlay/event-catalog.md` — queue/topic names + `sg:lookup` for message schemas
- `overlay/system-map.md` — architecture narrative, cross-repo workflows + `sg:verify` on key facts
- `overlay/repo-summary.md` — repo classification and readiness status

### Repo Filters

When no nearby `sg:lookup` annotation exists, derive exact `repo:` filters from your repo list or `repos.conf`.

Conversion rules (for GitLab repos):

- `git@<gitlab-host>:Group/project.git`
  → `repo:^<gitlab-host>/Group/project$`
- `https://<gitlab-host>/Group/project.git`
  → `repo:^<gitlab-host>/Group/project$`
- Strip the `.git` suffix and anchor with `^` and `$`

Examples:

- `git@gitlab.example.com:MyTeam/my-api.git`
  → `repo:^gitlab.example.com/MyTeam/my-api$`
- `git@gitlab.example.com:OtherTeam/other-service.git`
  → `repo:^gitlab.example.com/OtherTeam/other-service$`

Combine multiple repos with OR:
`(repo:^gitlab.example.com/TeamA/service-a$ OR repo:^gitlab.example.com/TeamB/service-b$) searchTerm`

---

## Typical Workflows

### Answer a question using overlay/ annotations
1. Read the relevant overlay/ doc (e.g., `overlay/api-contracts.md`)
2. Find `sg:lookup` or `sg:verify` annotations near the topic
3. Execute the embedded query via the corresponding Sourcegraph tool
4. If no annotation exists, build a query using the repo filters above

### Find where a function is used across repos
1. `keyword_search` to locate the definition file
2. `find_references` with the repo, path, and symbol name

### Understand a system or feature
1. `nls_search` for conceptual overview
2. `read_file` on key files identified
3. `deepsearch` if the question spans many repos

### Investigate a recent change
1. `commit_search` with author/date/message filters
2. `diff_search` for specific code patterns added/removed
3. `compare_revisions` to see full diff between versions

### Find the right repo
1. `list_repos` with a keyword
2. `list_files` to browse structure
3. `read_file` on README or entrypoint

---

## Optional: Local Search Fallback

When working inside a cloned repo, local tools can be faster for single-repo searches. These require local installation.

| Tool | Use case | Install |
|------|----------|---------|
| `rg` (ripgrep) | Fast text search | `brew install ripgrep` |
| `ast-grep` | Structural/AST search | `brew install ast-grep` |
| `git grep` | Search tracked files | Built into git |
| `git log -S` | Pickaxe: find commits that changed a string | Built into git |

```bash
# ripgrep examples
rg "pattern"                    # search current dir
rg -n -C 3 "pattern" -t scala  # with line numbers, context, language filter
rg --files | rg "filename"     # find files by name

# ast-grep examples
ast-grep -p 'foo($ARG)'        # find function calls
ast-grep -p '@GetMapping($A)'  # find annotations

# git history
git log -S "functionName"       # commits that added/removed this string
git log -p -- path/to/file     # full diff history of a file
```

**Decision:** Use Sourcegraph for cross-repo or remote search. Use local tools when you're already in a repo and need speed.
