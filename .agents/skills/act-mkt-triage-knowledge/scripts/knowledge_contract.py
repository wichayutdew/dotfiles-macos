#!/usr/bin/env python3
"""Build stable Hindsight identities and check publication readback (stdlib only).

This helper never connects to a service or writes files. Structural readback
checks supplement, rather than replace, independent source-grounding review.
"""
import argparse
import json
import re
import sys
from urllib.parse import quote

HEADINGS = ("Symptoms", "How it works", "Diagnosis", "Known resolutions", "Unresolved questions", "Evidence")


def text(value, label):
    if not isinstance(value, str) or not value.strip() or any(ord(c) < 32 for c in value):
        raise ValueError(f"{label} must be nonempty text without control characters")
    return value.strip()


def tags(feature):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", feature):
        raise ValueError("feature must be a lowercase kebab-case identifier")
    return ["triage", f"feature:{feature}"]


def identity(profile, channel, message_ts):
    profile = text(profile, "profile")
    if not re.fullmatch(r"[A-Z0-9]+", channel) or not re.fullmatch(r"\d{10,}\.\d{6}", message_ts):
        raise ValueError("expected Slack channel ID and root timestamp (seconds.microseconds)")
    return {"documentId": f"triage:{quote(profile, safe='')}:{channel}:{message_ts}",
            "profileTag": f"support-profile:{profile}"}


def page_query(feature, name):
    scoped_tags = tags(feature)
    name = text(name, "name")
    query = (
        f"Maintain the support troubleshooting knowledge document for feature {json.dumps(name)} "
        f"(feature identifier {feature}) in the authenticated team bank. "
        "Use only the source memories in this page's strict triage and feature tag scope, including relevant profiles in this bank. "
        "A retained ticket can discuss several features: include only facts about this feature, "
        "not another feature's symptoms, diagnosis or resolutions. Mention a neighboring feature "
        "only to explain a source-backed dependency or a warning against applying its fix here. "
        "Write the following level-two sections in order: " + ", ".join(HEADINGS) + ". "
        "Include recognizable symptoms and alternative search terms, relevant behavior and ownership, "
        "diagnostic checks, confirmed resolutions with prerequisites and limitations, and unresolved gaps. "
        "Preserve source links, incident dates, verification dates, environment/version conditions and "
        "the distinction between confirmed findings and unconfirmed hypotheses. "
        "Attribute a hypothesis to automation or a person only when the sources establish that origin; "
        "otherwise leave its origin unspecified. "
        "Preserve the exact scope of source-backed actions and their conditions. "
        "Do not invent operational actions, alternatives, prerequisites or diagnostic ordering; "
        "unsupported procedures remain unresolved. "
        "Expand the original source chunks/documents to recover literal source URLs and caveats "
        "when consolidated observations omit them. Put those source URLs in Evidence. "
        "Keep conflicting evidence explicit; qualify or supersede outdated guidance with dated sources. "
        "Do not turn one incident's fix into a universal rule. Do not invent a resolution or verification. "
        "Include evidence from every relevant retained ticket, without unrelated curator or feature history. "
        "Use 'Not established by the sources' for an unsupported section. "
        "This is a feature guide, not a chronological sprint report, ledger or ticket archive."
    )
    return {"tags": scoped_tags, "sourceQuery": query}


def string_list(value, label, nonempty=False):
    if not isinstance(value, list) or (nonempty and not value):
        raise ValueError(f"{label} must be {'a nonempty' if nonempty else 'an'} array")
    return [text(item, label) for item in value]


def check_page(feature, data):
    if not isinstance(data, dict):
        raise ValueError("readback must be a JSON object")
    expected_tags = tags(feature)
    actual_tags = string_list(data.get("pageTags"), "pageTags", nonempty=True)
    # Extra namespace/profile/feature tags change the canonical feature scope.
    if set(actual_tags) != set(expected_tags):
        raise ValueError("page tags do not exactly match the verified triage and feature scope")
    parent = text(data.get("parentId"), "parentId")
    if parent != text(data.get("expectedParentId"), "expectedParentId"):
        raise ValueError("page is outside the verified triage folder")
    markdown = data.get("markdown")
    if not isinstance(markdown, str) or not markdown.strip():
        raise ValueError("page markdown is empty or not readable")
    positions, body_starts = [], []
    for heading in HEADINGS:
        matches = list(re.finditer(r"(?m)^## " + re.escape(heading) + r"[ \t]*$", markdown))
        if len(matches) != 1:
            raise ValueError(f"expected exactly one section: {heading}")
        positions.append(matches[0].start())
        body_starts.append(matches[0].end())
    if positions != sorted(positions):
        raise ValueError("knowledge sections are out of order")
    for index, position in enumerate(positions):
        end = positions[index + 1] if index + 1 < len(positions) else len(markdown)
        if not markdown[body_starts[index]:end].strip():
            raise ValueError(f"empty knowledge section: {HEADINGS[index]}")
    links = string_list(data.get("sourceLinks"), "sourceLinks", nonempty=True)
    terms = string_list(data.get("requiredTerms"), "requiredTerms")
    for link in links:
        if not link.startswith("https://") or link not in markdown:
            raise ValueError(f"missing or invalid required source link: {link}")
    for term in terms:
        if term.casefold() not in markdown.casefold():
            raise ValueError(f"missing required evidence condition or caveat: {term}")
    return {"ok": True, "sourceLinksChecked": len(links), "requiredTermsChecked": len(terms),
            "limitation": "Structural checks passed; independent semantic source verification is still required."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("identity", "page-query", "check-page"):
        command = commands.add_parser(name)
        if name == "identity":
            command.add_argument("--profile", required=True)
            command.add_argument("--channel", required=True)
            command.add_argument("--message-ts", required=True)
        else:
            command.add_argument("--feature", required=True)
        if name == "page-query":
            command.add_argument("--name", required=True)
    args = parser.parse_args()
    try:
        if args.command == "identity":
            result = identity(args.profile, args.channel, args.message_ts)
        elif args.command == "page-query":
            result = page_query(args.feature, args.name)
        else:
            result = check_page(args.feature, json.load(sys.stdin))
    except (ValueError, TypeError) as error:
        print(f"BLOCKED: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
