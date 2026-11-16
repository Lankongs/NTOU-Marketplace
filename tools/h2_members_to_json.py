"""Convert an offline H2 CSVWRITE export to MongoDB Extended JSON (no DB access)."""
import csv
import json
import re
import sys
from pathlib import Path


def convert(source, destination):
    rows = []
    ids, accounts = set(), set()
    with Path(source).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ["ID", "ACCOUNT", "DISPLAY_NAME", "PASSWORD_HASH"]:
            raise ValueError("Expected H2 columns ID,ACCOUNT,DISPLAY_NAME,PASSWORD_HASH in that order")
        for line, row in enumerate(reader, 2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"Invalid CSV row at line {line}")
            member_id = int(row["ID"])
            if not 0 < member_id < 2**63 - 1 or member_id in ids:
                raise ValueError(f"Invalid or duplicate ID at line {line}")
            account, name, password_hash = row["ACCOUNT"], row["DISPLAY_NAME"], row["PASSWORD_HASH"]
            if not account or len(account) > 100 or account in accounts or len(name) > 100:
                raise ValueError(f"Invalid or duplicate member fields at line {line}")
            if not re.fullmatch(r"\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}", password_hash):
                raise ValueError(f"Invalid BCrypt hash at line {line}")
            ids.add(member_id)
            accounts.add(account)
            rows.append({"_id": {"$numberLong": str(member_id)}, "account": account,
                         "displayName": name, "passwordHash": password_hash})
    # Validate all records before creating output; never overwrite an existing export.
    with Path(destination).open("x", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(rows)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python tools/h2_members_to_json.py members.csv members.jsonl")
    try:
        count = convert(sys.argv[1], sys.argv[2])
    except (ValueError, OSError) as error:
        sys.exit(str(error))
    print(f"Converted {count} members. Verify counts and seed the MongoDB counter before startup.")
