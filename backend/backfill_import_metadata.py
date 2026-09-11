#!/usr/bin/env python3
"""
backfill_import_metadata.py — repair the metadata of historically imported comments.

Two problems, both a side effect of the original import (backend/seed_external_data.py):

  1. Attribution points at a repository that no longer exists.
     Every imported comment ends with
     "——此条评论转载自 https://github.com/kgco/RateMySupervisor", but kgco's repo
     returns 404 now. The data actually came from pengp25/RateMySupervisor, which is
     alive and still hosts the exact files that were imported (data/urfire.json,
     data/comments_data.json).

  2. Timestamps are wrong.
     The importer never set created_at, so every imported comment carries the import
     date instead of the date it was originally posted. The source records do carry a
     date: RateMySupervisor has MONTH precision ("2019-03"), yankong has a day. Those
     dates were extracted into data/normalized/combined.json during the import, and
     data/import_dates.csv.gz is the compact index of that mapping (see
     data/build_import_date_index.py).

Comments are matched by hashing their text with the attribution suffix stripped, so
user-edited comments simply do not match and are left alone. Re-running is safe.

Usage:
    python backfill_import_metadata.py --dry-run                  # report only (default)
    python backfill_import_metadata.py --probe                    # run the real UPDATEs, roll back
    python backfill_import_metadata.py --apply                    # attribution + dates
    python backfill_import_metadata.py --attribution --apply      # attribution only
    python backfill_import_metadata.py --dates --apply            # dates only
"""
import argparse
import csv
import gzip
import hashlib
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).parent.parent
INDEX_PATH = ROOT / "data" / "import_dates.csv.gz"

# Present in every imported comment (both the RateMySupervisor and yankong suffixes),
# and therefore our marker for "this row came from the archive".
IMPORT_MARKER = "——此条评论转载自"

OLD_SOURCE_URL = "https://github.com/kgco/RateMySupervisor"
NEW_SOURCE_URL = "https://github.com/pengp25/RateMySupervisor"

BATCH_SIZE = 500

# Anything stamped at/after this is the import run itself rather than a real posting
# date, so counting these tells us whether a backfill has actually been applied.
IMPORT_ERA = datetime(2026, 1, 1, tzinfo=timezone.utc)


def content_hash(text: str) -> str:
    """Hash comment text the same way data/build_import_date_index.py hashes sources."""
    return hashlib.md5(" ".join(text.split()).encode("utf-8")).hexdigest()


def load_date_index() -> dict[str, str]:
    if not INDEX_PATH.exists():
        sys.exit(f"missing date index: {INDEX_PATH}\n"
                 f"run: python data/build_import_date_index.py")
    with gzip.open(INDEX_PATH, "rt", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        return {row["description_md5"]: row["original_date"] for row in reader}


def parse_date(value: str) -> datetime:
    """Source dates are 'YYYY-MM' (month precision) or 'YYYY-MM-DD'.

    Month-only values become the 1st of that month; the UI hides the day for imported
    comments so a month-precision value is never displayed as a specific day.
    """
    parts = value.split("-")
    year, month = int(parts[0]), int(parts[1])
    day = int(parts[2]) if len(parts) > 2 else 1
    return datetime(year, month, day, tzinfo=timezone.utc)


def fetch_imported_rows(cur) -> list[tuple[str, str]]:
    """Return (id, content) for every comment carrying the import attribution."""
    cur.execute(
        "SELECT id::text, content FROM comments WHERE content LIKE %s",
        (f"%{IMPORT_MARKER}%",),
    )
    return cur.fetchall()


def strip_attribution(content: str) -> str:
    """Everything before the attribution marker is the original comment text."""
    return content.split(IMPORT_MARKER)[0].rstrip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL"),
                        help="PostgreSQL connection string (default: $DATABASE_URL)")
    parser.add_argument("--apply", action="store_true",
                        help="write changes (without this the script only reports)")
    parser.add_argument("--dry-run", action="store_true",
                        help="report only, even if --apply is also given")
    parser.add_argument("--probe", action="store_true",
                        help="execute the real UPDATEs and roll back — proves the SQL "
                             "works against the live schema without writing anything")
    parser.add_argument("--attribution", action="store_true", help="fix the source URL")
    parser.add_argument("--dates", action="store_true", help="restore original dates")
    args = parser.parse_args()

    if not args.attribution and not args.dates:
        args.attribution = args.dates = True
    if args.dry_run:
        args.apply = False
    # The updates run for --apply and --probe; only --apply commits.
    execute_writes = args.apply or args.probe
    if not args.db_url:
        sys.exit("no database URL: pass --db-url or set DATABASE_URL")

    if args.probe:
        mode = "PROBE (writes are rolled back)"
    else:
        mode = "APPLY" if args.apply else "DRY RUN (no writes)"
    print("=" * 66)
    print(f"backfill imported comment metadata — {mode}")
    print("=" * 66)

    date_index = load_date_index()
    print(f"date index: {len(date_index):,} entries")

    conn = psycopg2.connect(args.db_url)
    conn.autocommit = False
    cur = conn.cursor()

    rows = fetch_imported_rows(cur)
    print(f"imported comments found: {len(rows):,}")

    # ── 1. Attribution URL ────────────────────────────────────────────────────
    if args.attribution:
        cur.execute(
            "SELECT COUNT(*) FROM comments WHERE content LIKE %s",
            (f"%{OLD_SOURCE_URL}%",),
        )
        stale = cur.fetchone()[0]
        print(f"\nattribution: {stale:,} comments still point at the dead repository")
        if stale:
            if execute_writes:
                cur.execute(
                    "UPDATE comments SET content = REPLACE(content, %s, %s) "
                    "WHERE content LIKE %s",
                    (OLD_SOURCE_URL, NEW_SOURCE_URL, f"%{OLD_SOURCE_URL}%"),
                )
                print(f"  updated: {cur.rowcount:,} rows -> {NEW_SOURCE_URL}")
            else:
                print(f"  would update to: {NEW_SOURCE_URL}")

    # ── 2. Original dates ─────────────────────────────────────────────────────
    if args.dates:
        matched: list[tuple[str, datetime]] = []
        unmatched: list[str] = []
        for comment_id, content in rows:
            date = date_index.get(content_hash(strip_attribution(content)))
            if date:
                matched.append((comment_id, parse_date(date)))
            else:
                unmatched.append(comment_id)

        years = Counter(d.year for _, d in matched)
        print(f"\ndates: {len(matched):,} matched, {len(unmatched):,} unmatched")
        if years:
            print("  restored by year: " + ", ".join(
                f"{y}:{n:,}" for y, n in sorted(years.items())))
            print(f"  range: {min(years)} – {max(years)}")

        # Read back what is stored right now: a dry run after --apply should report 0
        # here, which is how we prove the write actually landed.
        cur.execute(
            "SELECT COUNT(*) FROM comments WHERE content LIKE %s AND created_at >= %s",
            (f"%{IMPORT_MARKER}%", IMPORT_ERA),
        )
        still_import_date = cur.fetchone()[0]
        print(f"  stored created_at still at/after {IMPORT_ERA:%Y-%m-%d} (i.e. not yet "
              f"backfilled): {still_import_date:,} of {len(rows):,}")

        if unmatched:
            print(f"  unmatched (edited or absent from the source set) — left untouched: "
                  f"{', '.join(unmatched[:5])}{' ...' if len(unmatched) > 5 else ''}")

        if execute_writes and matched:
            values = [(cid, dt) for cid, dt in matched]
            for start in range(0, len(values), BATCH_SIZE):
                batch = values[start:start + BATCH_SIZE]
                psycopg2.extras.execute_values(
                    cur,
                    "UPDATE comments AS c SET created_at = v.created_at, "
                    "updated_at = v.created_at "
                    "FROM (VALUES %s) AS v(id, created_at) "
                    "WHERE c.id = v.id::uuid",
                    batch,
                    template="(%s, %s::timestamptz)",
                )
                print(f"  updated {min(start + BATCH_SIZE, len(values)):,}/{len(values):,}")
        elif matched:
            print("  (dry run — no rows written)")

    if args.apply and not args.probe:
        conn.commit()
        print("\ncommitted.")
    else:
        conn.rollback()
        if args.probe:
            print("\nprobe complete — all updates rolled back, nothing was written.")
        else:
            print("\ndry run complete — nothing was written.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
