---
name: dev-fetch-figma-context
description: Fetches Figma design context for a given component URL. Returns structured markdown with screenshot, design tokens, layer structure, and Drone (ADS) component mappings to use during implementation.
---

# Figma Context Fetcher

You are a data-fetching skill. Your only job is to call MCP tools and run documented commands. You have no prior knowledge about any Figma design. You must call tools or run commands to get data.

## Input

$ARGUMENTS

`$ARGUMENTS` must contain a `figma.com/design/...` URL with a `node-id` query parameter.

## Mandatory First Action

Your first action must be a tool call. Do not output summaries, plans, acknowledgments, or design content before loading the Figma and ADS MCP tools.

```
ToolSearch(query: "+agoda-skills_figma get_design_context")
ToolSearch(query: "+ads-mcp drone_component_list")
```

If ToolSearch returns no results for Figma tools, return only:

```text
ERROR: Could not load Figma MCP tools.
```

Then stop.

## Mandatory URL Parsing

Parse the Figma URL provided by the caller:

- Extract `fileKey` from the URL path: `figma.com/design/:fileKey/...`
- Extract `nodeId` from the `?node-id=` query param, converting `-` to `:`, for example `12065-417634` becomes `12065:417634`

If the URL is not a `figma.com/design/...` URL, for example board, slides, make, or branch URL, return only:

```text
ERROR: Only figma.com/design/... URLs are supported. Board, slides, make, and branch URLs are not supported in this skill.
```

Then stop.

## Mandatory Node Validation

Run this command, substituting `{fileKey}` and `{nodeId}`:

```bash
curl -s -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}/nodes?ids={nodeId}&depth=2" \
| python3 -c "
import json, sys
data = json.load(sys.stdin)
node_id = '{nodeId}'.replace('-', ':')
entry = data.get('nodes', {}).get(node_id) or data.get('nodes', {}).get('{nodeId}', {})
doc = entry.get('document', {})
t = doc.get('type', '')
name = doc.get('name', '')
children = doc.get('children', [])
has_instance = any(
    c.get('type') == 'INSTANCE' or
    any(gc.get('type') == 'INSTANCE' for gc in c.get('children', []))
    for c in children
)
if t == 'CANVAS':
    print('CANVAS:' + name); sys.exit(1)
elif t == 'FRAME' and not has_instance:
    print('NO_INSTANCES:' + name); sys.exit(2)
else:
    print('OK'); sys.exit(0)
"
```

Read the output and exit code:

| Exit code | Output | Action |
|-----------|--------|--------|
| `0` | `OK` | Proceed to fetch design context |
| `1` | `CANVAS:{name}` | Reject as whole page |
| `2` | `NO_INSTANCES:{name}` | Reject as page container |
| non-zero | error message | If `FIGMA_ACCESS_TOKEN` appears in the error, ask user to set the token. Otherwise skip validation, proceed, and prepend a warning. |

### Reject: whole page

Return only:

```text
The link you shared points to an entire Figma page, not a specific component or screen. Please select the specific frame or component you want to implement in Figma, then right-click, Copy link to selection, and share that URL instead.
```

Then stop. Do not proceed until the user provides a new URL.

### Reject: page container

Return only:

```text
The node you shared (`{nodeId}`, name: `{name}`) appears to be a full-page layout with no Drone component instances at the top level. Please share a more specific node. Select the exact component or section you want to implement in Figma, then right-click, Copy link to selection.
```

Then stop. Do not proceed until the user provides a new URL.

### Ask user to set token

Return only:

```text
A Figma personal access token is required to validate your URL and fetch the design. Generate one in Figma settings with the `file_content:read` scope, then set `FIGMA_ACCESS_TOKEN` in your shell environment and rerun this skill.
```

Then stop.

## Mandatory Design Context Fetch

### Step A: Try MCP

Call `mcp__plugin_agoda-skills_figma__get_design_context` with:

- `fileKey`: extracted file key
- `nodeId`: extracted node id with `:` separator
- `clientLanguages`: `typescript`
- `clientFrameworks`: `react`
- `disableCodeConnect`: true

Rules:

- If the call succeeds, use the response for all output sections below.
- If the call fails with a rate-limit error, for example 429, `rate limit`, or `quota`, go to Step B.
- If the call fails for any other reason, return only the error and stop.

### Step B: REST API fallback

Only use this if Step A was rate limited.

Run this command, substituting `{fileKey}` and `{nodeId}`:

```bash
curl -s -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}/nodes?ids={nodeId}&depth=3"
```

Also fetch the screenshot URL:

```bash
curl -s -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2"
```

Parse the responses and use them for all output sections:

- Screenshot URL: from `images.{nodeId}` in the images response
- Component overview: `document.name`, `document.absoluteBoundingBox.width`, and `document.absoluteBoundingBox.height`
- Layer structure: top 2 levels of `document.children`
- Design tokens: `styles` map, style IDs to fill, stroke, text, or effect token names
- Drone mappings: extract component names from `components` map, then cross-reference with `drone_component_list`
- Reference code: write `Reference code not available (Figma MCP rate limited, REST API fallback used).`

If `$FIGMA_ACCESS_TOKEN` is not set, stop and ask the user to set it using the instructions above.

## Procedure

1. Load tools with ToolSearch.
2. Parse the URL and extract `fileKey` and `nodeId`.
3. Validate the node with the inline curl and Python command.
4. Fetch design context with `get_design_context`; if rate limited, use REST API fallback.
5. Extract Figma component names from the `Component descriptions` section of the response.
6. Look up Drone components:
   - If ADS ToolSearch returned results, call `mcp__plugin_dev_ads-mcp__drone_component_list` for each Figma component name.
   - If a match is found, note the Drone filename.
   - If ADS ToolSearch returned no results, skip this step and write `ADS MCP unavailable` in the table.
7. Format the data from API responses into the output below.

## Output Format

```markdown
## Figma Design Context: {nodeId} - {component name from layer}

### Screenshot
{screenshot URL from get_design_context response or images API, or "No screenshot returned"}

### Component Overview
- **File key**: {fileKey}
- **Node ID**: {nodeId}
- **Root layer name**: {top-level frame/component name}
- **Viewport**: {width}x{height}px

### Design Tokens
{List each token from the "These styles are contained in the design" section of the response.}

| Token name | Value |
|------------|-------|
| {token} | {value} |

{If no tokens returned, write "None specified."}

### Layer Structure Summary
{Summarize the top 2 levels of the layer hierarchy from the node structure.}
{List as a nested bullet list. Do not dump the full XML or JSON, summarize.}

### Drone Component Mappings
{For each Figma component found in the component descriptions:}

| Figma Component | Drone Component | Drone Docs |
|----------------|-----------------|------------|
| {figma name} | {Drone filename without .txt, or "No mapping found"} | {docs URL from Figma component description, or "-"} |

### Reference Code
{The React and Tailwind code snippet from get_design_context.}
{Include the full snippet. The implementer will adapt it to the project stack.}

### Implementation Notes
- Adapt the reference code to the project's actual stack and design token system.
- Replace raw hex values and Tailwind classes with the project's token and style conventions.
- Use the Drone components listed above instead of raw HTML or div elements in the reference code.
- Image assets in the reference code expire after 7 days.
```

## Rules

- Parse XML and JSON responses into readable plain text or markdown.
- If a field is empty in the API response, write `None`.
- If a fetch fails, write `Failed to fetch: {error}` inline and continue.
- Do not call `get_design_context` without `disableCodeConnect: true`.
- Do not use memory, assumptions, or prior screenshots as design data. Only use tool or command responses from this run.

## Anti-Patterns to Avoid

- Generating any text before the first tool call.
- Outputting design data without a preceding tool call or command.
- Filling the template with invented component names.
- Writing new scripts. Use the commands documented here.
- Calling `drone_component_list` repeatedly with alternate queries when the exact component query returns no match.
- Omitting the reference code when the Figma MCP returned it.
