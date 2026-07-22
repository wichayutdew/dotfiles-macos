#!/usr/bin/env python3
"""Harness-neutral CLI for preparing, validating, and applying compression candidates."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from .compress import CandidateValidationError, CompressionError, apply_candidate, prepare_request
from .detect import detect_file_type, should_compress
from .validate import validate


def _prepare(args: argparse.Namespace) -> int:
    source = Path(args.file)
    if not should_compress(source):
        print("Skipping: file is not natural language (code/config)")
        return 0
    request = prepare_request(source, Path(args.request))
    print(f"Prepared request: {args.request}")
    print(f"Source SHA-256: {request['source_sha256']}")
    print("Use your current agent harness to create a candidate file, then run apply.")
    return 0


def _apply(args: argparse.Namespace) -> int:
    backup = apply_candidate(
        Path(args.file),
        Path(args.request),
        Path(args.candidate),
        Path(args.backup) if args.backup else None,
    )
    print(f"Applied candidate: {args.file}")
    print(f"Backup: {backup}")
    return 0


def _validate(args: argparse.Namespace) -> int:
    result = validate(Path(args.original), Path(args.candidate))
    for warning in result.warnings:
        print(f"WARNING: {warning}")
    for error in result.errors:
        print(f"ERROR: {error}")
    return 0 if result.is_valid else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="caveman-compress",
        description="Prepare and safely apply a compression candidate from any agent harness.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    prepare = commands.add_parser("prepare", help="Create a local request for an agent-produced candidate")
    prepare.add_argument("file", help="UTF-8 natural-language file to compress")
    prepare.add_argument("--request", required=True, help="Path for the generated request JSON")
    prepare.set_defaults(handler=_prepare)

    apply = commands.add_parser("apply", help="Validate and atomically apply a candidate file")
    apply.add_argument("file", help="Original source file")
    apply.add_argument("request", help="Request JSON from prepare")
    apply.add_argument("candidate", help="Complete candidate document from the agent harness")
    apply.add_argument("--backup", help="Optional backup path; refuses to overwrite an existing file")
    apply.set_defaults(handler=_apply)

    check = commands.add_parser("validate", help="Validate a candidate without writing files")
    check.add_argument("original", help="Original source file")
    check.add_argument("candidate", help="Candidate document")
    check.set_defaults(handler=_validate)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        raise SystemExit(args.handler(args))
    except (CandidateValidationError, CompressionError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
