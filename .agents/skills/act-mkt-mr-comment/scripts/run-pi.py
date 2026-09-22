#!/usr/bin/env python3
"""Run one workflow stage in an interactive Pi child session."""
import argparse
import json
import os
import shutil
import shlex
import subprocess
import time
import uuid
from pathlib import Path

WORKFLOW = {'start': 'fetch', 'gate': 'plan', 'stages': {'fetch': ('fetch.md', 'scout', 'gateway/gemini-3.8-flash', 'low', {'ready': 'checkout-source', 'blocked': '$pause', 'handoff': 'fetch'}), 'checkout-source': ('checkout-source.md', 'scout', 'gateway/gemini-3.8-flash', 'low', {'ready': 'plan', 'gaps': 'fetch', 'blocked': '$pause', 'handoff': 'checkout-source'}), 'plan': ('plan.md', 'planner', 'gateway/gpt-5.6-terra', 'high', {'ready': 'implement', 'gaps': 'fetch', 'blocked': '$pause', 'handoff': 'plan'}), 'implement': ('implement.md', 'worker', 'gateway/kimi-k2.7-code', 'high', {'ready': 'verify', 'blocked': '$pause', 'handoff': 'implement'}), 'verify': ('verify.md', 'reviewer', 'gateway/grok-4.6', 'high', {'ready': 'deliver', 'gaps': 'implement', 'blocked': '$pause', 'handoff': 'verify'}), 'deliver': ('publish.md', 'scout', 'gateway/gemini-3.8-flash', 'low', {'ready': '$done', 'gaps': 'implement', 'blocked': '$pause', 'handoff': 'deliver'})}, 'name': 'mr-comment'}
SKILL_DIR = Path(__file__).resolve().parents[1]


def state_root():
    return Path(os.environ.get("WORKFLOW_SKILLS_STATE_DIR", Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state")) / "workflow-skills"))


def args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", required=True, choices=WORKFLOW["stages"])
    parser.add_argument("--request", required=True)
    parser.add_argument("--previous-handoff", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    result = parser.parse_args()
    if not result.request.strip():
        parser.error("a non-empty natural-language request is required")
    if result.previous_handoff and not result.previous_handoff.is_file():
        parser.error(f"previous handoff not found: {result.previous_handoff}")
    return result


def child_prompt(stage, request, previous):
    filename, role, _model, _thinking, routes = WORKFLOW["stages"][stage]
    return f"""You are the {role} stage of the {WORKFLOW['name']} workflow.

Request:
{request}

Previous handoff: {previous or 'None'}

Read and follow this stage prompt exactly:
{(SKILL_DIR / filename).read_text()}

When finished, call `workflow_complete` exactly once with a status from {', '.join(routes)} and a JSON array of remaining work, blockers, or artifact paths. Do not print a Machine-readable handoff section or write the launcher handoff yourself: this tool persists it and exits Pi."""


def extension():
    return '''import { writeFile, rename } from "node:fs/promises";
import { Type } from "typebox";
const path = process.env.WORKFLOW_SKILLS_HANDOFF_PATH;
const allowed = new Set((process.env.WORKFLOW_SKILLS_ALLOWED_STATUSES || "").split(","));
export default function (pi) {
  pi.registerTool({ name: "workflow_complete", label: "Complete workflow stage", description: "Persist the handoff and gracefully exit Pi.", parameters: Type.Object({ status: Type.String(), remaining: Type.Array(Type.String()) }), async execute(_id, params, _signal, _update, ctx) {
    if (!allowed.has(params.status)) return { content: [{ type: "text", text: "Invalid workflow status" }], details: {} };
    const handoff = { schemaVersion: 1, workflow: process.env.WORKFLOW_SKILLS_WORKFLOW, stage: process.env.WORKFLOW_SKILLS_STAGE, status: params.status, remaining: params.remaining };
    await writeFile(`${path}.${process.pid}.tmp`, JSON.stringify(handoff) + "\\n");
    await rename(`${path}.${process.pid}.tmp`, path);
    ctx.shutdown();
    process.exit(0);
  }});
}
'''


def read_handoff(path, stage):
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid or unreadable handoff: {exc}") from exc
    if value.get("schemaVersion") != 1 or value.get("workflow") != WORKFLOW["name"] or value.get("stage") != stage:
        raise ValueError("handoff does not match this workflow stage")
    if value.get("status") not in WORKFLOW["stages"][stage][4] or not isinstance(value.get("remaining"), list) or not all(isinstance(item, str) for item in value["remaining"]):
        raise ValueError("handoff has an invalid status or remaining value")
    return value


def run_child(command, environment):
    if not (os.environ.get("HERDR_ENV") == "1" and os.environ.get("HERDR_PANE_ID") and shutil.which("herdr")):
        raise RuntimeError("interactive child stages require Pi inside Herdr")
    split = subprocess.run(["herdr", "pane", "split", "--current", "--direction", "down", "--cwd", str(Path.cwd()), "--no-focus"], text=True, capture_output=True, check=True)
    try:
        pane_id = json.loads(split.stdout)["result"]["pane"]["pane_id"]
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Herdr did not return a child pane id") from exc
    marker = f"__WORKFLOW_SKILLS_STAGE_DONE_{uuid.uuid4().hex}__"
    octal_marker = "".join(f"\\{byte:03o}" for byte in marker.encode())
    env = " ".join(f"{key}={shlex.quote(value)}" for key, value in environment.items())
    script = f"env {env} {' '.join(shlex.quote(part) for part in command)}; set code $status; printf '\\n{octal_marker}%s\\n' \"$code\""
    try:
        subprocess.run(["herdr", "pane", "run", pane_id, f"fish -c {shlex.quote(script)}"], text=True, capture_output=True, check=True)
        subprocess.run(["herdr", "pane", "wait-output", pane_id, "--match", marker, "--source", "recent-unwrapped"], text=True, capture_output=True, check=True)
    finally:
        subprocess.run(["herdr", "pane", "close", pane_id], text=True, capture_output=True, check=True)


def main():
    parsed = args()
    _file, _role, model, thinking, routes = WORKFLOW["stages"][parsed.stage]
    pi = shutil.which("pi")
    run_dir = state_root() / f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    handoff = run_dir / "handoff.json"
    extension_path = run_dir / "workflow-handoff.ts"
    command = [pi or "pi", "--extension", str(extension_path), "--model", model, "--thinking", thinking, "--name", f"{WORKFLOW['name']}:{parsed.stage}", "--", child_prompt(parsed.stage, parsed.request, parsed.previous_handoff)]
    if parsed.dry_run:
        print(json.dumps({"stage": parsed.stage, "command": command[:-1] + ["<assembled prompt>"], "handoffPath": str(handoff)}, indent=2))
        return
    if not pi:
        raise SystemExit("Pi executable not found on PATH")
    run_dir.mkdir(parents=True, exist_ok=False)
    extension_path.write_text(extension())
    environment = {"WORKFLOW_SKILLS_HANDOFF_PATH": str(handoff), "WORKFLOW_SKILLS_WORKFLOW": WORKFLOW["name"], "WORKFLOW_SKILLS_STAGE": parsed.stage, "WORKFLOW_SKILLS_ALLOWED_STATUSES": ",".join(routes)}
    try:
        run_child(command, environment)
        result = read_handoff(handoff, parsed.stage)
    except (RuntimeError, subprocess.CalledProcessError, ValueError) as exc:
        raise SystemExit(f"stage {parsed.stage} failed: {exc}") from exc
    print(json.dumps({"handoffPath": str(handoff), "handoff": result}, indent=2))


if __name__ == "__main__":
    main()
