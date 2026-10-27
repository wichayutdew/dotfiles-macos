# Plannotator review procedure

Use this procedure whenever the workflow reaches review, including after feedback. An explicit user choice of another interface takes precedence; retain the same approval boundaries in that interface.

## Prepare and launch

1. Read the latest canonical document and preserve user edits. Save the complete current artifact, not an outline or summary. Reuse its canonical local file when it already contains suitable review context. For a narrow edit or a document whose requested content excludes review metadata, save a separate complete local review copy under the bound `workspace.root` per [task directory](task-directory.md). Explicit user/AGENTS-required review locations take precedence; record that actual path in `.task-context.json`. Retain the canonical source/destination and the exact reviewed version in the continuation record. A local review copy does not authorize hosted publication.
2. State the review purpose described below in the review copy or invocation context; keep process metadata out of the canonical document when it is outside the requested content. Resolve any required input first, while continuing independent drafting/research.
3. Discover an available Plannotator tool or CLI. If using a tool, it must support an explicit approval gate and a final decision. For CLI, prefer the installed executable (`command -v plannotator`, or `~/.local/bin/plannotator` when present). Expand home paths to absolute paths before quoting. Run the equivalent of:

   ```bash
   /absolute/path/to/plannotator annotate "/absolute/path/to/complete-artifact.md" --gate --json --require-approval
   ```

   Execute it yourself in the current turn. Plain annotation without `--gate` cannot approve. Do not use `--hook`, defer to a Stop hook, or ask the user to run the command.
4. Keep the turn active until review finishes. If execution returns a running session/cell ID, wait on that same session until exit, sharing concise status updates as needed. A tool yield is not a timeout. Do not launch duplicate reviews, abandon the process, or send a final response while review is pending.

## Consume the result

For CLI, read both the JSON decision and process exit status. For a tool, require its documented successful approval result; a launch acknowledgment is not approval.

| Result | Required transition |
| --- | --- |
| `approved` and exit `0` | Record the reviewed version and approval purpose, carry approval notes into subsequent work, and take the skill-specific next action below without another routine approval request. |
| `annotated` and exit `1` | Read feedback, revise the same canonical artifact, validate it, and launch review again. Do not advance through the gate. |
| `dismissed`, malformed/missing JSON, or failure | No approval. Diagnose recoverable launch/tool errors and retry only after the prior session has exited. Otherwise report the factual blocker and retain the artifact/state; do not silently substitute chat review or advance. |

Never infer approval from silence, elapsed time, saving/presenting the document, or an accepted earlier version with material subsequent changes. Existing explicit approval of the exact current artifact and action remains valid; consume it rather than reopening the same gate unnecessarily.

## Review purpose and next action

State that approval accepts this investigation report only. After approval, finish with the accepted report reference and material limitations. Do not implement it, create tracker items, or start breakdown automatically. Feedback returns to research as needed, validation, presentation, and another review of the revised complete report.
