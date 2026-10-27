# Plannotator review procedure

Use this procedure whenever the workflow reaches review, including after feedback. An explicit user choice of another interface takes precedence; retain the same approval boundaries in that interface.

## Prepare and launch

1. Read the latest canonical document and preserve user edits. Save the complete current artifact, not an outline or summary. Reuse its canonical local file when there is one; otherwise save a local Markdown review copy under the inherited `workspace.root` per [task directory](task-directory.md). Explicit user/AGENTS-required review locations take precedence. Persist the actual review path/version and decision in `.task-context.json`. Retain the canonical source/destination and the exact reviewed version in the continuation record. A local review copy does not authorize hosted publication.
2. Include the review purpose described below in the document. Resolve any required input first, while continuing independent drafting/research. Do not submit unresolved tracker destinations as a creation proposal.
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

The complete proposal must include every epic/story, the source report version, the real tracker/workspace/team/project, supported object types, parent/child relationships, and selected metadata. Explicitly state that approval authorizes creating exactly these items in that destination. After approval of that creation proposal, immediately execute [create approved items](../workflows/create.md), read back the created items, and report verified links. Report acceptance or approval of content alone does not authorize creation. Material changes to content, destination, hierarchy, or metadata require renewed creation approval before affected writes.
