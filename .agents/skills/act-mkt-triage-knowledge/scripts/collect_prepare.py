#!/usr/bin/env python3
"""Collect an explicit support profile's completed OpsBot tickets.

The bundled configuration persists the channel and common transport settings.
--from-stdin consumes an OpsBot response for offline verification.
Exit codes: 0 complete, 2 blocked input/schema/persistent failure, 3 transient failure.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
CHANNEL_RE = re.compile(r"[CG][A-Z0-9]+")
PROFILE_RE = re.compile(r"[A-Za-z0-9_-]+")
LINK_PATH_RE = re.compile(r"/archives/([CG][A-Z0-9]+)/p(\d{16,})/?")
SLACK_HOST_RE = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+slack\.com")
DEFAULTS = {
    "datasetEndpoint": "https://opsbot.agodadev.io/api/ticket_insight/dataset",
    "ticketStatuses": ["done"], "includeAllUnclosed": False, "user": "all",
}


def die(kind, message, code=2):
    print(f"{kind}: {message}", file=sys.stderr)
    raise SystemExit(code)


def utc(value):
    value = value.astimezone(timezone.utc)
    precision = "microseconds" if value.microsecond % 1000 else "milliseconds"
    return value.isoformat(timespec=precision).replace("+00:00", "Z")


def configuration(args):
    values = dict(DEFAULTS)
    if args.config:
        try:
            config = json.loads(Path(args.config).read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            die("BLOCKED", "cannot read --config as JSON")
        if not isinstance(config, dict) or not isinstance(config.get("opsbot"), dict):
            die("BLOCKED", "--config must contain an opsbot object")
        if "supportProfile" in config["opsbot"]:
            die("BLOCKED", "supportProfile must come from --support-profile, not configuration")
        allowed = set(DEFAULTS) | {"channelId", "timeZone"}
        if set(config["opsbot"]) - allowed:
            die("BLOCKED", "unsupported opsbot configuration fields; configure authentication through the runtime")
        values.update(config["opsbot"])
    overrides = {
        "supportProfile": args.support_profile, "channelId": args.channel_id,
        "timeZone": args.time_zone, "datasetEndpoint": args.dataset_endpoint,
        "ticketStatuses": args.ticket_status, "includeAllUnclosed": args.include_all_unclosed,
        "user": args.user,
    }
    values.update({key: value for key, value in overrides.items() if value is not None})
    for field in ("supportProfile", "channelId", "timeZone", "datasetEndpoint", "user"):
        if not isinstance(values.get(field), str) or not values[field].strip():
            die("BLOCKED", f"explicit nonempty {field} is required through CLI or --config")
    if not PROFILE_RE.fullmatch(values["supportProfile"]):
        die("BLOCKED", "supportProfile must be a single profile ID (letters, digits, underscores or hyphens)")
    if not CHANNEL_RE.fullmatch(values["channelId"]):
        die("BLOCKED", "channelId must be a single Slack channel ID")
    statuses = values["ticketStatuses"]
    if not isinstance(statuses, list) or not statuses or any(not isinstance(item, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", item) for item in statuses):
        die("BLOCKED", "ticketStatuses must be a nonempty list of status names")
    if statuses != ["done"]:
        die("BLOCKED", "ticketStatuses must be exactly [done] for completion-based triage")
    if type(values["includeAllUnclosed"]) is not bool:
        die("BLOCKED", "includeAllUnclosed must be a boolean")
    if values["includeAllUnclosed"]:
        die("BLOCKED", "includeAllUnclosed must be false for completion-based triage")
    try:
        endpoint = urlparse(values["datasetEndpoint"])
        if endpoint.scheme != "https" or not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
            raise ValueError()
        endpoint.port  # Validate the URL's optional port without printing it.
    except ValueError:
        die("BLOCKED", "datasetEndpoint must be an absolute HTTPS URL without credentials, query or fragment")
    return values


def interval(start, end, zone):
    if not (DATE_RE.fullmatch(start) and DATE_RE.fullmatch(end)) or start > end:
        die("BLOCKED", "dates must be YYYY-MM-DD with start <= end")
    try:
        tz = ZoneInfo(zone)
    except (ValueError, ZoneInfoNotFoundError):
        die("BLOCKED", "timeZone must name an available IANA time zone")
    try:
        first = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=tz)
        exclusive = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=tz) + timedelta(days=1)
        last = exclusive - timedelta(microseconds=1)
    except (ValueError, OverflowError):
        die("BLOCKED", "dates must be valid calendar dates")
    return {"startLocalDate": start, "endLocalDate": end, "startUtc": utc(first), "endUtc": utc(last), "endExclusiveUtc": utc(exclusive)}


def fetch_dataset(values, dates):
    params = {
        "channelIdList": f"{values['channelId']},-", "profileIdList": values["supportProfile"],
        "includeAllUnclosed": "1" if values["includeAllUnclosed"] else "0",
        "startDate": dates["startUtc"], "endDate": dates["endExclusiveUtc"],
        "ticketStatusList": ",".join(values["ticketStatuses"]), "user": values["user"],
    }
    return params


def request_dataset(endpoint, params):
    parameter_names = {
        "channelIdList": "channel_id_list", "profileIdList": "profile_id_list",
        "includeAllUnclosed": "include_all_unclosed", "startDate": "start_date",
        "endDate": "end_date", "ticketStatusList": "ticket_status_list", "user": "user",
    }
    command = ["curl", "--silent", "--show-error", "--max-time", "20", "--get", endpoint]
    for key, value in params.items():
        command.extend(["--data-urlencode", f"{parameter_names[key]}={value}"])
    command.extend(["--write-out", "\n%{http_code}"])
    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        die("BLOCKED", "curl is not installed or not on PATH")
    except subprocess.TimeoutExpired:
        die("HANDOFF", "OpsBot request timed out", 3)
    if process.returncode:
        # Curl stderr may contain credential-bearing URLs or proxy information.
        die("HANDOFF", f"OpsBot transport failed (curl exit {process.returncode})", 3)
    body, _, code = process.stdout.rpartition("\n")
    if not re.fullmatch(r"2\d\d", code):
        transient = code == "429" or bool(re.fullmatch(r"5\d\d", code))
        safe_code = code if re.fullmatch(r"\d{3}", code) else "invalid status"
        die("HANDOFF" if transient else "BLOCKED", f"OpsBot HTTP {safe_code}", 3 if transient else 2)
    return body


def completion_timestamp(value, row_number):
    """Require an explicit offset; OpsBot emits PostgreSQL timestamps such as +07."""
    try:
        if not isinstance(value, str) or not value:
            raise ValueError()
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        # Python 3.9 needs PostgreSQL's hour-only offsets expanded, e.g. +07.
        if re.search(r"[+-]\d{2}$", normalized):
            normalized += ":00"
        timestamp = datetime.fromisoformat(normalized)
        if timestamp.tzinfo is None or timestamp.utcoffset() is None:
            raise ValueError()
        return timestamp
    except (ValueError, OverflowError):
        die("BLOCKED", f"source row {row_number} needs a valid timezone-aware done_at to prove interval coverage")


def select_tickets(body, dates):
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeError):
        die("BLOCKED", "OpsBot response is not JSON with a rows array")
    if not isinstance(data, dict) or not isinstance(data.get("rows"), list):
        die("BLOCKED", "OpsBot response is not JSON with a rows array")
    rows = data["rows"]
    tickets, by_identity, excluded = [], {}, []
    first = datetime.fromisoformat(dates["startUtc"].replace("Z", "+00:00"))
    exclusive = datetime.fromisoformat(dates["endExclusiveUtc"].replace("Z", "+00:00"))
    selected_rows = 0
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get("status"), str) or not row["status"].strip():
            die("BLOCKED", f"source row {index + 1} needs a nonempty status to prove interval coverage")
        if row["status"] != "done":
            excluded.append({"sourceRowIndex": index, "reason": "not-done"})
            continue
        completed = completion_timestamp(row.get("done_at"), index + 1)
        if not first <= completed < exclusive:
            excluded.append({"sourceRowIndex": index, "reason": "done-outside-interval"})
            continue
        selected_rows += 1
        link = row.get("ticket_link") if isinstance(row, dict) else None
        try:
            parsed = urlparse(link) if isinstance(link, str) else None
            match = LINK_PATH_RE.fullmatch(parsed.path) if parsed else None
            valid = parsed and parsed.scheme == "https" and not parsed.username and not parsed.password and not parsed.port and SLACK_HOST_RE.fullmatch(parsed.hostname or "") and match
        except ValueError:
            valid = False
        if not valid:
            die("BLOCKED", f"missing/malformed Slack ticket_link in source row {index + 1}")
        channel, digits = match.groups()
        message_ts = f"{digits[:-6]}.{digits[-6:]}"
        identity = (channel, message_ts)
        if identity in by_identity:
            by_identity[identity]["sourceRows"].append(row)
            continue
        ticket = {"ticketLink": link, "sourceRow": row, "sourceRows": [row], "channelId": channel, "messageTs": message_ts}
        tickets.append(ticket)
        by_identity[identity] = ticket
    counts = {
        "sourceRows": len(rows), "selectedRows": selected_rows,
        "duplicateLinks": selected_rows - len(tickets), "selectedLinks": len(tickets),
        "excludedRows": len(excluded),
        "notDone": sum(item["reason"] == "not-done" for item in excluded),
        "outsideInterval": sum(item["reason"] == "done-outside-interval" for item in excluded),
    }
    return rows, tickets, excluded, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--support-profile", required=True, help="explicit support profile from skill invocation")
    parser.add_argument("--channel-id")
    parser.add_argument("--time-zone")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config.json"),
                        help="JSON opsbot settings (defaults to bundled config.json; no supportProfile key)")
    parser.add_argument("--dataset-endpoint")
    parser.add_argument("--ticket-status", action="append", help="must be exactly done; other statuses are rejected")
    parser.add_argument("--include-all-unclosed", action=argparse.BooleanOptionalAction, default=None)
    parser.add_argument("--user")
    parser.add_argument("--from-stdin", action="store_true")
    args = parser.parse_args()
    values = configuration(args)
    dates = interval(args.start, args.end, values["timeZone"])
    params = fetch_dataset(values, dates)
    body = sys.stdin.read() if args.from_stdin else request_dataset(values["datasetEndpoint"], params)
    rows, tickets, excluded, counts = select_tickets(body, dates)
    print(json.dumps({
        "schemaVersion": 2, "opsbot": values, "interval": dates, "apiParameters": params,
        "selection": {"status": "done", "completionField": "done_at", "startInclusiveUtc": dates["startUtc"], "endExclusiveUtc": dates["endExclusiveUtc"], "creationDateFilter": False},
        "counts": counts, "sourceRows": rows, "excludedRows": excluded, "tickets": tickets,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
