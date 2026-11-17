#!/usr/bin/env python3
"""
Upload evidence files (images/videos) to a GitLab project via the Uploads API.

Usage:
    python3 upload-mr-evidence.py <project_path> <file1> [file2 ...]

Environment:
    GITLAB_TOKEN   GitLab personal access token with api scope (required)
    GITLAB_HOST    GitLab hostname (default: gitlab.agodadev.io)

Output (stdout):
    JSON array: [{"file": "name.png", "markdown": "![alt](https://...)", "absolute_url": "https://..."}]

Exit codes: 0 = success, 1 = error
"""

import json
import mimetypes
import os
import sys
import urllib.parse
from pathlib import Path

import requests


def upload_file(api_base: str, token: str, file_path: Path, gitlab_host: str) -> dict:
    mime_type, _ = mimetypes.guess_type(str(file_path))
    mime_type = mime_type or "application/octet-stream"

    resp = requests.post(
        f"{api_base}/uploads",
        headers={"PRIVATE-TOKEN": token},
        files={"file": (file_path.name, file_path.read_bytes(), mime_type)},
    )
    resp.raise_for_status()
    data = resp.json()

    full_path = data.get("full_path") or data.get("url", "")
    absolute_url = f"https://{gitlab_host}{full_path}"
    markdown = data.get("markdown", f"![{file_path.name}]({absolute_url})")

    # Rewrite relative URL in markdown to absolute so it renders in any context
    relative_url = data.get("url", full_path)
    if relative_url:
        markdown = markdown.replace(f"({relative_url})", f"({absolute_url})")

    return {
        "file": file_path.name,
        "markdown": markdown,
        "absolute_url": absolute_url,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: upload-mr-evidence.py <project_path> <file1> [file2 ...]", file=sys.stderr)
        sys.exit(1)

    project = sys.argv[1]
    file_paths = sys.argv[2:]

    gitlab_host = os.environ.get("GITLAB_HOST", "gitlab.agodadev.io").strip()
    gitlab_host = gitlab_host.removeprefix("https://").removeprefix("http://").rstrip("/")
    token = os.environ.get("GITLAB_TOKEN", "").strip()
    if not token:
        print("ERROR: GITLAB_TOKEN environment variable is not set", file=sys.stderr)
        sys.exit(1)

    api_base = f"https://{gitlab_host}/api/v4/projects/{urllib.parse.quote(project, safe='')}"

    results = []
    for raw_path in file_paths:
        path = Path(raw_path)
        if not path.is_file():
            print(f"WARNING: Skipping missing file: {raw_path}", file=sys.stderr)
            continue
        print(f"Uploading: {path.name} ...", file=sys.stderr)
        result = upload_file(api_base, token, path, gitlab_host)
        print(f"  -> {result['absolute_url']}", file=sys.stderr)
        results.append(result)

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
