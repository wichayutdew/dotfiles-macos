# 1. Read the report

Recover and validate the inherited investigation root/context using [task directory](../generic/task-directory.md) before choosing output paths. Capture the invoking cwd first. Reuse the absolute root from the same session or supplied matching context even if launched elsewhere; for standalone input establish the fallback task directory. Persist the source report identity and paths in `.task-context.json`.

Read the complete supplied report/file/link, including relevant decisions, constraints, risks, and open questions. Use the latest user-edited version as canonical and retain its reference/version. If no report is accessible, ask for its content or reference rather than inventing requirements. A report need not have formal approval to draft a breakdown, but unresolved choices must remain visible.

Identify the product outcome, scope boundaries, dependencies, and what is already implemented. Break down the report's work; do not silently expand the feature, investigate a replacement design, clone repositories, or implement code. If a gap prevents a useful story, expose it for refinement or propose a clearly labeled discovery story.
