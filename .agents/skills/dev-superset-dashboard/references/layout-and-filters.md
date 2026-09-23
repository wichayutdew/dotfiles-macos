# Layout & Filters Reference

## Position JSON Structure

Every component nests: **ROW → COLUMN → CHART/MARKDOWN**. Grid is 12 columns wide.

```
ROOT_ID → GRID_ID → ROW → COLUMN (width: 1-12) → CHART (chartId) or MARKDOWN (code)
```

Every component needs a `parents` array listing its full ancestry.

### Minimal example: two charts side by side

```js
{
  "DASHBOARD_VERSION_KEY": "v2",
  "HEADER_ID": { "type": "HEADER", "id": "HEADER_ID", "meta": { "text": "Dashboard Title" } },
  "ROOT_ID": { "type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"] },
  "GRID_ID": { "type": "GRID", "id": "GRID_ID", "children": ["ROW-1"], "parents": ["ROOT_ID"] },
  "ROW-1": { "type": "ROW", "id": "ROW-1", "children": ["COL-a", "COL-b"], "meta": { "background": "BACKGROUND_TRANSPARENT" }, "parents": ["ROOT_ID", "GRID_ID"] },
  "COL-a": { "type": "COLUMN", "id": "COL-a", "children": ["CHART-a"], "meta": { "width": 6, "background": "BACKGROUND_TRANSPARENT" }, "parents": ["ROOT_ID", "GRID_ID", "ROW-1"] },
  "CHART-a": { "type": "CHART", "id": "CHART-a", "children": [], "meta": { "width": 6, "height": 50, "chartId": 12345, "sliceName": "My Chart" }, "parents": ["ROOT_ID", "GRID_ID", "ROW-1", "COL-a"] },
  "COL-b": { "type": "COLUMN", "id": "COL-b", "children": ["CHART-b"], "meta": { "width": 6, "background": "BACKGROUND_TRANSPARENT" }, "parents": ["ROOT_ID", "GRID_ID", "ROW-1"] },
  "CHART-b": { "type": "CHART", "id": "CHART-b", "children": [], "meta": { "width": 6, "height": 50, "chartId": 12346, "sliceName": "Other Chart" }, "parents": ["ROOT_ID", "GRID_ID", "ROW-1", "COL-b"] }
}
```

### Common widths

| Layout | Columns per chart | Width |
|--------|-------------------|-------|
| Full width | 1 | 12 |
| Half | 2 | 6 |
| Third | 3 | 4 |
| Quarter | 4 | 3 |

### Heights

- KPI cards: `height: 12`
- Standard charts: `height: 50`
- Markdown blocks: `height: 15-25`

### Reorder rows

```js
const dashResp = await fetch('/api/v1/dashboard/<ID>', { credentials: 'include' });
const posJson = JSON.parse((await dashResp.json()).result.position_json);
const children = posJson['GRID_ID'].children;
// splice to reorder, then PUT back
```

## Markdown Components

Type `MARKDOWN` in `position_json`. Nest inside ROW → COLUMN like charts.

```js
"MARKDOWN-intro": {
  "type": "MARKDOWN", "id": "MARKDOWN-intro", "children": [],
  "meta": { "width": 12, "height": 20, "code": "### Title\n\nMarkdown or HTML here" },
  "parents": ["ROOT_ID", "GRID_ID", "ROW-intro", "COL-intro"]
}
```

**Superset strips `<style>` blocks.** Use inline styles on every element:

```html
<table style="width:100%; border-collapse:collapse;">
<tr><th style="padding:10px 14px; background:#f0f0f0; border:1px solid #ddd;">Header</th></tr>
<tr><td style="padding:10px 14px; border:1px solid #ddd;">Value</td></tr>
</table>
```

## Native Filters

Set via `json_metadata.native_filter_configuration` on the dashboard. IDs **must** use `NATIVE_FILTER-` prefix.

```js
const jsonMetadata = {
  native_filter_configuration: [
    {
      id: 'NATIVE_FILTER-time',
      name: 'Time Range',
      filterType: 'filter_time',
      targets: [{ datasetId: DATASET_ID }],
      defaultDataMask: { filterState: { value: 'No filter' } },
      scope: { rootPath: ['ROOT_ID'], excluded: [] }
    },
    {
      id: 'NATIVE_FILTER-category',
      name: 'Category',
      filterType: 'filter_select',
      targets: [{ datasetId: DATASET_ID, column: { name: 'category_col' } }],
      scope: { rootPath: ['ROOT_ID'], excluded: [] },
      controlValues: { enableEmptyFilter: false, multiSelect: true }
    }
  ],
  cross_filters_enabled: true
};

await fetch('/api/v1/dashboard/<ID>', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ json_metadata: JSON.stringify(jsonMetadata) })
});
```

### Filter types

| `filterType` | Purpose |
|--------------|---------|
| `filter_time` | Date/time range picker |
| `filter_select` | Dropdown from column values |
| `filter_range` | Numeric range slider |

### Scoping

Default: all charts. To exclude specific charts:

```js
scope: { rootPath: ['ROOT_ID'], excluded: ['CHART-a'] }
```
