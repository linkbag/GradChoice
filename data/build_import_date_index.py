#!/usr/bin/env python3
"""
build_import_date_index.py — build the date index used to restore the original
timestamps of comments imported from the open-source archives.

Why this exists
---------------
The historical import (backend/seed_external_data.py) stamped every imported comment
with the import date instead of the date the comment was originally posted. The
original dates still exist in the source data, but that data is large (68 MB) and is
gitignored, so a production run cannot read it directly. This script derives a compact
index from the normalized import set and writes it to data/import_dates.csv.gz, which
IS committed, so backend/backfill_import_metadata.py can run from CI.

Provenance
----------
Input: data/normalized/combined.json — the exact deduplicated record set produced by
seed_external_data.py and inserted into the database. It was generated from
https://github.com/pengp25/RateMySupervisor (data/urfire.json, data/comments_data.json)
and the yankong archive.

Date precision
--------------
RateMySupervisor records carry `other_desc_date` with MONTH precision only ("2019-03");
yankong records carry a day ("2019-03-14"). Restoring month-only data as a specific day
would invent information, which is why the UI renders imported comments without a day.

Usage (only needed when the source data changes):
    python data/build_import_date_index.py
"""
import csv
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
SOURCE = ROOT / "data" / "normalized" / "combined.json"
OUTPUT = ROOT / "data" / "import_dates.csv.gz"


def description_hash(description: str) -> str:
    """Key for matching a database comment back to its source record.

    The importer stored `description + attribution suffix`, so the runner strips the
    suffix and hashes what remains. Normalising whitespace keeps the match stable
    across the HTML-cleanup differences between import runs.
    """
    normalized = " ".join(description.split())
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def main() -> None:
    records = json.loads(SOURCE.read_text(encoding="utf-8"))
    print(f"loaded {len(records):,} records from {SOURCE.relative_to(ROOT)}")

    # A description can legitimately appear under several supervisors, occasionally
    # with different months. Keep the most common date, tie-broken by the earliest,
    # so the restored value is the one most likely to be the original post.
    candidates: dict[str, Counter] = defaultdict(Counter)
    sources: Counter = Counter()
    for record in records:
        date = (record.get("date") or "").strip()
        description = record.get("description") or ""
        if not date or not description:
            continue
        candidates[description_hash(description)][date] += 1
        sources[record.get("source") or "unknown"] += 1

    rows = []
    ambiguous = 0
    for digest, counter in candidates.items():
        if len(counter) > 1:
            ambiguous += 1
        date = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        rows.append((digest, date))
    rows.sort()

    with gzip.open(OUTPUT, "wt", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["description_md5", "original_date"])
        writer.writerows(rows)

    by_precision = Counter("month" if len(d.split("-")) == 2 else "day" for _, d in rows)
    print(f"wrote {len(rows):,} entries to {OUTPUT.relative_to(ROOT)} "
          f"({OUTPUT.stat().st_size / 1024:.0f} KB gz)")
    print(f"  sources: {dict(sources)}")
    print(f"  precision: {dict(by_precision)}")
    print(f"  descriptions seen with conflicting dates: {ambiguous:,}")


if __name__ == "__main__":
    main()
