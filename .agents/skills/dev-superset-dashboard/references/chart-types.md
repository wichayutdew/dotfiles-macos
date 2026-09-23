# Chart Types Reference

## Metric Formats

Simple aggregation:
```js
{ expressionType: 'SIMPLE', column: { column_name: 'col' }, aggregate: 'AVG', label: 'AVG(col)' }
// aggregate: AVG, COUNT, SUM, MIN, MAX
```

Custom SQL:
```js
{ expressionType: 'SQL', sqlExpression: 'COUNT(*)', label: 'Row Count' }
```

## Filter Format (adhoc_filters)

```js
{ expressionType: 'SIMPLE', subject: 'col', operator: '==', comparator: 'value', clause: 'WHERE' }
// operator: ==, !=, >, <, >=, <=, IN, NOT IN, LIKE
```

## Big Number (KPI card) - `big_number_total`

```js
params: {
  datasource: '<ID>__table', viz_type: 'big_number_total',
  metric: { expressionType: 'SIMPLE', column: { column_name: 'amount' }, aggregate: 'SUM', label: 'Total' },
  adhoc_filters: [{ expressionType: 'SIMPLE', subject: 'status', operator: '==', comparator: 'active', clause: 'WHERE' }]
}
```

## Bar Chart (legacy) - `dist_bar`

Use for non-time-series bar charts. `echarts_bar` may not be registered.

```js
params: {
  datasource: '<ID>__table', viz_type: 'dist_bar',
  groupby: ['category'],              // X-axis
  metrics: [{ expressionType: 'SIMPLE', column: { column_name: 'value' }, aggregate: 'AVG', label: 'Avg' }],
  columns: ['sub_category'],          // color series (optional)
  order_desc: true,
  show_bar_value: true,
  bar_stacked: false,                 // true for stacked
  color_scheme: 'supersetColors',
  show_legend: true
}
```

## Time-series Line - `echarts_timeseries_line`

```js
params: {
  datasource: '<ID>__table', viz_type: 'echarts_timeseries_line',
  x_axis: 'date_column',
  metrics: [{ expressionType: 'SIMPLE', column: { column_name: 'value' }, aggregate: 'AVG', label: 'Avg' }],
  groupby: ['series_column'],
  time_grain_sqla: 'P1W',             // P1D, P1W, P1M
  show_legend: true, rich_tooltip: true
}
```

## Time-series Bar (stacked) - `echarts_timeseries_bar`

```js
params: {
  datasource: '<ID>__table', viz_type: 'echarts_timeseries_bar',
  x_axis: 'date_column',
  metrics: [{ expressionType: 'SQL', sqlExpression: 'COUNT(*)', label: 'Count' }],
  groupby: ['category'],
  time_grain_sqla: 'P1W',
  stack: true, show_legend: true
}
```

## Bubble Chart - `bubble_v2`

Use instead of `echarts_scatter` which may not be registered.

```js
params: {
  datasource: '<ID>__table', viz_type: 'bubble_v2',
  x: { expressionType: 'SIMPLE', column: { column_name: 'x_col' }, aggregate: 'AVG', label: 'X' },
  y: { expressionType: 'SIMPLE', column: { column_name: 'y_col' }, aggregate: 'AVG', label: 'Y' },
  size: { expressionType: 'SQL', sqlExpression: 'COUNT(*)', label: 'Size' },
  series: 'color_column',
  entity: 'id_column',
  color_scheme: 'supersetColors', show_legend: true
}
```

## Table (raw columns) - `table`

```js
params: {
  datasource: '<ID>__table', viz_type: 'table',
  all_columns: ['col1', 'col2', 'col3'],
  order_by_cols: ['["col1", false]'],  // false = DESC
  page_length: 25, include_search: true, table_timestamp_format: 'smart_date'
}
```

## Table (aggregated with groupby) - `table`

```js
params: {
  datasource: '<ID>__table', viz_type: 'table',
  groupby: ['dimension'],
  metrics: [{ expressionType: 'SIMPLE', column: { column_name: 'val' }, aggregate: 'COUNT', label: 'Count' }],
  all_columns: [], order_desc: true, row_limit: 100
}
```

## Update an existing chart

```js
await fetch('/api/v1/chart/<CHART_ID>', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ slice_name: 'New Name', viz_type: 'table', params: JSON.stringify({...}) })
});
```
