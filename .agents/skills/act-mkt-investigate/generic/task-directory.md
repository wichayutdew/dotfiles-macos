# Investigation task directory

## Establish the directory during intake

Capture `workspace.launchDirectory` as the absolute invoking cwd before changing directories or running helpers. Every new investigation creates a task directory, including chat-only and no-repository investigations. Use the primary tracker ID exactly as returned as `workspace.workId` with `workIdSource: tracker`; choose a brief descriptive kebab-case explanation as `workspace.description`. The default root is `<launchDirectory>/<workId>-<description>/`, for example `/tmp/launch/ACT-123-checkout-latency/`. Without a ticket, use the description as `workId`, set `workIdSource: summary`, and create `<launchDirectory>/<description>/`, for example `/tmp/launch/checkout-latency/`. Do not use opaque IDs, timestamps, or branch prefixes.

An explicit task-directory location overrides the default. An explicit report file or hosted destination selects the canonical report, not the task root. Before creation, check for path collisions: reuse an existing directory only when the task record or explicit user context establishes it as this same investigation. For an unrelated collision, choose an unused descriptive suffix and record the actual root; never overwrite or silently adopt another task's files. If identity cannot be resolved safely, ask the focused question while continuing independent research.

Revisions and continuations reuse the recorded absolute `workspace.root`, even when invoked elsewhere. Do not nest a fresh task directory beneath it or derive a replacement from the new cwd. If a recorded directory is missing, reconcile its recorded artifacts and restore that same location; do not silently start another task.

## Persist artifacts and handoff

Keep these separate files under `workspace.root`:

- `investigation-plan.md`: the working outline from the plan template; update it as scope/evidence changes.
- `investigation-report.md`: the complete local report. Chat remains the default presentation destination. If the user named another canonical file/document, preserve and revise that destination and keep a complete local review copy here when needed; record which copy/version is current.
- `.task-context.json`: the resumable investigation-to-breakdown record. Read it before updating and preserve unrelated fields. Record absolute paths, not paths relative to a helper's cwd.

The context must contain `workspace` (`launchDirectory`, `workId`, `workIdSource`, `description`, `root`), `contextPath`, and an `investigation` object with `request`, `planPath`, `report` (canonical destination/reference and version), `localReportPath`, `review` (artifact path/version, decision and acceptance evidence), `sources`, `feedbackResolved`, `openQuestions`, `completed`, and `remaining`. Retain accepted decisions, source revisions, limitations, and confirmed/unconfirmed hosted writes. Use null/empty values for not-yet-known facts rather than inventing them.

Persist after intake, planning, report saves, review decisions and continuation checkpoints. On acceptance, finish with the accepted report reference, absolute task root and context path. A later `act-mkt-breakdown` request consumes this same record and writes `breakdown-plan.md` and `breakdown-draft.md` beside the investigation artifacts; acceptance does not start that skill automatically or authorize tracker creation.

Save complete review copies in this directory by default; an explicit user/AGENTS-required review location takes precedence and must be recorded. Product code stays read-only. New evidence clones use this root per local-code-access.md, with the existing cleanup ledger rules; creating an artifact directory does not authorize a branch/worktree, product edits, or hosted writes.
