#!/usr/bin/env python3
"""
Clean the MASTER_ALL_90HEI_TUTORS CSV/XLSX files:
1. Remove rows where 导师姓名 is in the blocklist
2. Strip title suffixes from 导师姓名
3. Remove resulting duplicates (keep first occurrence by school+name+dept)
4. Save as CLEAN versions
"""

import re
import json
import pandas as pd

SRC_CSV = "/mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS.csv"
SRC_XLSX = "/mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS.xlsx"
DST_CSV = "/mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS_CLEAN.csv"
DST_XLSX = "/mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS_CLEAN.xlsx"
BLOCKLIST_PATH = "/mnt/d/Startup projects/GradChoice/data/blocklist.json"

TITLE_STRIP_PATTERNS = [
    r"[（(].*?[)）]$",
    r"副教授$",
    r"教授$",
    r"研究员$",
    r"副研究员$",
    r"讲师$",
    r"助理教授$",
    r"助理研究员$",
    r"助教$",
    r"副$",
]


def load_blocklist():
    with open(BLOCKLIST_PATH, encoding="utf-8") as f:
        return json.load(f)


def name_is_blocked(name, explicit_set, compiled_patterns):
    if not isinstance(name, str):
        return True  # NaN / non-string → remove
    name = name.strip()
    if not name:
        return True
    if name in explicit_set:
        return True
    for pat in compiled_patterns:
        if pat.search(name):
            return True
    return False


def strip_title(name):
    if not isinstance(name, str):
        return name
    stripped = name.strip()
    for pat in TITLE_STRIP_PATTERNS:
        new = re.sub(pat, "", stripped).strip()
        if new != stripped and len(new) >= 2:
            stripped = new
    return stripped


def clean_df(df, explicit_set, compiled_patterns):
    name_col = "导师姓名"
    dept_col = "导师院系/单位"
    school_col = "院校代码"

    original_rows = len(df)

    # Step 1: Remove blocked names
    mask = df[name_col].apply(
        lambda n: name_is_blocked(n, explicit_set, compiled_patterns)
    )
    removed_blocked = mask.sum()
    df = df[~mask].copy()
    print(f"  Removed {removed_blocked:,} rows with false names")

    # Step 2: Strip title suffixes
    df[name_col] = df[name_col].apply(strip_title)

    # After stripping, some names might now be blocked
    mask2 = df[name_col].apply(
        lambda n: name_is_blocked(n, explicit_set, compiled_patterns)
    )
    removed_after_strip = mask2.sum()
    df = df[~mask2].copy()
    print(f"  Removed {removed_after_strip:,} rows whose stripped name is still blocked")

    stripped_count = (df[name_col] != df[name_col].str.strip()).sum()  # rough check
    print(f"  Title suffixes stripped on remaining rows")

    # Step 3: Remove duplicates (school_code + name + dept)
    before_dedup = len(df)
    df = df.drop_duplicates(
        subset=[school_col, name_col, dept_col],
        keep="first"
    )
    removed_dupes = before_dedup - len(df)
    print(f"  Removed {removed_dupes:,} duplicate rows after stripping")

    print(f"  Total: {original_rows:,} → {len(df):,} rows "
          f"(removed {original_rows - len(df):,})")
    return df


def main():
    print("Loading blocklist...")
    bl = load_blocklist()
    explicit_set = set(bl["explicit"])
    compiled_patterns = [re.compile(p) for p in bl["patterns"]]

    print(f"\nReading CSV: {SRC_CSV}")
    df_csv = pd.read_csv(SRC_CSV, dtype=str)
    print(f"  Loaded {len(df_csv):,} rows")

    print("\nCleaning CSV...")
    df_clean = clean_df(df_csv, explicit_set, compiled_patterns)

    print(f"\nWriting clean CSV → {DST_CSV}")
    df_clean.to_csv(DST_CSV, index=False, encoding="utf-8-sig")

    print(f"\nReading XLSX: {SRC_XLSX}")
    df_xlsx = pd.read_excel(SRC_XLSX, dtype=str)
    print(f"  Loaded {len(df_xlsx):,} rows")

    print("\nCleaning XLSX...")
    df_clean_xlsx = clean_df(df_xlsx, explicit_set, compiled_patterns)

    print(f"\nWriting clean XLSX → {DST_XLSX}")
    df_clean_xlsx.to_excel(DST_XLSX, index=False)

    print("\nDone.")


if __name__ == "__main__":
    main()
