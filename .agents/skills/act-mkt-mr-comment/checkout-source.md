# Stage: checkout-source

## Pi profile

- Role: `scout`
- Model: `gateway/gemini-3.8-flash`
- Thinking: `low`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Check out the reviewed source branch. Mechanical only.

Input: `the invoking request`
Evidence: `{{last.summary}}`

Never stash, reset, clean, or delete unrelated files.

`ready`: source branch bound. Include `workspace: {cwd: "<path>"}`.
`handoff`: transient fetch error.
`blocked`: dirty unrelated checkout or missing remote.


## Required ready response
Put the complete prior Evidence payload verbatim in `Completed`, followed by bound workspace cwd, branch, and HEAD.

# Completed
<complete fetched review evidence>
<workspace cwd, branch, and HEAD>

# Remaining
- None.

When Evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters fetch.
