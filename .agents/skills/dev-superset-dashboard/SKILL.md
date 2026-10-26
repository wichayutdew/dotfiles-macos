---
name: dev-superset-dashboard
description: Create and manage Superset dashboards, charts, datasets, filters, and layout using Chrome DevTools MCP. Use when the user wants to (1) create a new Superset dashboard, (2) add or modify charts on a dashboard, (3) create virtual datasets from SQL, (4) set up dashboard filters, (5) manage dashboard layout programmatically, (6) add markdown/text components to dashboards. Requires Chrome DevTools MCP with an authenticated Superset browser tab open.
---

# Superset Dashboard via Chrome DevTools MCP

Create datasets, charts, dashboards, filters, and layout on Superset using Chrome DevTools MCP to drive the browser.

## Approach

Two interaction modes - pick based on what's being done:

- **UI interactions** (`navigate_page`, `take_snapshot`, `click`, `fill`, `press_key`) - for SQL Lab, creating/naming dashboards, editing dataset metadata
- **API via browser** (`evaluate_script` with `fetch()`) - for charts, layout, filters, markdown components. More reliable than the React UI for these operations

> `fetch()` inside the browser piggybacks on existing session cookies. `curl` returns 401 without auth.

## Setup

1. Superset must be open and logged in in the browser
2. Select the tab:
```
mcp__chrome-devtools__list_pages → find Superset tab
mcp__chrome-devtools__select_page → select by pageId
```
3. For API calls, fetch CSRF token first inside each `evaluate_script`:
```js
const csrfResp = await fetch('/api/v1/security/csrf_token/', { credentials: 'include' });
const csrf = (await csrfResp.json()).result;
```

## Workflow

### 1. Create Dataset

**Via UI** - navigate to SQL Lab, inject SQL into Ace editor via `evaluate_script`, run query, save as dataset. See `${SKILL_ROOT}/references/ui-interactions.md`.

**Via API**:
```js
await fetch('/api/v1/dataset/', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ database: DB_ID, schema: 'my_schema', table_name: 'name', sql: 'SELECT ...' })
});
```

### 2. Create Dashboard

**Via UI** - navigate to dashboard list, click "+ DASHBOARD", fill title, save. See `${SKILL_ROOT}/references/ui-interactions.md`.

**Via API**:
```js
await fetch('/api/v1/dashboard/', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ dashboard_title: 'My Dashboard', published: false })
});
```

### 3. Create Charts

Always use API - the React UI has combobox and plugin registry issues.

```js
await fetch('/api/v1/chart/', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({
    datasource_id: DATASET_ID, datasource_type: 'table',
    dashboards: [DASHBOARD_ID],
    slice_name: 'Chart Name',
    viz_type: 'dist_bar',
    params: JSON.stringify({ /* see ${SKILL_ROOT}/references/chart-types.md */ })
  })
});
```

For chart type params (`dist_bar`, `big_number_total`, `echarts_timeseries_line`, `echarts_timeseries_bar`, `bubble_v2`, `table`), see `${SKILL_ROOT}/references/chart-types.md`.

### 4. Set Dashboard Layout

Layout is controlled by `position_json` - a flat JSON object. Every chart nests: **ROW → COLUMN → CHART**. Grid is 12 columns wide. See `${SKILL_ROOT}/references/layout-and-filters.md` for full structure and examples.

```js
await fetch('/api/v1/dashboard/' + DASHBOARD_ID, {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ position_json: JSON.stringify(positionJson) })
});
```

### 5. Add Filters

Filters go in `json_metadata.native_filter_configuration`. IDs must use `NATIVE_FILTER-` prefix. See `${SKILL_ROOT}/references/layout-and-filters.md`.

### 6. Add Markdown Components

Add `MARKDOWN` type components to `position_json`. Superset strips `<style>` blocks - use inline `style=""` on every HTML element.

## Gotchas

- `echarts_bar` and `echarts_scatter` may not be registered - use `dist_bar` and `bubble_v2`
- `echarts_timeseries_line` and `echarts_timeseries_bar` work fine
- StarRocks: no CTEs inside Superset-wrapped subqueries - use inline subqueries
- Element UIDs change after each `take_snapshot` - never reuse old UIDs
- For dashboard screenshots, use `resize_page` (e.g., 1920x3000)

## References

- `${SKILL_ROOT}/references/chart-types.md` - metric formats, filter formats, and params for every viz type
- `${SKILL_ROOT}/references/layout-and-filters.md` - position_json structure, grid system, markdown components, native filters
- `${SKILL_ROOT}/references/ui-interactions.md` - step-by-step UI interaction patterns for SQL Lab, dataset creation, dashboard naming
- `${SKILL_ROOT}/references/api-endpoints.md` - full API endpoint reference table
