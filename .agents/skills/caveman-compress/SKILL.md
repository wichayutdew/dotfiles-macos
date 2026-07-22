---
name: caveman-compress
description: >
  Compress natural-language memory files into concise caveman format with any agent harness.
  Uses local prepare, validate, and atomic apply steps; no vendor CLI or API dependency.
  Use when asked to compress Markdown, text, or prose-heavy memory files while preserving protected content.
---

# Caveman Compress

## Purpose

Compress prose with the current agent harness. Local scripts never select a model, call a vendor API, or invoke a vendor CLI.

Protected content stays exact:

- fenced and indented code;
- inline code;
- URLs, paths, environment variables, technical terms, proper nouns, dates, and numbers;
- headings, list nesting, and YAML frontmatter.

## Supported files

Only natural-language `.md`, `.txt`, `.typ`, `.typst`, `.tex`, or extensionless files. Never compress code or configuration files. Reject backups, directories, symlinks escaping requested workspace, files over 500 KB, and sensitive paths.

## Required preflight

1. Resolve exact user-named path.
2. Explain that the active agent harness may send source content to its configured model provider. Get explicit consent if that harness requires external model processing.
3. Scan for secrets and sensitive personal data without printing values. Stop on a match; request a redacted copy.
4. Read `SECURITY.md`.

## Harness-neutral workflow

From this skill directory:

```bash
python3 -m scripts prepare /absolute/source.md --request /tmp/source.request.json
```

`prepare` performs local checks and writes a request containing source path, SHA-256 digest, and protected-content instructions.

Use the **current agent harness** to read the source, create a complete compressed candidate, and save it outside the source path. Do not add explanation, wrappers, or markdown fences around the candidate.

Validate without mutation:

```bash
python3 -m scripts validate /absolute/source.md /tmp/source.candidate.md
```

Apply only after validation passes:

```bash
python3 -m scripts apply \
  /absolute/source.md \
  /tmp/source.request.json \
  /tmp/source.candidate.md \
  --backup /absolute/source.md.original.md
```

## Apply guarantees

`apply`:

- obtains an exclusive cooperative per-file lock;
- rejects candidates if the source digest changed after `prepare`;
- rechecks source digest immediately before backup and replacement;
- validates protected structure and frontmatter;
- refuses to overwrite an existing backup;
- writes a verified backup, then atomically replaces the source from a same-directory temporary file;
- removes its new backup and temporary output if apply fails.

The lock coordinates cooperating harnesses. An editor that ignores the lock can still race at filesystem level; the digest rechecks detect edits before replacement, but portable cross-platform compare-and-swap is unavailable.

## Compression rules

Remove articles, filler, hedging, redundant phrasing, and duplicate examples. Use short exact prose. Preserve all protected content and structure exactly. If uncertain whether text is protected, leave it unchanged.

## Completion

Report only:

- request path;
- candidate validation result;
- backup path;
- apply result;
- active harness transmission method, if any.

Never echo source or candidate contents.
