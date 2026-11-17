"""Exercise the public CLI used to build and check Hindsight publications."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("knowledge_contract.py")
HEADINGS = ["Symptoms", "How it works", "Diagnosis", "Known resolutions", "Unresolved questions", "Evidence"]


class KnowledgeContractTests(unittest.TestCase):
    def run_cli(self, *args, data=None):
        return subprocess.run([sys.executable, str(SCRIPT), *args], input=json.dumps(data) if data is not None else None,
                              text=True, capture_output=True, cwd=tempfile.gettempdir())

    def page(self):
        return {"markdown": "\n".join("## " + h + "\n" + (
            "Unconfirmed automated diagnosis; needs human verification." if h == "Unresolved questions" else
            "https://agoda.slack.com/archives/C123/p1790000000123456" if h == "Evidence" else "Source-backed description.") for h in HEADINGS),
            "sourceLinks": ["https://agoda.slack.com/archives/C123/p1790000000123456"],
            "requiredTerms": ["Unconfirmed automated diagnosis"],
            "pageTags": ["triage", "feature:campaign-approval"],
            "parentId": "kf-triage", "expectedParentId": "kf-triage"}

    def check(self, data):
        return self.run_cli("check-page", "--feature", "campaign-approval", data=data)

    def test_ticket_identity_is_stable_and_profile_scoped(self):
        args = ("identity", "--profile", "other_team", "--channel", "C123", "--message-ts", "1790000000.123456")
        first, second = self.run_cli(*args), self.run_cli(*args)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(json.loads(first.stdout)["documentId"], "triage:other_team:C123:1790000000.123456")
        different = self.run_cli(*args[:2], "another_team", *args[3:])
        self.assertNotEqual(first.stdout, different.stdout)

    def test_profile_delimiters_do_not_collide_in_identity(self):
        result = self.run_cli("identity", "--profile", "team:one", "--channel", "C123", "--message-ts", "1790000000.123456")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("team%3Aone", json.loads(result.stdout)["documentId"])

    def test_query_scopes_source_memories_and_preserves_uncertainty(self):
        result = self.run_cli("page-query", "--feature", "campaign-approval", "--name", "Campaign approval")
        self.assertEqual(result.returncode, 0, result.stderr)
        obj = json.loads(result.stdout)
        self.assertEqual(obj["tags"], ["triage", "feature:campaign-approval"])
        for heading in HEADINGS:
            self.assertIn(heading, obj["sourceQuery"])
        self.assertNotIn("strict profile", obj["sourceQuery"])
        self.assertIn("unconfirmed", obj["sourceQuery"])
        self.assertIn("source links", obj["sourceQuery"])

    def test_query_preserves_attribution_and_exact_operational_scope(self):
        result = self.run_cli("page-query", "--feature", "campaign-approval", "--name", "Campaign approval")
        self.assertEqual(result.returncode, 0, result.stderr)
        query = json.loads(result.stdout)["sourceQuery"]
        self.assertIn("Attribute a hypothesis to automation or a person only when the sources establish that origin", query)
        self.assertIn("Do not invent operational actions, alternatives, prerequisites or diagnostic ordering", query)
        self.assertNotIn("unconfirmed automated hypotheses", query)

    def test_profiles_keep_distinct_evidence_in_one_canonical_feature(self):
        sources = [self.run_cli("identity", "--profile", profile, "--channel", "C123", "--message-ts", "1790000000.123456") for profile in ("team_one", "team_two")]
        self.assertTrue(all(result.returncode == 0 for result in sources))
        self.assertNotEqual(json.loads(sources[0].stdout)["documentId"], json.loads(sources[1].stdout)["documentId"])
        page = self.run_cli("page-query", "--feature", "campaign-approval", "--name", "Campaign approval")
        self.assertEqual(json.loads(page.stdout)["tags"], ["triage", "feature:campaign-approval"])
        self.assertNotIn("support-profile:", page.stdout)

    def test_other_curator_or_feature_page_rejected(self):
        for tags in (["oncall", "feature:campaign-approval"], ["triage", "feature:other"], ["triage", "feature:campaign-approval", "feature:other"]):
            with self.subTest(tags=tags):
                data = self.page(); data["pageTags"] = tags
                self.assertEqual(self.check(data).returncode, 2)

    def test_invalid_feature_slug_rejected(self):
        result = self.run_cli("page-query", "--feature", "../another-profile", "--name", "Wrong")
        self.assertEqual(result.returncode, 2)

    def test_complete_readback_passes(self):
        result = self.check(self.page())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["ok"])

    def test_missing_section_link_or_uncertainty_fails(self):
        for token in ("## Diagnosis", self.page()["sourceLinks"][0], self.page()["requiredTerms"][0]):
            with self.subTest(token=token):
                data = self.page(); data["markdown"] = data["markdown"].replace(token, "omitted")
                self.assertEqual(self.check(data).returncode, 2)

    def test_profile_scoped_page_rejected(self):
        data = self.page(); data["pageTags"].append("support-profile:activities_marketing_triage")
        self.assertEqual(self.check(data).returncode, 2)

    def test_wrong_folder_or_missing_folder_proof_rejected(self):
        data = self.page(); data["parentId"] = "kf-other"
        self.assertEqual(self.check(data).returncode, 2)
        data.pop("expectedParentId")
        self.assertEqual(self.check(data).returncode, 2)

    def test_empty_evidence_or_malformed_readback_rejected(self):
        data = self.page(); data["sourceLinks"] = []
        self.assertEqual(self.check(data).returncode, 2)
        self.assertEqual(self.check([]).returncode, 2)

    def test_empty_final_section_without_newline_rejected(self):
        data = self.page()
        link = data["sourceLinks"][0]
        data["markdown"] = data["markdown"].replace("## Symptoms\n", "## Symptoms\n" + link + "\n")
        data["markdown"] = data["markdown"].split("## Evidence")[0] + "## Evidence"
        self.assertEqual(self.check(data).returncode, 2)


if __name__ == "__main__":
    unittest.main()
