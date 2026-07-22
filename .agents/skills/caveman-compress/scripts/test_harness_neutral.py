from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from scripts.compress import ApplyLockError, CompressionError, StaleSourceError, apply_candidate, prepare_request


class HarnessNeutralCompressionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.source = self.root / "guide.md"
        self.request = self.root / "request.json"
        self.candidate = self.root / "candidate.md"
        self.backup = self.root / "guide.md.original.md"
        self.original = "# Guide\n\nThis is a very verbose guide for people.\n"
        self.compressed = "# Guide\n\nVerbose guide.\n"
        self.source.write_text(self.original, encoding="utf-8")
        self.candidate.write_text(self.compressed, encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_prepare_and_apply_are_harness_neutral(self) -> None:
        request = prepare_request(self.source, self.request)

        self.assertEqual(request["source_sha256"], hashlib.sha256(self.original.encode()).hexdigest())
        self.assertEqual(request["source_path"], str(self.source.resolve()))
        self.assertIn("own model", request["instructions"])

        apply_candidate(self.source, self.request, self.candidate, self.backup)

        self.assertEqual(self.source.read_text(encoding="utf-8"), self.compressed)
        self.assertEqual(self.backup.read_text(encoding="utf-8"), self.original)

    def test_apply_rejects_source_changed_after_prepare_without_backup(self) -> None:
        prepare_request(self.source, self.request)
        changed = "# Guide\n\nChanged after prepare.\n"
        self.source.write_text(changed, encoding="utf-8")

        with self.assertRaises(StaleSourceError):
            apply_candidate(self.source, self.request, self.candidate, self.backup)

        self.assertEqual(self.source.read_text(encoding="utf-8"), changed)
        self.assertFalse(self.backup.exists())

    def test_apply_rechecks_source_before_backup_and_replace(self) -> None:
        prepare_request(self.source, self.request)
        changed = "# Guide\n\nChanged during apply.\n"

        with self.assertRaises(StaleSourceError):
            apply_candidate(
                self.source,
                self.request,
                self.candidate,
                self.backup,
                before_commit=lambda: self.source.write_text(changed, encoding="utf-8"),
            )

        self.assertEqual(self.source.read_text(encoding="utf-8"), changed)
        self.assertFalse(self.backup.exists())

    def test_apply_rejects_another_harness_holding_the_lock(self) -> None:
        prepare_request(self.source, self.request)
        lock = self.source.with_name(f"{self.source.name}.caveman-compress.lock")
        lock.write_text("other harness", encoding="utf-8")

        with self.assertRaises(ApplyLockError):
            apply_candidate(self.source, self.request, self.candidate, self.backup)

        self.assertEqual(self.source.read_text(encoding="utf-8"), self.original)
        self.assertFalse(self.backup.exists())

    def test_prepare_rejects_sensitive_paths(self) -> None:
        secret_directory = self.root / "secrets"
        secret_directory.mkdir()
        source = secret_directory / "guide.md"
        source.write_text(self.original, encoding="utf-8")

        with self.assertRaises(CompressionError):
            prepare_request(source, self.request)


if __name__ == "__main__":
    unittest.main()
