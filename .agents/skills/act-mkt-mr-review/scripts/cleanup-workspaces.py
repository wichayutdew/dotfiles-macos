#!/usr/bin/env python3
"""Track workflow-created Git resources and delete them on explicit cleanup."""
import argparse
from contextlib import ExitStack
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


def index_path():
    return Path(os.environ.get("ACT_MKT_CLEANUP_INDEX", str(Path.home() / ".local/state/act-mkt/task-ledgers.json"))).expanduser().resolve()


def save_index(index, data):
    descriptor, temporary = tempfile.mkstemp(dir=index.parent, prefix=".index-")
    try:
        with os.fdopen(descriptor, "w") as output:
            json.dump(data, output, indent=2)
        os.replace(temporary, index)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_index(index):
    data = json.loads(index.read_text()) if index.exists() else {"version": 1, "ledgers": []}
    if data.get("version") != 1 or not isinstance(data.get("ledgers"), list):
        raise ValueError("unsupported cleanup index")
    data.setdefault("roots", {})
    if not isinstance(data["roots"], dict):
        raise ValueError("unsupported workspace ownership records")
    return data


def register_root(path):
    root = Path(os.path.abspath(path))
    if root.is_symlink() or root.resolve() != root or not root.is_dir():
        raise ValueError("workspace root must be an existing non-symlink directory")
    if root in (Path.home().resolve(), Path(root.anchor)) or any(root.iterdir()):
        raise ValueError("register-root requires a newly created empty workspace directory")
    # A Git checkout or its ancestor must never become an owned task root.
    probe = subprocess.run(["git", "-C", str(root), "rev-parse", "--show-toplevel"], text=True, capture_output=True)
    if probe.returncode == 0 and Path(probe.stdout.strip()).resolve() == root:
        raise ValueError("workspace root cannot itself be a checkout")
    index = index_path()
    index.parent.mkdir(parents=True, exist_ok=True)
    with index.with_suffix(index.suffix + ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = read_index(index)
        for existing in data["roots"].values():
            other = Path(existing["root"])
            if root == other or root.is_relative_to(other) or other.is_relative_to(root):
                raise ValueError("workspace root overlaps a registered root")
        artifacts = root / ".artifacts"
        artifacts.mkdir()
        ledger = artifacts / "cleanup-ledger.json"
        token = uuid.uuid4().hex
        (artifacts / ".task-root-token").write_text(token)
        save(ledger, [])
        data["ledgers"].append(str(ledger))
        data["roots"][str(ledger)] = {"root": str(root), "token": token}
        save_index(index, data)
    return {"root": str(root), "ledger": str(ledger)}


def root_for(ledger, index_data):
    record = index_data["roots"].get(str(ledger))
    if record:
        root = Path(record["root"])
        if not root.is_absolute() or ledger != root / ".artifacts" / "cleanup-ledger.json":
            raise ValueError("invalid workspace ownership record")
        if root.is_symlink() or root.resolve() != root or root in (Path.home().resolve(), Path(root.anchor)):
            raise ValueError(f"unsafe workspace root: {root}")
        if record.get("deleting"):
            if not root.exists():
                return root
            stat = root.stat()
            if [stat.st_dev, stat.st_ino] != record.get("identity"):
                raise ValueError(f"workspace root changed during cleanup: {root}")
            return root
        marker_path = root / ".artifacts" / ".task-root-token"
        if marker_path.is_symlink() or not marker_path.is_file() or marker_path.read_text() != record.get("token"):
            raise ValueError(f"workspace ownership marker missing or changed: {root}")
        return root
    # Existing indexed roots predate ownership markers. A verified task context
    # and exclusively contained tracked resources establish their relationship.
    if str(ledger) in index_data["ledgers"] and ledger.name == "cleanup-ledger.json" and ledger.parent.name == ".artifacts":
        root = ledger.parent.parent
        context = root / ".task-context.json"
        if (root in (Path.home().resolve(), Path(root.anchor)) or root.is_symlink() or
                root.resolve() != root or context.is_symlink() or not context.is_file()):
            raise ValueError(f"cannot verify legacy task root: {root}")
        data = json.loads(context.read_text())
        workspace = data.get("workspace") if isinstance(data, dict) else None
        if not isinstance(workspace, dict) or workspace.get("root") != str(root):
            raise ValueError(f"cannot verify legacy task root: {root}")
        return root
    return None


def root_preflight(root, entries):
    if not root.exists():
        return
    if root.is_symlink() or not root.is_dir():
        raise ValueError(f"unsafe workspace root: {root}")
    selected = {entry["path"] for entry in entries}
    for directory, directories, files in os.walk(root, followlinks=False):
        current = Path(directory)
        if ".git" in directories or ".git" in files:
            if str(current) not in selected:
                raise ValueError(f"untracked checkout blocks deleting workspace: {current}")
        if ".git" in directories:
            directories.remove(".git")


def all_ledgers(args, legacy, selected_ledger=None):
    index = index_path()
    index.parent.mkdir(parents=True, exist_ok=True)
    with index.with_suffix(index.suffix + ".lock").open("a") as index_lock:
        fcntl.flock(index_lock, fcntl.LOCK_EX)
        data = read_index(index)
        paths = [selected_ledger] if selected_ledger is not None else sorted({legacy, *(Path(p) for p in data["ledgers"])})
        records, roots = {}, {}
        with ExitStack() as stack:
            for ledger in paths:
                record = data["roots"].get(str(ledger), {})
                if not ledger.exists():
                    if record.get("deleting"):
                        root = root_for(ledger, data)
                        roots[ledger] = root
                        continue
                    if str(ledger) in data["ledgers"]:
                        raise ValueError(f"indexed cleanup ledger is missing: {ledger}")
                    continue
                if ledger.is_symlink() or ledger.resolve() != ledger:
                    raise ValueError(f"symlink ledger: {ledger}")
                lock = stack.enter_context(ledger.with_suffix(ledger.suffix + ".lock").open("a"))
                fcntl.flock(lock, fcntl.LOCK_EX)
                item = json.loads(ledger.read_text())
                if item.get("version") != 1 or not isinstance(item.get("resources"), list):
                    raise ValueError("unsupported cleanup ledger")
                records[ledger] = item["resources"]
                root = root_for(ledger, data)
                if root is not None:
                    roots[ledger] = root
            entries = [entry for group in records.values() for entry in group]
            if len({entry["path"] for entry in entries}) != len(entries):
                raise ValueError("resource appears in multiple cleanup ledgers")
            if args.command == "list":
                return {"ledgers": [str(p) for p in records], "resources": entries, "roots": [str(p) for p in roots.values()]}
            if any(ledger.is_relative_to(Path(entry["path"])) for ledger in records for entry in entries):
                raise ValueError("cleanup ledger must live outside resources being deleted")
            ordered = preflight(entries)
            for ledger, root in roots.items():
                if any(not Path(entry["path"]).is_relative_to(root) for entry in records.get(ledger, [])):
                    raise ValueError(f"task ledger includes resource outside workspace: {root}")
                root_preflight(root, entries)
            for root in roots.values():
                registered = [Path(item["root"]) for item in data["roots"].values()]
                registered += [Path(item).parent.parent for item in data["ledgers"]
                               if Path(item).name == "cleanup-ledger.json" and Path(item).parent.name == ".artifacts"]
                if any(other != root and (other.is_relative_to(root) or root.is_relative_to(other)) for other in registered):
                    raise ValueError("overlapping task roots")
            deleted, deleted_roots = [], []
            if args.apply:
                for entry in ordered:
                    validate(entry)
                    if entry["kind"] == "worktree":
                        subprocess.run(["git", "--git-dir", entry["commonDir"], "worktree", "remove", "--force", entry["path"]], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    else:
                        shutil.rmtree(entry["path"])
                    deleted.append(entry["path"])
                    for ledger, group in records.items():
                        if entry in group:
                            group.remove(entry)
                            save(ledger, group)
                            break
                for ledger, group in records.items():
                    save(ledger, [entry for entry in group if Path(entry["path"]).exists()])
                for ledger, root in roots.items():
                    # Persist a tombstone before removing the ledger itself.
                    if str(ledger) not in data["roots"]:
                        data["roots"][str(ledger)] = {"root": str(root), "token": None}
                    if root.exists():
                        stat = root.stat()
                        data["roots"][str(ledger)]["identity"] = [stat.st_dev, stat.st_ino]
                    data["roots"][str(ledger)]["deleting"] = True
                    save_index(index, data)
                    if root.exists():
                        shutil.rmtree(root)
                    data["ledgers"] = [item for item in data["ledgers"] if item != str(ledger)]
                    data["roots"].pop(str(ledger), None)
                    save_index(index, data)
                    deleted_roots.append(str(root))
            return {"ledgers": [str(p) for p in records], "dryRun": not args.apply,
                    "wouldDelete": [entry["path"] for entry in ordered], "deleted": deleted,
                    "wouldDeleteRoots": [str(p) for p in roots.values()], "deletedRoots": deleted_roots}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=Path(os.environ.get(
        "ACT_MKT_CLEANUP_LEDGER", str(Path.home() / ".local/state/act-mkt/workspaces.json"))))
    commands = parser.add_subparsers(dest="command", required=True)
    register = commands.add_parser("register", help="record only a resource just created by this workflow")
    register.add_argument("--kind", choices=("clone", "worktree"), required=True)
    register.add_argument("path", type=Path)
    root_parser = commands.add_parser("register-root", help="register a newly created empty task root")
    root_parser.add_argument("path", type=Path)
    commands.add_parser("list", help="show tracked resources")
    clean = commands.add_parser("clean", help="preview cleanup; --apply deletes even dirty owned resources")
    clean.add_argument("--all", action="store_true", required=True)
    clean.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.command == "register-root":
        print(json.dumps(register_root(args.path), indent=2))
        return
    ledger = args.ledger.expanduser().resolve()
    default_selection = "ACT_MKT_CLEANUP_LEDGER" not in os.environ and not any(arg == "--ledger" or arg.startswith("--ledger=") for arg in sys.argv[1:])
    if args.command in ("list", "clean"):
        legacy = Path(os.environ.get("ACT_MKT_CLEANUP_LEGACY_LEDGER", str(ledger))).expanduser().resolve()
        print(json.dumps(all_ledgers(args, legacy, None if default_selection else ledger), indent=2))
        return
    with ExitStack() as registration:
        # Cleanup and registration use the same lock order: index, then ledger.
        index = index_path()
        index.parent.mkdir(parents=True, exist_ok=True)
        index_lock = registration.enter_context(index.with_suffix(index.suffix + ".lock").open("a"))
        fcntl.flock(index_lock, fcntl.LOCK_EX)
        index_data = read_index(index)
        if os.environ.get("ACT_MKT_REGISTER_LEDGER") == "1":
            if str(ledger) in index_data["roots"]:
                if index_data["roots"][str(ledger)].get("deleting"):
                    raise ValueError("workspace cleanup is already in progress")
                root_for(ledger, index_data)
            elif ledger.name == "cleanup-ledger.json" and ledger.parent.name == ".artifacts":
                context = ledger.parent.parent / ".task-context.json"
                if not context.is_file() or json.loads(context.read_text()).get("workspace", {}).get("root") != str(ledger.parent.parent):
                    raise ValueError("register the owned task root before creating resources")
            if str(ledger) not in index_data["ledgers"]:
                index_data["ledgers"].append(str(ledger))
                save_index(index, index_data)
        ledger.parent.mkdir(parents=True, exist_ok=True)
        # Shared across skill copies and concurrent workers; never truncate the lock file.
        lock = registration.enter_context(ledger.with_suffix(ledger.suffix + ".lock").open("a"))
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
