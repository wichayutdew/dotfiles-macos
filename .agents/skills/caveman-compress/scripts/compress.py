"""Harness-neutral preparation, validation, backup, and apply operations."""

from __future__ import annotations

from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
import secrets
import tempfile
from typing import Callable, Iterator

from .validate import validate

MAX_FILE_SIZE = 500_000
REQUEST_VERSION = 1
SENSITIVE_PATH_COMPONENTS = {
    ".aws",
    ".gnupg",
    ".ssh",
    "credential",
    "credentials",
    "secret",
    "secrets",
    "vault",
}


class CompressionError(RuntimeError):
    """Base error for local compression workflow failures."""


class StaleSourceError(CompressionError):
    """The source differs from the content used to create a request."""


class ApplyLockError(CompressionError):
    """Another cooperating harness is applying a candidate for this source."""


class CandidateValidationError(CompressionError):
    """The candidate changed protected document structure or content."""


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise CompressionError(f"File must be UTF-8 text: {path}") from error


def _digest(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def _split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---\n"):
        return "", text
    closing = text.find("\n---\n", 4)
    if closing < 0:
        raise CompressionError("YAML frontmatter is missing its closing delimiter")
    end = closing + len("\n---\n")
    return text[:end], text[end:]


def _assert_source(path: Path) -> Path:
    source = path.resolve()
    if any(component.lower() in SENSITIVE_PATH_COMPONENTS for component in source.parts):
        raise CompressionError(f"Refusing sensitive path: {source}")
    if not source.exists():
        raise FileNotFoundError(f"File not found: {source}")
    if not source.is_file():
        raise CompressionError(f"Not a regular file: {source}")
    if source.stat().st_size > MAX_FILE_SIZE:
        raise CompressionError(f"File exceeds {MAX_FILE_SIZE} byte limit: {source}")
    return source


def default_backup_path(source: Path) -> Path:
    """Return a human-readable backup path without overwriting an existing backup."""
    return source.with_name(f"{source.name}.original.md")


def build_compression_instructions(source: Path) -> str:
    return "\n".join(
        [
            "Compress the specified UTF-8 natural-language file into caveman format.",
            "Use this harness's own model capability; do not call a vendor-specific CLI or API.",
            "Read the source from its local path. Write only the complete candidate document.",
            "Preserve every fenced code block, inline code span, URL, file path, heading, list structure,",
            "frontmatter block, proper noun, technical term, number, date, and environment variable exactly.",
            "Compress prose outside protected regions. Do not add wrappers, commentary, or markdown fences.",
            f"Source path: {source}",
        ]
    )


def prepare_request(filepath: Path, request_path: Path) -> dict[str, object]:
    """Create a local, vendor-neutral compression request for an agent harness."""
    source = _assert_source(filepath)
    original = _read_text(source)
    if not original.strip():
        raise CompressionError("Refusing to compress an empty or whitespace-only file")
    _split_frontmatter(original)

    request = {
        "version": REQUEST_VERSION,
        "source_path": str(source),
        "source_sha256": _digest(original),
        "instructions": build_compression_instructions(source),
    }
    destination = request_path.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return request


def _load_request(request_path: Path, source: Path) -> dict[str, object]:
    try:
        request = json.loads(request_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CompressionError(f"Invalid compression request: {request_path}") from error
    if not isinstance(request, dict) or request.get("version") != REQUEST_VERSION:
        raise CompressionError("Unsupported compression request version")
    if request.get("source_path") != str(source):
        raise CompressionError("Compression request belongs to another source file")
    digest = request.get("source_sha256")
    if not isinstance(digest, str) or len(digest) != 64:
        raise CompressionError("Compression request has no valid source digest")
    return request


@contextmanager
def _exclusive_lock(source: Path) -> Iterator[None]:
    """Cooperative cross-harness lock for prepare/apply clients on one source file."""
    lock_path = source.with_name(f"{source.name}.caveman-compress.lock")
    token = secrets.token_hex(16)
    try:
        descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as error:
        raise ApplyLockError(f"Compression apply lock already exists: {lock_path}") from error

    try:
        os.write(descriptor, token.encode("ascii"))
        os.fsync(descriptor)
        yield
    finally:
        os.close(descriptor)
        try:
            if lock_path.read_text(encoding="ascii") == token:
                lock_path.unlink()
        except OSError:
            pass


def _assert_digest(source: Path, expected: str) -> str:
    current = _read_text(source)
    if _digest(current) != expected:
        raise StaleSourceError("Source changed after prepare; create a new request and candidate")
    return current


def _validate_candidate(source: Path, candidate: Path, original: str) -> str:
    if not candidate.exists() or not candidate.is_file():
        raise CompressionError(f"Candidate file not found: {candidate}")
    compressed = _read_text(candidate)
    if _split_frontmatter(compressed)[0] != _split_frontmatter(original)[0]:
        raise CandidateValidationError("Candidate changed YAML frontmatter")

    result = validate(source, candidate)
    if not result.is_valid:
        details = "; ".join(result.errors)
        raise CandidateValidationError(f"Candidate failed validation: {details}")
    return compressed


def _write_exclusive(path: Path, text: str) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
    except Exception:
        try:
            path.unlink()
        except OSError:
            pass
        raise


def _write_replacement(source: Path, text: str) -> Path:
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{source.name}.", suffix=".tmp", dir=source.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        return temp_path
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def apply_candidate(
    filepath: Path,
    request_path: Path,
    candidate_path: Path,
    backup_path: Path | None = None,
    *,
    before_commit: Callable[[], None] | None = None,
) -> Path:
    """Validate and atomically apply a harness-produced candidate document.

    The sidecar lock coordinates cooperating harnesses. Non-cooperating editors
    can ignore that advisory lock, so the source digest is checked both after
    acquisition and immediately before backup/replacement.
    """
    source = _assert_source(filepath)
    request = _load_request(request_path.resolve(), source)
    expected_digest = request["source_sha256"]
    assert isinstance(expected_digest, str)
    backup = (backup_path or default_backup_path(source)).resolve()
    candidate = candidate_path.resolve()

    with _exclusive_lock(source):
        original = _assert_digest(source, expected_digest)
        compressed = _validate_candidate(source, candidate, original)
        if before_commit is not None:
            before_commit()
        _assert_digest(source, expected_digest)
        if backup.exists():
            raise CompressionError(f"Backup already exists: {backup}")

        replacement = _write_replacement(source, compressed)
        try:
            _assert_digest(source, expected_digest)
            _write_exclusive(backup, original)
            _assert_digest(source, expected_digest)
            os.replace(replacement, source)
        except Exception:
            replacement.unlink(missing_ok=True)
            backup.unlink(missing_ok=True)
            raise

    return backup
