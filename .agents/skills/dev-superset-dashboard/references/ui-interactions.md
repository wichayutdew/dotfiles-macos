# UI Interaction Patterns

Step-by-step Chrome DevTools MCP interactions for Superset UI operations.

## Create Dataset via SQL Lab

### Navigate to SQL Lab

```
mcp__chrome-devtools__navigate_page → url: "https://superset.agodadev.io/sqllab"
```

### Inject SQL into Ace editor

SQL Lab uses Ace editor - `fill` doesn't work. Use `evaluate_script`:

```js
const editor = ace.edit(document.querySelector('.ace_editor'));
editor.setValue(`SELECT col1, col2 FROM schema.table WHERE condition`);
```

### Run the query

```
mcp__chrome-devtools__take_snapshot → find Run button UID
mcp__chrome-devtools__click → click it
```

Or: `mcp__chrome-devtools__press_key → Ctrl+Enter`

### Save as dataset

```
take_snapshot → find Save button
click → Save
take_snapshot → find "Save as Dataset" option
click → select it
take_snapshot → find name input
fill → type dataset name
click → confirm
```

### Fix schema if needed

Datasets may save under the wrong schema. Navigate to edit page:

```
navigate_page → url: "https://superset.agodadev.io/tablemodelview/edit/{DATASET_ID}"
take_snapshot → find Schema dropdown
click → open dropdown
fill → type correct schema
click → select, then Save
```

## Create Dashboard via UI

```
navigate_page → url: "https://superset.agodadev.io/dashboard/list/"
take_snapshot → find "+ DASHBOARD" button
click → creates dashboard, redirects to edit mode
take_snapshot → find title textbox
fill → type dashboard name
take_snapshot → find Save button
click → save
```

## General UI Interaction Pattern

For any Superset UI operation:

1. `navigate_page` to the correct URL
2. `take_snapshot` to get the a11y tree with element UIDs
3. `click` or `fill` using UIDs from the **latest** snapshot
4. `take_snapshot` again if the page changed (UIDs are now stale)
5. Repeat until done
6. `take_screenshot` to verify visually if needed
