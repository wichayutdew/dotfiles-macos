# Breakdown task directory

## Recover the investigation directory first

Before changing directories or running helpers, capture the absolute invoking cwd. Recover the preceding investigation's task root and `.task-context.json` from the same session or an explicitly supplied context path. Read the current record and latest canonical report; validate that their report identity/version and task match this breakdown. A supplied report directory containing a matching `.task-context.json` is also a valid recovery source. Retain `workspace.launchDirectory`, `workId`, `workIdSource`, `description`, `root` and all investigation state.

Use that same absolute root even if breakdown is invoked from another cwd. Do not create another directory, nest a new root, rename the investigation root for a newly created epic, or relocate the source report. If the inherited root is missing, reconcile its recorded artifacts and restore that same location; do not silently choose a replacement. If context and report conflict, resolve the mismatch before writing there; continue independent read-only drafting where possible.

## Standalone breakdown

A report from any source is valid; investigation is not a prerequisite. With no inherited context, honor an explicit task-directory location. Otherwise create `<invocation-directory>/<ticket-ID>-<brief-description>/` using the primary tracker ID exactly and a short descriptive kebab-case summary. Without a ticket create `<invocation-directory>/<brief-description>/`. Record `workId` (ticket ID or summary), `workIdSource` (`tracker` or `summary`), `description`, absolute `launchDirectory` and `root` in `workspace`. An arbitrary external report's parent directory does not establish task ownership.

Check an existing directory's task identity before reuse. Preserve unrelated files; for an unrelated collision use an unused descriptive suffix and record the actual root. An ambiguous inherited identity needs clarification, not a guessed fallback directory.

## Save the breakdown alongside the investigation

- Save the working outline as `<workspace.root>/breakdown-plan.md` and the complete epic/story proposal as `<workspace.root>/breakdown-draft.md`. Update those same artifacts through refinement; preserve investigation-plan.md and investigation-report.md.
- If the user selected another canonical draft destination, preserve it and retain a complete local review copy under the root. Record the current canonical reference/version and review-copy path. Explicit user/AGENTS review-location requirements override the default local review location.
- Read and update `<workspace.root>/.task-context.json`, preserving existing investigation fields. For standalone input, initialize that record with the same `workspace` and absolute `contextPath` fields; no installation of investigate is required.
- Append/update `breakdown` with `sourceReport` (canonical reference/version), `planPath`, `draftPath`, `canonicalDraft`, `review` (artifact path/version, decision and explicit creation approval), `trackerDestination`, `feedbackResolved`, `openQuestions`, `completed`, `remaining`, and `createdItems` (stable draft labels, confirmed IDs/URLs/readbacks and unconfirmed actions). Use null/empty values for unknown facts; do not invent approval or tracker state.
- Persist after report intake, planning, draft saves, review decisions and each creation/readback checkpoint. Include the absolute root, context path and saved plan/draft references in the final handoff; continuations read this same record before reconciling tracker state.

The directory holds artifacts; it is not a Git worktree. Directory reuse and report acceptance authorize no tracker mutations. Preserve the separate explicit creation gate and all hosted-write permissions.
