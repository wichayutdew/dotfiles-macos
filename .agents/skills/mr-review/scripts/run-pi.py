#!/usr/bin/env python3
"""Run this skill's stages in fresh Pi processes."""
import argparse
import json
import os
import shutil
import shlex
import subprocess
import sys
import time
import uuid
from pathlib import Path

WORKFLOW = {'start': 'fetch', 'gate': 'plan', 'stages': {'fetch': ('fetch.md', 'scout', 'gateway/gemini-3.8-flash', 'low', {'ready': 'review', 'blocked': '$pause', 'handoff': 'fetch'}), 'review': ('findings.md', 'reviewer', 'gateway/grok-4.6', 'high', {'ready': 'plan', 'gaps': 'fetch', 'blocked': '$pause', 'handoff': 'review'}), 'plan': ('plan.md', 'planner', 'gateway/gpt-5.6-terra', 'high', {'ready': 'publish', 'gaps': 'review', 'blocked': '$pause', 'handoff': 'plan'}), 'publish': ('publish-approved.md', 'scout', 'gateway/gemini-3.8-flash', 'low', {'ready': '$done', 'blocked': '$pause', 'handoff': 'publish'})}, 'name': 'mr-review'}
SKILL_DIR = Path(__file__).resolve().parents[1]


def state_root():
    return Path(os.environ.get("WORKFLOW_SKILLS_STATE_DIR", Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state")) / "workflow-skills"))


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("request", nargs="?", help="Natural-language request")
    parser.add_argument("--dry-run", action="store_true", help="Print the first Pi command without running it")
    parser.add_argument("--run-id", help="Resume an adapter-created run")
    parser.add_argument("--approve", action="store_true", help="Resume a plan gate after explicit human approval")
    args = parser.parse_args()
    if args.run_id:
        if args.request:
            parser.error("request cannot be combined with --run-id")
    elif not args.request or not args.request.strip():
        parser.error("a non-empty natural-language request is required")
    return args


def load_run(args):
    root = state_root()
    if args.run_id:
        run_dir = root / args.run_id
        state_file = run_dir / "state.json"
        if not state_file.is_file():
            raise SystemExit(f"run not found: {args.run_id}")
        state = json.loads(state_file.read_text())
        if state.get("status") != "awaiting-approval" or not args.approve:
            raise SystemExit(f"run {args.run_id} awaits explicit approval; resume with --run-id {args.run_id} --approve")
        state["status"] = "running"
    else:
        run_dir = root / f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
        run_dir.mkdir(parents=True, exist_ok=False)
        state = {"request": args.request, "stage": WORKFLOW["start"], "visits": 0, "status": "running"}
        (run_dir / "request.md").write_text(args.request + "\n")
    return run_dir, state


def outcome(raw):
    marker = "## Machine-readable handoff"
    if marker not in raw:
        raise ValueError("Pi response lacks a Machine-readable handoff section")
    payload = raw.split(marker, 1)[1].strip()
    if payload.startswith("```json"):
        payload = payload[len("```json"):].split("```", 1)[0].strip()
    parsed = json.loads(payload)
    if parsed.get("status") not in {"ready", "gaps", "handoff", "blocked"}:
        raise ValueError("handoff status must be ready, gaps, handoff, or blocked")
    return parsed


def prompt(stage, previous):
    filename, role, model, thinking, routes = WORKFLOW["stages"][stage]
    return f"""You are the {role} stage of the {WORKFLOW['name']} workflow.\n\nRequest:\n{previous['request']}\n\nPrevious artifact: {previous.get('artifact', 'None')}\n\nRead and follow this stage prompt exactly:\n{(SKILL_DIR / filename).read_text()}\n\nEnd with `## Machine-readable handoff` followed by one fenced JSON object with status and remaining. Valid statuses: {', '.join(routes)}."""


def run_stage(command, artifact):
    """Run one isolated Pi stage, visualizing it in Herdr when available."""
    if os.environ.get("HERDR_ENV") == "1" and os.environ.get("HERDR_PANE_ID") and shutil.which("herdr"):
        split = subprocess.run(
            ["herdr", "pane", "split", "--current", "--direction", "down", "--cwd", str(Path.cwd()), "--no-focus"],
            text=True,
            capture_output=True,
        )
        if split.returncode == 0:
            try:
                pane_id = json.loads(split.stdout)["result"]["pane"]["pane_id"]
            except (KeyError, TypeError, json.JSONDecodeError):
                pane_id = None
            if pane_id:
                exit_path = artifact.with_suffix(".exit")
                done_marker = f"__WORKFLOW_SKILLS_STAGE_DONE_{uuid.uuid4().hex}__"
                shell_command = (
                    f"{' '.join(shlex.quote(part) for part in command)} > {shlex.quote(str(artifact))} 2>&1; "
                    f"status=$?; printf '%s' \"$status\" > {shlex.quote(str(exit_path))}; "
                    f"printf '\\n{done_marker}%s\\n' \"$status\""
                )
                try:
                    subprocess.run(["herdr", "pane", "run", pane_id, shell_command], check=True, text=True, capture_output=True)
                    subprocess.run(
                        ["herdr", "pane", "wait-output", pane_id, "--match", done_marker, "--source", "recent-unwrapped"],
                        check=True,
                        text=True,
                        capture_output=True,
                    )
                    return int(exit_path.read_text().strip()), artifact.read_text()
                finally:
                    subprocess.run(["herdr", "pane", "close", pane_id], text=True, capture_output=True)
    result = subprocess.run(command, text=True, capture_output=True)
    artifact.write_text(result.stdout + result.stderr)
    return result.returncode, result.stdout + result.stderr


def main():
    args = parse_args()
    run_dir, state = load_run(args)
    if not args.dry_run and not shutil.which("pi"):
        raise SystemExit("Pi executable not found on PATH; use the portable skill instructions or install Pi")
    while True:
        stage = state["stage"]
        filename, role, model, thinking, routes = WORKFLOW["stages"][stage]
        command = ["pi", "--print", "--model", model, "--thinking", thinking, "--", prompt(stage, state)]
        if args.dry_run:
            print(json.dumps({"stage": stage, "command": command[:-1] + ["<assembled prompt>"], "stateDir": str(run_dir)}, indent=2))
            return
        artifact = run_dir / f"stage-{state['visits'] + 1}-{stage}.md"
        returncode, raw = run_stage(command, artifact)
        if returncode:
            raise SystemExit(f"Pi failed at {stage}; artifact: {artifact}")
        try:
            handoff = outcome(raw)
        except (ValueError, json.JSONDecodeError) as exc:
            raise SystemExit(f"invalid Pi handoff at {stage}: {exc}; artifact: {artifact}")
        state.update({"artifact": str(artifact), "visits": state["visits"] + 1, "lastOutcome": handoff})
        target = routes[handoff["status"]]
        if stage == WORKFLOW["gate"] and handoff["status"] == "ready":
            state.update({"status": "awaiting-approval", "stage": target})
            (run_dir / "state.json").write_text(json.dumps(state, indent=2) + "\n")
            print(f"approval required; resume with: python3 {Path(__file__).name} --run-id {run_dir.name} --approve")
            return
        if target in {"$done", "$pause"}:
            state["status"] = "done" if target == "$done" else "blocked"
            (run_dir / "state.json").write_text(json.dumps(state, indent=2) + "\n")
            print(f"{state['status']}; artifact: {artifact}")
            return
        state["stage"] = target
        (run_dir / "state.json").write_text(json.dumps(state, indent=2) + "\n")


if __name__ == "__main__":
    main()
