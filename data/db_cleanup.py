#!/usr/bin/env python3
"""
Purge false-name supervisors from the DB and strip title suffixes.

Steps:
1. Load blocklist.json
2. Delete supervisors whose name is in the explicit blocklist or matches patterns
3. Strip title suffixes from remaining names
4. Detect and merge duplicates after strip
5. Print summary report

All FK children (ratings, comments, edit_proposals, supervisor_rating_cache)
have ON DELETE CASCADE, so deleting supervisors is safe.
"""

import re
import json
import sys
from collections import defaultdict

import psycopg2
import psycopg2.extras

DB_URL = "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"
BLOCKLIST_PATH = "/mnt/d/Startup projects/GradChoice/data/blocklist.json"

# Title suffixes to strip (order matters – longer first)
TITLE_STRIP_PATTERNS = [
    r"[（(].*?[)）]$",         # trailing parenthesised notes
    r"副教授$",
    r"教授$",
    r"研究员$",
    r"副研究员$",
    r"讲师$",
    r"助理教授$",
    r"助理研究员$",
    r"助教$",
    r"副$",                   # trailing 副 after CJK name
]


def load_blocklist():
    with open(BLOCKLIST_PATH, encoding="utf-8") as f:
        return json.load(f)


def name_is_blocked(name, explicit_set, compiled_patterns):
    if name in explicit_set:
        return True
    for pat in compiled_patterns:
        if pat.search(name):
            return True
    return False


def strip_title(name):
    """Strip title suffixes from a name. Returns stripped name."""
    stripped = name.strip()
    for pat in TITLE_STRIP_PATTERNS:
        new = re.sub(pat, "", stripped).strip()
        if new != stripped and len(new) >= 2:
            stripped = new
    return stripped


def main():
    print("Loading blocklist...")
    bl = load_blocklist()
    explicit_set = set(bl["explicit"])
    compiled_patterns = [re.compile(p) for p in bl["patterns"]]

    print(f"  Explicit blocklist: {len(explicit_set)} entries")
    print(f"  Regex patterns: {len(compiled_patterns)}")

    print("\nConnecting to DB...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Step 1: Count before ────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) AS n FROM supervisors")
    count_before = cur.fetchone()["n"]
    print(f"\nSupervisors before cleanup: {count_before:,}")

    # ── Step 2: Find false-name supervisors ─────────────────────────────────
    print("\nScanning for false-name supervisors...")
    cur.execute("SELECT id, name, school_name, school_code, department FROM supervisors")
    rows = cur.fetchall()

    to_delete_ids = []
    delete_summary = defaultdict(list)  # school_name → list of names

    for row in rows:
        if name_is_blocked(row["name"], explicit_set, compiled_patterns):
            to_delete_ids.append(row["id"])
            delete_summary[row["school_name"]].append(row["name"])

    print(f"  Found {len(to_delete_ids):,} false-name supervisors to delete")

    # ── Step 3: Delete false-name supervisors ────────────────────────────────
    if to_delete_ids:
        cur.execute(
            "DELETE FROM supervisors WHERE id = ANY(%s::uuid[])",
            (to_delete_ids,)
        )
        deleted = cur.rowcount
        print(f"  Deleted {deleted:,} supervisors (CASCADE handles related rows)")
    else:
        deleted = 0

    # ── Step 4: Strip title suffixes ─────────────────────────────────────────
    print("\nStripping title suffixes...")
    cur.execute("SELECT id, name, school_code, school_name, department FROM supervisors")
    remaining = cur.fetchall()

    strip_count = 0
    strip_log = []
    for row in remaining:
        stripped = strip_title(row["name"])
        if stripped != row["name"] and len(stripped) >= 2:
            strip_count += 1
            strip_log.append((row["id"], row["name"], stripped,
                               row["school_name"], row["department"]))

    print(f"  Found {strip_count:,} names with title suffixes to strip")

    # Apply strips – but check for conflicts first
    # Group by (school_code, stripped_name, department) to detect duplicates
    # Key: (school_code, new_name, department) → list of (id, old_name)
    conflict_groups = defaultdict(list)
    for sid, old_name, new_name, school_name, dept in strip_log:
        key = (sid,)  # we'll do per-entry check below
        conflict_groups[(school_name, new_name, dept)].append((sid, old_name))

    merge_count = 0
    actual_strips = 0
    stripped_then_blocked = 0

    # Build a lookup of (school_code, new_name, dept) → list of row IDs to rename
    # Need school_code for the unique constraint check
    cur.execute("SELECT id, school_code, school_name, department, name FROM supervisors")
    all_sup = {str(r["id"]): r for r in cur.fetchall()}

    # Rebuild strip_log with school_code
    strip_log_with_code = []
    for row in remaining:
        stripped = strip_title(row["name"])
        if stripped != row["name"] and len(stripped) >= 2:
            strip_log_with_code.append({
                "id": str(row["id"]),
                "old_name": row["name"],
                "new_name": stripped,
                "school_code": row["school_code"],
                "school_name": row["school_name"],
                "department": row["department"],
            })

    # Group by unique key to detect conflicts
    by_key = defaultdict(list)
    for entry in strip_log_with_code:
        key = (entry["school_code"], entry["new_name"], entry["department"])
        by_key[key].append(entry)

    for (school_code, new_name, dept), entries in by_key.items():
        # Case 1: stripped name is itself blocked → delete these entries
        if name_is_blocked(new_name, explicit_set, compiled_patterns):
            ids_to_del = [e["id"] for e in entries]
            cur.execute(
                "DELETE FROM supervisors WHERE id = ANY(%s::uuid[])",
                (ids_to_del,)
            )
            stripped_then_blocked += len(ids_to_del)
            continue

        # Case 2: Check if a clean-named entry already exists (unique constraint)
        cur.execute(
            "SELECT id, rating_count FROM supervisors "
            "WHERE school_code=%s AND name=%s AND department=%s",
            (school_code, new_name, dept)
        )
        existing = cur.fetchall()

        if existing:
            # Merge: keep the entry with most ratings, delete others
            all_ids = [str(e["id"]) for e in existing] + [e["id"] for e in entries]
            cur.execute(
                "SELECT id, rating_count FROM supervisors WHERE id = ANY(%s::uuid[])",
                (all_ids,)
            )
            candidates = cur.fetchall()
            best = max(candidates, key=lambda r: r["rating_count"] or 0)
            to_remove = [str(r["id"]) for r in candidates if str(r["id"]) != str(best["id"])]
            if to_remove:
                cur.execute(
                    "DELETE FROM supervisors WHERE id = ANY(%s::uuid[])",
                    (to_remove,)
                )
                merge_count += len(to_remove)
        else:
            # No conflict — strip the name
            for e in entries:
                cur.execute(
                    "UPDATE supervisors SET name=%s, updated_at=NOW() WHERE id=%s::uuid",
                    (new_name, e["id"])
                )
                actual_strips += 1

    print(f"  Names stripped: {actual_strips:,}")
    print(f"  Stripped-then-blocked (deleted): {stripped_then_blocked:,}")
    print(f"  Duplicates merged (deleted): {merge_count:,}")

    # ── Step 5: Final count ───────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) AS n FROM supervisors")
    count_after = cur.fetchone()["n"]

    conn.commit()

    # ── Summary report ────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("CLEANUP SUMMARY")
    print("="*60)
    print(f"  Supervisors before:          {count_before:>8,}")
    print(f"  False names deleted:         {deleted:>8,}")
    print(f"  Title suffixes stripped:     {actual_strips:>8,}")
    print(f"  Stripped→blocked (deleted):  {stripped_then_blocked:>8,}")
    print(f"  Duplicates merged/deleted:   {merge_count:>8,}")
    print(f"  Supervisors after:           {count_after:>8,}")
    print(f"  Net removed:                 {count_before - count_after:>8,}")
    print()

    print("Deletions by school:")
    for school, names in sorted(delete_summary.items()):
        print(f"  {school}: {len(names)} entries")
        for n in sorted(set(names))[:5]:  # show up to 5 sample names
            print(f"    - {n}")
        if len(set(names)) > 5:
            print(f"    ... and {len(set(names))-5} more")

    print("\nDB cleanup complete.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
