import csv
import json
import tempfile
import unittest
from pathlib import Path
from h2_members_to_json import convert


class ConversionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "members.csv"
        self.output = Path(self.temp.name) / "members.jsonl"
        self.hash = "$2a$12$" + "a" * 53

    def export(self, rows):
        with self.source.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(["ID", "ACCOUNT", "DISPLAY_NAME", "PASSWORD_HASH"])
            writer.writerows(rows)

    def test_preserves_int64_unicode_and_hash(self):
        self.export([[9007199254740993, "demo", '會員,"名稱"', self.hash]])
        self.assertEqual(1, convert(self.source, self.output))
        row = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertEqual({"$numberLong": "9007199254740993"}, row["_id"])
        self.assertEqual('會員,"名稱"', row["displayName"])
        self.assertEqual(self.hash, row["passwordHash"])
        with self.assertRaises(FileExistsError):
            convert(self.source, self.output)

    def test_rejects_duplicates_before_writing(self):
        self.export([[1, "demo", "name", self.hash], [2, "demo", "name", self.hash]])
        with self.assertRaises(ValueError):
            convert(self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_rejects_plaintext_and_overflow(self):
        for member_id, password in [(1, "plaintext"), (2**63, self.hash)]:
            self.export([[member_id, "demo", "name", password]])
            with self.assertRaises(ValueError):
                convert(self.source, self.output)
            self.assertFalse(self.output.exists())

    def test_empty_export(self):
        self.export([])
        self.assertEqual(0, convert(self.source, self.output))
        self.assertEqual("", self.output.read_text())
