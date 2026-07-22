# Security

## Model-provider independence

`caveman-compress` does not import model SDKs, invoke vendor CLIs, or make network requests. It only prepares requests, validates candidate files, creates backups, and atomically applies candidates.

The active agent harness performs any model call. Follow that harness's consent, data-boundary, and credential policy. Before an agent passes source content to an external model provider, disclose the destination and obtain required consent.

## Required preflight

Before `prepare`:

1. Confirm user-named file is in scope and is a supported natural-language file.
2. Scan for likely secrets and sensitive personal data without printing values.
3. Stop on a match and request a redacted copy.
4. Explain any external transmission performed by the active harness.

## Local safety properties

- No subprocesses, shell interpolation, network requests, API-key reads, or vendor-specific dependencies.
- `prepare` records source path and SHA-256 digest.
- `apply` uses a cooperative exclusive sidecar lock.
- `apply` rejects stale requests, validates protected content, preserves exact frontmatter, refuses existing backups, and uses a same-directory atomic replacement.
- If apply fails after creating a new backup, it removes that new backup and leaves the source unchanged.

## Concurrency boundary

The sidecar lock prevents concurrent cooperating `apply` calls. It cannot force arbitrary editors or unrelated programs to honor the lock. `apply` rechecks the source digest before backup and replacement, but no portable cross-platform filesystem compare-and-swap can eliminate every non-cooperating-writer race.

## File limit

Files larger than 500 KB are rejected before candidate preparation.
