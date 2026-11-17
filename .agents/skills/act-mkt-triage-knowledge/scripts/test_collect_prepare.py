"""Behavior checks for portable OpsBot collection; all network data is synthetic."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("collect_prepare.py")
LINK = "https://example-team.slack.com/archives/C123ABC/p1793577600123456"
DONE_AT = "2026-11-10 14:24:09.061218+07"


class CollectorTests(unittest.TestCase):
    def run_collector(self, args=(), rows=None, raw=None, config=None):
        with tempfile.TemporaryDirectory() as cwd:
            config_args = []
            if config is not None:
                path = Path(cwd) / "team.json"
                path.write_text(json.dumps(config))
                config_args = ["--config", str(path)]
            command = [sys.executable, str(SCRIPT), "--from-stdin", *config_args, *args]
            return subprocess.run(command, cwd=cwd, input=raw if raw is not None else json.dumps({"rows": rows if rows is not None else [{"status": "done", "done_at": DONE_AT, "ticket_link": LINK, "status": "done"}]}), capture_output=True, text=True)

    def base(self):
        return ["--support-profile", "another_team_support", "--channel-id", "C123ABC", "--time-zone", "Asia/Bangkok", "--start", "2026-11-02", "--end", "2026-11-13"]

    def test_bundled_config_from_unrelated_directory(self):
        result = self.run_collector(["--support-profile", "other_team", "--start", "2026-11-02", "--end", "2026-11-13"])
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["opsbot"]["channelId"], "C04SM1C4BNH")
        self.assertEqual(data["opsbot"]["timeZone"], "Asia/Bangkok")
        self.assertEqual(data["apiParameters"]["channelIdList"], "C04SM1C4BNH,-")
        self.assertEqual(data["apiParameters"]["profileIdList"], "other_team")

    def test_config_profile_rejected_even_with_cli_profile(self):
        result = self.run_collector(self.base(), config={"opsbot": {"supportProfile": "stale_team"}})
        self.assertEqual(result.returncode, 2)
        self.assertIn("supportProfile", result.stderr)
        self.assertEqual(result.stdout, "")

    def test_config_cannot_supply_required_invocation_profile(self):
        config = {"opsbot": {"supportProfile": "stale_team", "channelId": "C123ABC", "timeZone": "UTC"}}
        result = self.run_collector(["--start", "2026-11-02", "--end", "2026-11-13"], config=config)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")

    def test_explicit_config_requires_valid_persisted_channel(self):
        for channel in (None, "", "C123,-"):
            config = {"opsbot": {"timeZone": "Asia/Bangkok"}}
            if channel is not None:
                config["opsbot"]["channelId"] = channel
            result = self.run_collector(["--support-profile", "team", "--start", "2026-11-02", "--end", "2026-11-13"], config=config)
            self.assertEqual(result.returncode, 2)
            self.assertIn("channelId", result.stderr)

    def test_other_team_from_unrelated_directory(self):
        result = self.run_collector(self.base())
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["opsbot"]["supportProfile"], "another_team_support")
        self.assertEqual(data["apiParameters"]["profileIdList"], "another_team_support")
        self.assertEqual(data["tickets"][0]["sourceRow"]["status"], "done")
        self.assertEqual(data["tickets"][0]["messageTs"], "1793577600.123456")

    def test_dates_are_inclusive_in_local_timezone(self):
        result = self.run_collector(self.base())
        self.assertEqual(result.returncode, 0, result.stderr)
        interval = json.loads(result.stdout)["interval"]
        self.assertEqual(interval["startUtc"], "2026-11-01T17:00:00.000Z")
        self.assertEqual(interval["endUtc"], "2026-11-13T16:59:59.999999Z")

    def test_dst_interval_uses_local_midnights(self):
        args = self.base() + ["--time-zone", "America/New_York", "--start", "2026-11-01", "--end", "2026-11-01"]
        result = self.run_collector(args, rows=[{"status": "done", "done_at": "2026-11-01T12:00:00-05:00", "ticket_link": LINK}])
        self.assertEqual(result.returncode, 0, result.stderr)
        interval = json.loads(result.stdout)["interval"]
        self.assertEqual(interval["startUtc"], "2026-11-01T04:00:00.000Z")
        self.assertEqual(interval["endUtc"], "2026-11-02T04:59:59.999999Z")

    def test_missing_identity_is_blocked(self):
        result = self.run_collector(["--start", "2026-11-02", "--end", "2026-11-13"])
        self.assertEqual(result.returncode, 2)
        self.assertIn("support", result.stderr.lower())
        self.assertEqual(result.stdout, "")

    def test_missing_dates_are_blocked(self):
        result = self.run_collector(self.base()[:-4])
        self.assertEqual(result.returncode, 2)

    def test_duplicate_url_variants_share_thread_identity(self):
        rows = [{"status": "done", "done_at": DONE_AT, "ticket_link": LINK, "source": 1}, {"status": "done", "done_at": DONE_AT, "ticket_link": LINK + "?thread_ts=1793577600.123456&cid=C123ABC", "source": 2}]
        result = self.run_collector(self.base(), rows=rows)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["counts"]["sourceRows"], 2)
        self.assertEqual(data["counts"]["duplicateLinks"], 1)
        self.assertEqual(data["counts"]["selectedLinks"], 1)
        self.assertEqual(data["tickets"][0]["sourceRows"], rows)
        self.assertEqual(data["tickets"][0]["sourceRow"], rows[0])

    def test_non_slack_or_credential_links_are_blocked(self):
        for url in [LINK.replace("example-team.slack.com", "evil.example"), LINK.replace("https:", "http:"), LINK.replace("example-team.slack.com", "example-team.slack.com.evil.example"), LINK.replace("https://", "https://secret@"), LINK + "/extra"]:
            with self.subTest(url=url):
                result = self.run_collector(self.base(), rows=[{"status": "done", "done_at": DONE_AT, "ticket_link": url}])
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("secret", result.stderr)

    def test_short_timestamp_is_blocked(self):
        result = self.run_collector(self.base(), rows=[{"status": "done", "done_at": DONE_AT, "ticket_link": LINK.replace("1793577600123456", "1234567")}])
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")

    def test_enterprise_slack_link_is_supported(self):
        result = self.run_collector(self.base(), rows=[{"status": "done", "done_at": DONE_AT, "ticket_link": LINK.replace("example-team.slack.com", "booking.enterprise.slack.com")}])
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_malformed_rows_fail_without_tracebacks_or_source_dump(self):
        for raw in ['{"rows":{}}', '{"rows":[null]}', '{"rows":[{"status": "done", "done_at": DONE_AT, "ticket_link":"secret"}]}', '[]', 'not json']:
            with self.subTest(raw=raw):
                result = self.run_collector(self.base(), raw=raw)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("Traceback", result.stderr)
                self.assertNotIn("secret", result.stderr)

    def test_invalid_dates_and_timezone_are_blocked(self):
        for extra in [["--start", "2026-11-14"], ["--end", "2026-02-30"], ["--time-zone", "Mars/Olympus"]]:
            with self.subTest(extra=extra):
                result = self.run_collector(self.base() + extra)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("Traceback", result.stderr)

    def test_explicit_json_config_and_cli_override(self):
        config = {"opsbot": {"channelId": "C123ABC", "timeZone": "UTC", "ticketStatuses": ["done"], "includeAllUnclosed": False, "user": "all"}}
        result = self.run_collector(["--start", "2026-11-02", "--end", "2026-11-13", "--support-profile", "team_override"], config=config)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["opsbot"]["supportProfile"], "team_override")
        self.assertFalse(data["opsbot"]["includeAllUnclosed"])
        self.assertEqual(data["apiParameters"]["ticketStatusList"], "done")

    def test_wrong_config_types_are_blocked(self):
        for change in [{"includeAllUnclosed": "false"}, {"ticketStatuses": "done"}, {"ticketStatuses": []}, {"ticketStatuses": [1]}, {"supportProfile": ["team"]}, {"timeZone": 1}, {"channelId": "C123ABC,-"}]:
            with self.subTest(change=change):
                config = {"opsbot": {"channelId": "C123ABC", "timeZone": "UTC", **change}}
                result = self.run_collector(["--support-profile", "team", "--start", "2026-11-02", "--end", "2026-11-13"], config=config)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("Traceback", result.stderr)

    def test_config_rejects_unsupported_keys_without_echoing_values(self):
        result = self.run_collector(self.base(), config={"opsbot": {"token": "private-token-value"}})
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("private-token-value", result.stderr + result.stdout)

    def test_endpoint_credentials_are_rejected_without_echoing_them(self):
        result = self.run_collector(self.base() + ["--dataset-endpoint", "https://secret:password@opsbot.example/api"])
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("password", result.stderr)
        self.assertNotIn("secret", result.stderr)

    def test_done_filter_uses_completion_not_creation(self):
        old = {"status": "done", "created_at": "2026-10-12 09:10:29.364684+07", "done_at": DONE_AT, "ticket_link": LINK}
        newly_opened = {"status": "done", "created_at": "2026-11-03T12:00:00+07:00", "done_at": "2026-11-14T12:00:00+07:00", "ticket_link": LINK.replace("123456", "123457")}
        unclosed = {"status": "open", "created_at": "2026-11-03T12:00:00+07:00", "done_at": None, "ticket_link": LINK.replace("123456", "123458")}
        rows = [old, newly_opened, unclosed]
        result = self.run_collector(self.base(), rows=rows)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual([t["sourceRow"] for t in data["tickets"]], [old])
        self.assertEqual(data["sourceRows"], rows)
        self.assertEqual(data["counts"]["excludedRows"], 2)
        self.assertEqual(data["counts"]["notDone"], 1)
        self.assertEqual(data["counts"]["outsideInterval"], 1)
        self.assertEqual(data["selection"]["completionField"], "done_at")
        self.assertEqual(data["apiParameters"]["includeAllUnclosed"], "0")
        self.assertEqual(data["apiParameters"]["ticketStatusList"], "done")

    def test_full_precision_half_open_completion_boundaries(self):
        completion_times = ["2026-11-01T23:59:59.999999+07:00", "2026-11-02T00:00:00+07:00", "2026-11-13T23:59:59.999999+07:00", "2026-11-14T00:00:00+07:00"]
        rows = [{"ticket_link": LINK.replace("123456", f"12345{index}"), "status": "done", "done_at": value} for index, value in enumerate(completion_times)]
        result = self.run_collector(self.base(), rows=rows)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual([t["sourceRow"]["done_at"] for t in data["tickets"]], completion_times[1:3])
        self.assertEqual(data["interval"]["endExclusiveUtc"], "2026-11-13T17:00:00.000Z")
        self.assertEqual(data["apiParameters"]["endDate"], data["interval"]["endExclusiveUtc"])

    def test_missing_invalid_or_naive_done_timestamp_blocks_coverage(self):
        for value in [None, "", "not-a-date", "2026-11-10 14:24:09.061218", 123]:
            with self.subTest(value=value):
                result = self.run_collector(self.base(), rows=[{"ticket_link": LINK, "status": "done", "done_at": value}])
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertIn("done_at", result.stderr)
                self.assertNotIn("Traceback", result.stderr)
        result = self.run_collector(self.base(), rows=[{"ticket_link": LINK, "status": "done"}])
        self.assertEqual(result.returncode, 2)

    def test_incompatible_status_and_unclosed_overrides_are_rejected(self):
        for extra in [["--ticket-status", "open"], ["--ticket-status", "done", "--ticket-status", "open"], ["--include-all-unclosed"]]:
            with self.subTest(extra=extra):
                result = self.run_collector(self.base() + extra)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
        for change in [{"ticketStatuses": ["done", "open"]}, {"includeAllUnclosed": True}]:
            result = self.run_collector(self.base(), config={"opsbot": change})
            self.assertEqual(result.returncode, 2)

    def test_missing_or_invalid_status_blocks_coverage(self):
        for status in [None, "", 1]:
            result = self.run_collector(self.base(), rows=[{"ticket_link": LINK, "status": status, "done_at": DONE_AT}])
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, "")

    def test_empty_rows_succeed(self):
        result = self.run_collector(self.base(), rows=[])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["tickets"], [])


if __name__ == "__main__":
    unittest.main()
