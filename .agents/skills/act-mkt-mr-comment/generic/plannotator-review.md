# Approval review procedure

Use at this skill’s required approval gate, including after feedback. Explicit user and repository instructions control the review interface and any scoped exception.

## Present and wait

1. Read the latest canonical artifact and preserve user edits. Save its complete current content as Markdown, retain the reviewed version and approval purpose in the task record, and present any known decisions with the exact actions being authorized. Use a configured review location; otherwise use `~/repositories/personal/plans/plannotator/` for the local review copy.
2. Discover a suitable Plannotator tool or installed CLI. A tool must support an explicit gate and a final decision. For CLI, use `command -v plannotator` or `~/.local/bin/plannotator` when present, expand home paths before quoting, and execute:

   ```bash
   /absolute/path/to/plannotator annotate "/absolute/path/to/complete-artifact.md" --gate --json --require-approval
   ```

   Launch it in this turn. Use neither `--hook` nor an automatic Stop hook for this transition. If neither tool nor CLI is available and higher-priority instructions permit fallback, provide the complete Markdown artifact/path and wait for explicit chat approval. A failed available command is not absent tooling or permission to substitute chat review.
3. Keep the turn active while review is pending. If execution yields a session/cell ID, wait on that same session until exit. A tool yield is not a review timeout. Do not launch a duplicate review, abandon the process or send a final response while it is pending.

## Consume the decision

Read both CLI JSON and exit status; for a tool, require its documented final decision. A launch acknowledgment is not approval.

| Result | Action |
| --- | --- |
| `approved`, exit `0` | Record the version, approval scope and notes, then execute the authorized next stage without routine reconfirmation. |
| `annotated`, exit `1` | Incorporate feedback into the same artifact, validate it and present it for review again. Do not advance through the gate. |
| `dismissed`, missing/invalid JSON, or failure | No approval. Diagnose recoverable errors and retry only after the prior session has exited; otherwise retain progress and report the factual blocker. |

Chat fallback requires an explicit approval of the presented artifact. Silence, elapsed time, a saved file or approval of a materially different version does not authorize advancement. Reuse existing explicit approval when the current artifact, actions and assumptions remain valid.

## Approval purpose and next stage

Approval authorizes the listed verdicts, scoped fixes, checks and exact replies/delivery actions. Continue to the recorded implementation, verification or delivery stage; a reply-only or local-only contract skips unrelated operations. New feedback remains a separate delta until its scope is authorized.
