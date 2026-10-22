#!/usr/bin/env python3
"""Track workflow-created Git resources and delete them on explicit cleanup."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid


def git(path, *args):
    return subprocess.check_output(["git", "-C", str(path), *args], text=True,
                                   stderr=subprocess.PIPE).strip()


def identity(path):
    if path.is_symlink() or path.resolve() != path:
        raise ValueError(f"symlink or moved path: {path}")
    if Path(git(path, "rev-parse", "--show-toplevel")).resolve() != path:
        raise ValueError(f"not a checkout root: {path}")
    git_dir = Path(git(path, "rev-parse", "--absolute-git-dir")).resolve()
    common = Path(git(path, "rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = path / common
    common = common.resolve()
    kind = "clone" if git_dir == common else "worktree"
    return {"path": str(path), "kind": kind, "gitDir": str(git_dir), "commonDir": str(common)}


def marker(entry):
    return Path(entry["gitDir"]) / "act-mkt-cleanup-token"


def save(ledger, entries):
    descriptor, temporary = tempfile.mkstemp(dir=ledger.parent, prefix=".cleanup-")
    try:
        with os.fdopen(descriptor, "w") as output:
            json.dump({"version": 1, "resources": entries}, output, indent=2)
            output.write("\n")
        os.replace(temporary, ledger)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def validate(entry):
    path = Path(entry["path"])
    if path.is_symlink():
        raise ValueError(f"symlink replacement: {path}")
    if not path.exists():
        return False
    current = identity(path)
    if any(current[key] != entry[key] for key in current):
        raise ValueError(f"checkout identity changed: {path}")
    if not marker(entry).is_file() or marker(entry).read_text() != entry["token"]:
        raise ValueError(f"ownership marker missing or changed: {path}")
    return True


def preflight(entries):
    candidates = []
    for entry in entries:
        present = validate(entry)
        # A manually removed worktree can still have Git registration to remove.
        stale_worktree = (entry["kind"] == "worktree" and Path(entry["gitDir"]).exists())
        if not present and stale_worktree:
            if not marker(entry).is_file() or marker(entry).read_text() != entry["token"]:
                raise ValueError(f"ownership marker changed for missing worktree: {entry['path']}")
            pointer = Path(entry["gitDir"]) / "gitdir"
            if not pointer.is_file() or Path(pointer.read_text().strip()).parent != Path(entry["path"]):
                raise ValueError(f"Git registration changed for missing worktree: {entry['path']}")
        if present or stale_worktree:
            if (Path(entry["gitDir"]) / "locked").exists():
                raise ValueError(f"locked worktree: {entry['path']}")
            candidates.append(entry)
    selected = {entry["path"] for entry in candidates}
    for entry in candidates:
        if entry["kind"] == "clone":
            lines = git(entry["path"], "worktree", "list", "--porcelain").splitlines()
            for line in lines:
                if line.startswith("worktree ") and str(Path(line[9:]).resolve()) not in selected:
                    raise ValueError(f"untracked linked worktree blocks deleting {entry['path']}: {line[9:]}")
        # Skip Git object stores; inspect checkout directories only, without following symlinks.
        for directory, directories, files in os.walk(entry["path"]):
            if ".git" in directories or ".git" in files:
                nested = Path(directory)
                if str(nested) != entry["path"] and str(nested) not in selected:
                    raise ValueError(f"untracked nested checkout blocks deleting {entry['path']}: {nested}")
            if ".git" in directories:
                directories.remove(".git")
    # Remove children before enclosing checkouts, and linked worktrees before
    # the checkout containing their common Git directory. A kind/depth sort is
    # insufficient when a clone inside a worktree owns another external worktree.
    ordered = []
    remaining = list(candidates)
    while remaining:
        ready = [entry for entry in remaining if not any(
            other is not entry and (
                Path(other["path"]).is_relative_to(Path(entry["path"])) or
                (other["kind"] == "worktree" and
                 Path(other["commonDir"]).is_relative_to(Path(entry["path"])))
            ) for other in remaining)]
        if not ready:
            raise ValueError("cyclic workspace dependencies; nothing deleted")
        for entry in ready:
            remaining.remove(entry)
            ordered.append(entry)
    return ordered


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=Path(os.environ.get(
        "ACT_MKT_CLEANUP_LEDGER", str(Path.home() / ".local/state/act-mkt/workspaces.json"))))
    commands = parser.add_subparsers(dest="command", required=True)
    register = commands.add_parser("register", help="record only a resource just created by this workflow")
    register.add_argument("--kind", choices=("clone", "worktree"), required=True)
    register.add_argument("path", type=Path)
    commands.add_parser("list", help="show tracked resources")
    clean = commands.add_parser("clean", help="preview cleanup; --apply deletes even dirty owned resources")
    clean.add_argument("--all", action="store_true", required=True)
    clean.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    ledger = args.ledger.expanduser().resolve()
    ledger.parent.mkdir(parents=True, exist_ok=True)
    # Shared across skill copies and concurrent workers; never truncate the lock file.
    with ledger.with_suffix(ledger.suffix + ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(ledger.read_text()) if ledger.exists() else {"version": 1, "resources": []}
        if data.get("version") != 1 or not isinstance(data.get("resources"), list):
            raise ValueError("unsupported cleanup ledger")
        entries = data["resources"]
        if args.command == "register":
            if args.path.is_symlink():
                raise ValueError("cannot register a symlink")
            path = args.path.expanduser().resolve()
            if path in (Path.home().resolve(), Path(path.anchor)):
                raise ValueError("cannot register home or filesystem root")
            entry = identity(path)
            if entry["kind"] != args.kind:
                raise ValueError(f"expected {args.kind}, observed {entry['kind']}: {path}")
            existing = next((item for item in entries if item["path"] == str(path)), None)
            if existing:
                validate(existing)
                entry = existing
            else:
                entry["token"] = uuid.uuid4().hex
                marker(entry).write_text(entry["token"])
                entries.append(entry)
                save(ledger, entries)
            result = {"ledger": str(ledger), "registered": entry["path"]}
        elif args.command == "list":
            result = {"ledger": str(ledger), "resources": entries}
        else:
            if any(ledger.is_relative_to(Path(entry["path"])) for entry in entries):
                raise ValueError("cleanup ledger must live outside resources being deleted")
            ordered = preflight(entries)  # Validate the entire set before deleting anything.
            deleted = []
            if args.apply:
                for entry in ordered:
                    validate(entry)
                    if entry["kind"] == "worktree":
                        subprocess.run(["git", "--git-dir", entry["commonDir"], "worktree", "remove",
                                        "--force", entry["path"]], check=True, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True)
                    else:
                        shutil.rmtree(entry["path"])
                    deleted.append(entry["path"])
                    entries = [item for item in entries if item["path"] != entry["path"]]
                    save(ledger, entries)
                # Forget resources already removed by a runtime's managed-worktree cleanup.
                entries = [entry for entry in entries if Path(entry["path"]).exists()]
                save(ledger, entries)
            result = {"ledger": str(ledger), "dryRun": not args.apply,
                      "wouldDelete": [entry["path"] for entry in ordered], "deleted": deleted}
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"cleanup blocked: {error}", file=sys.stderr)
        sys.exit(3)
