---
name: coding-standards
description: Apply repository-first code quality, correctness, security, and verification rules. Use when writing or reviewing code.
---

# Repository-First Coding Standards

## Priority

1. User requirements and acceptance criteria.
2. Repository instructions, supported versions, and nearby code/test patterns.
3. Current primary library documentation.
4. These generic defaults.

Never replace an established project pattern solely because another style looks cleaner.

## Before Editing

- Read every target file plus representative callers and tests.
- Search for existing helpers, types, validation, error handling, and test fixtures.
- Identify behavior contract, edge cases, compatibility limits, and smallest verification path.
- Use Context7 or current primary docs for version-sensitive APIs. Do not rely on remembered signatures.

## Implementation

- Make smallest coherent diff. Preserve public behavior outside requested scope.
- Prefer clear data flow and explicit types. Use immutability where it fits existing design; do not force functional or object-oriented rewrites.
- Handle errors at the correct boundary. Never swallow failures or fabricate fallback data.
- Validate untrusted input. Avoid secret leakage, unsafe interpolation, injection, path traversal, and authorization bypass.
- Consider nullability, concurrency, retries, idempotency, time zones, numeric limits, and partial failure only when relevant.
- Avoid speculative abstraction, configuration, dependencies, feature flags, or future-proofing.
- Preserve unrelated formatting and user changes.

## Tests and Completion

- For a bug fix, reproduce with a failing regression check when practical.
- Test observable behavior, edge cases, and failure paths; follow repository test style.
- Run focused checks first, then required wider checks.
- Inspect final diff for scope, generated files, debug code, and accidental secrets.
- Report exact commands and results. Mark skipped or unavailable checks explicitly.
