#!/usr/bin/env python3
"""
Lint a Jira ticket draft before pushing to Jira.

Usage:
  python3 lint_jira_ticket.py <ticket.json>
  cat ticket.json | python3 lint_jira_ticket.py

Input JSON format:
  {
    "key": "ACT-1234",
    "fields": {
      "issuetype": {"name": "Story"},
      "description": "## Context\n...",
      "parent": {"key": "ACT-9999"},
      "components": [{"name": "activities-claude-marketplace"}]
    }
  }

Output:
  {"passed": true, "errors": []}
  {"passed": false, "errors": ["description of problem"]}

Exits 0 on success, 1 on failure.
"""

import json
import re
import sys
from typing import Any

REQUIRED_SECTIONS = ["Context", "What Needs to Happen", "Acceptance Criteria"]


def parse_headings(description: str) -> list[tuple[int, str]]:
    """Extract (level, title) pairs from markdown headings."""
    headings = []
    for line in description.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)", line.rstrip())
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            headings.append((level, title))
    return headings


def lint_headings(description: str) -> list[str]:
    errors = []
    headings = parse_headings(description)

    if not headings:
        errors.append("Description has no headings — required sections are missing")
        return errors

    # No h1 allowed
    for level, title in headings:
        if level == 1:
            errors.append(f"H1 heading not allowed: '# {title}' — use ## instead")

    # First heading must be ##
    first_level, first_title = headings[0]
    if first_level != 2:
        errors.append(
            f"First heading must be ## (h2), got '{'#' * first_level} {first_title}'"
        )

    # No level skipping (e.g. ## → #### without ### in between)
    prev_level = None
    for level, title in headings:
        if level == 1:
            prev_level = level
            continue
        if prev_level is not None and level > prev_level + 1:
            errors.append(
                f"Heading level skip: '{'#' * prev_level}' → '{'#' * level} {title}'"
            )
        prev_level = level

    # Required sections present
    heading_titles = {title for _, title in headings}
    for required in REQUIRED_SECTIONS:
        if required not in heading_titles:
            errors.append(f"Required section missing: '{required}'")

    return errors


def lint_ticket(ticket: dict[str, Any]) -> list[str]:
    errors = []
    fields = ticket.get("fields", {})
    issuetype_name = (fields.get("issuetype") or {}).get("name", "")
    is_epic = issuetype_name.lower() == "epic"

    # Heading checks apply to all ticket types
    description = fields.get("description") or ""
    errors.extend(lint_headings(description))

    # Parent + components checks are skipped for Epics
    if not is_epic:
        parent = fields.get("parent")
        if not parent:
            errors.append(
                f"Non-Epic ticket (issuetype: {issuetype_name!r}) must have a parent set"
            )

        components = fields.get("components")
        if not components:
            errors.append(
                f"Non-Epic ticket (issuetype: {issuetype_name!r}) must have at least one component set"
            )

    return errors


def main() -> None:
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            ticket = json.load(f)
    else:
        ticket = json.load(sys.stdin)

    errors = lint_ticket(ticket)
    result = {"passed": len(errors) == 0, "errors": errors}
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
