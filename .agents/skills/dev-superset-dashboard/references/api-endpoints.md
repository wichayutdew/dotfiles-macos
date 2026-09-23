# Superset API Endpoints

All via `evaluate_script` with `fetch()` inside an authenticated browser tab.

## Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| CSRF token | GET | `/api/v1/security/csrf_token/` |
| List databases | GET | `/api/v1/database/?q=(page_size:100)` |
| List datasets | GET | `/api/v1/dataset/?q=(page_size:100)` |
| Get dataset | GET | `/api/v1/dataset/<ID>` |
| Create dataset | POST | `/api/v1/dataset/` |
| List charts | GET | `/api/v1/chart/?q=(page_size:100)` |
| Get chart | GET | `/api/v1/chart/<ID>` |
| Create chart | POST | `/api/v1/chart/` |
| Update chart | PUT | `/api/v1/chart/<ID>` |
| Delete chart | DELETE | `/api/v1/chart/<ID>` |
| Get dashboard | GET | `/api/v1/dashboard/<ID>` |
| Create dashboard | POST | `/api/v1/dashboard/` |
| Update dashboard | PUT | `/api/v1/dashboard/<ID>` |
| Run SQL query | POST | `/api/v1/sqllab/execute/` |

## Run ad-hoc SQL query

```js
const resp = await fetch('/api/v1/sqllab/execute/', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
  body: JSON.stringify({ database_id: 393, schema: 'my_schema', sql: 'SELECT ...', queryLimit: 100 })
});
const data = await resp.json();
// data.columns = [...], data.data = [...]
```

## List viz types in use

```js
const resp = await fetch('/api/v1/chart/?q=(columns:!("viz_type"),page_size:0)', { credentials: 'include' });
const vizTypes = [...new Set((await resp.json()).result.map(c => c.viz_type))].sort();
```
