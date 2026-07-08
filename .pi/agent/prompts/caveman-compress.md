---
description: Compress a memory file (CLAUDE.md, AGENTS.md, todos) into caveman-speak, saving input tokens every future session
argument-hint: "<filepath>"
---
Load the `caveman-compress` skill (~/.agents/skills/caveman-compress/SKILL.md) and compress $1 into caveman format. Overwrite the original file with compressed version. Save human-readable backup as `$1.original.md`. Preserve all technical substance, code, URLs, structure byte-for-byte.
