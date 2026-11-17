#!/usr/bin/env python3
"""Build stable Hindsight identities and check publication readback (stdlib only).

This helper never connects to a service or writes files. Structural readback
checks supplement, rather than replace, independent source-grounding review.
"""
import argparse
import json
import re
import sys

HEADINGS = ("Symptoms", "How it works", "Diagnosis", "Known resolutions", "Unresolved questions", "Evidence")


def text(value, label):
    if not isinstance(value, str) or not value.strip() or any(ord(c) < 32 for c in value):
        raise ValueError(f"{label} must be nonempty text without control characters")
    return value.strip()


def tags(feature):
    if not isinstance(feature, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", feature):
        raise ValueError("feature must be a lowercase kebab-case identifier")
    return ["oncall", f"feature:{feature}"]


def positive_id(value, label):
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not re.fullmatch(r"[1-9][0-9]*", str(value)):
        raise ValueError(f"{label} must be a positive integer")
    return str(int(value))


def identity(rotation, esc_id):
    rotation = positive_id(rotation, "rotation")
    esc_id = positive_id(esc_id, "esc_id")
    return {"documentId": f"oncall:{rotation}:{esc_id}", "rotationTag": f"rotation-id:{rotation}"}


def page_query(feature, name):
    scoped_tags = tags(feature)
    name = text(name, "name")
    query = (
        f"Maintain the oncall troubleshooting feature guide for {json.dumps(name)} (feature identifier {feature}). "
        "Use only this page's strict oncall and feature tag scope in the authenticated team bank. "
        "Relevant evidence from multiple rotations can contribute. A retained escalation may discuss several features: "
        "include only this feature's findings; mention another feature only for a source-backed dependency or warning "
        "against applying its fix here. Write these level-two headings once in order: " + ", ".join(HEADINGS) + ". "
        "Preserve recognizable symptoms, alternative search terms, source-backed behavior and ownership, diagnostic "
        "checks, confirmed resolutions with prerequisites/limitations, unresolved hypotheses and contradictions. "
        "Preserve exact source-supported remediation verbs; never add alternative actions or treat different operations as equivalent. "
        "For example, draining a queue does not establish that clearing or purging it is safe or effective. "
        "Preserve hypothesis attribution and uncertainty; do not infer who proposed or rejected it, or claim a hypothesis was tested or ruled out. "
        "Escalation status alone proves no diagnosis or repair. Preserve source URLs, incident dates, verification "
        "dates, environment/version conditions and explicit uncertainty. Expand original source chunks to recover "
        "literal URLs and caveats omitted from observations; cite them in Evidence. Qualify or supersede outdated "
        "guidance with dated evidence, preserving still-valid history. Never invent a resolution or verification. "
        "Use 'Not established by the sources' for unsupported sections. Include every relevant retained source, "
        "without triage-only or unrelated feature history. This is a feature guide, not a sprint report or archive."
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
        raise ValueError("page tags do not exactly match the verified oncall and feature scope")
    parent = text(data.get("parentId"), "parentId")
    if parent != text(data.get("expectedParentId"), "expectedParentId"):
        raise ValueError("page is outside the verified oncall folder")
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
    command = commands.add_parser("identity")
    command.add_argument("--rotation-id", required=True)
    command.add_argument("--esc-id", required=True)
    for name in ("page-query", "check-page"):
        command = commands.add_parser(name)
        command.add_argument("--feature", required=True)
        if name == "page-query":
            command.add_argument("--name", required=True)
    args = parser.parse_args()
    try:
        if args.command == "identity":
            result = identity(args.rotation_id, args.esc_id)
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
