# Caveman Compress

Harness-neutral prose compressor. Local Python scripts prepare, validate, back up, and apply candidates. Your active agent harness supplies the model work.

## Requirements

- Python 3.10+
- Any agent harness able to read a file and write a candidate document
- No vendor SDK, vendor CLI, API key, or network connection required by this skill

## Flow

```text
prepare source + request digest
  |
agent harness creates candidate
  |
validate candidate
  |
apply under cooperative lock
  |
verified backup + atomic source replacement
```

## Use

```bash
python3 -m scripts prepare /absolute/README.md --request /tmp/readme.request.json
```

Use the current agent harness to create `/tmp/readme.candidate.md`. Preserve all code blocks, inline code, URLs, paths, headings, lists, frontmatter, technical terms, proper nouns, dates, numbers, and environment variables exactly.

```bash
python3 -m scripts validate /absolute/README.md /tmp/readme.candidate.md
python3 -m scripts apply \
  /absolute/README.md \
  /tmp/readme.request.json \
  /tmp/readme.candidate.md \
  --backup /absolute/README.md.original.md
```

## Safety

- Files over 500 KB, unsupported file types, and sensitive paths are rejected.
- `prepare` stores source SHA-256. `apply` rejects stale candidates.
- `apply` obtains a cooperative sidecar lock and rechecks source before backup/replacement.
- Existing backups are never overwritten.
- Candidate validation checks headings, code blocks, URLs, paths, bullet structure, inline code, and frontmatter.
- Source replacement uses a same-directory temporary file plus atomic `os.replace`.

The lock coordinates cooperating harnesses. Non-cooperating editors can ignore it; source digest checks detect changes before replacement but cannot create a portable filesystem-wide compare-and-swap.

## Tests

```bash
python3 -m unittest scripts.test_harness_neutral
```
