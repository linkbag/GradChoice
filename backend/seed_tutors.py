#!/usr/bin/env python3
"""
seed_tutors.py — 从 XLSX 文件导入导师数据到 GradChoice 数据库

用法:
    python seed_tutors.py [--xlsx PATH] [--db-url URL] [--dry-run]

默认 XLSX 文件:
    /mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS.xlsx

Sheet: 全部导师(90校)
必要列: 导师姓名 (name)
可选列: 院校代码, 院校, 省份, 导师院系/单位, 职级, 合作/挂名单位, 相关网页/相关网页1-3
"""

import argparse
import sys
import os
import uuid
from pathlib import Path
from collections import defaultdict

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend/ to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.models.supervisor import Supervisor
from app.database import Base

DEFAULT_XLSX = "/mnt/d/Startup projects/cn-grad-units/MASTER_ALL_90HEI_TUTORS.xlsx"
DEFAULT_SHEET = "全部导师(90校)"
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"
)

COLUMN_MAP = {
    "院校代码":      "school_code",
    "院校":         "school_name",
    "省份":         "province",
    "导师姓名":      "name",
    "导师院系/单位": "department",
    "职级":         "title",
    "合作/挂名单位": "affiliated_unit",
    "相关网页1":     "webpage_url_1",
    "相关网页2":     "webpage_url_2",
    "相关网页3":     "webpage_url_3",
    "相关网页":      "webpage_url_1",   # single URL column in new MASTER file
}

REQUIRED_COLS = {"name"}

BATCH_SIZE = 1000


def load_xlsx(path: str, sheet: str) -> "pd.DataFrame":
    print(f"读取文件: {path}  (Sheet: {sheet})")
    df = pd.read_excel(path, sheet_name=sheet, dtype=str, engine="openpyxl")
    df.columns = [c.strip() for c in df.columns]
    # Rename columns
    df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})
    # Ensure all potentially-accessed columns exist (avoid KeyError for missing fields)
    for col in ("school_code", "school_name", "province", "department",
                "title", "affiliated_unit", "webpage_url_1", "webpage_url_2", "webpage_url_3"):
        if col not in df.columns:
            df[col] = None
    print(f"  读取到 {len(df)} 行，列: {list(df.columns)}")
    return df


def normalize(df: "pd.DataFrame") -> "pd.DataFrame":
    # Replace 'nan' and empty strings with None
    df = df.where(df.notna(), None)
    NA_STRINGS = {"nan", "NaN", "None", "none", "NULL", "null", ""}
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].str.strip()
            df[col] = df[col].where(~df[col].isin(NA_STRINGS), None)
    # Convert school_code: strip trailing .0 from numeric reads
    if "school_code" in df.columns:
        def fix_code(x):
            if x is None:
                return None
            x = str(x).strip()
            if x.endswith(".0"):
                x = x[:-2]
            return x if x else None
        df["school_code"] = df["school_code"].apply(fix_code)
    return df


def seed(xlsx_path: str, sheet: str, db_url: str, dry_run: bool = False):
    # Load data
    df = load_xlsx(xlsx_path, sheet)
    df = normalize(df)

    # Validate required columns
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        print(f"[错误] 缺少必要列: {missing}")
        sys.exit(1)

    # Drop rows missing required fields
    before = len(df)
    df = df.dropna(subset=list(REQUIRED_COLS))
    dropped = before - len(df)
    if dropped:
        print(f"  跳过 {dropped} 行（缺少必要字段）")

    print(f"  有效数据: {len(df)} 行")

    # Connect to DB
    engine = create_engine(db_url, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Load existing unique keys to detect duplicates
    print("加载已有数据的唯一键...")
    existing = set(
        session.execute(
            text("SELECT COALESCE(school_code,''), name, COALESCE(department,'') FROM supervisors")
        ).fetchall()
    )
    print(f"  数据库中已有 {len(existing)} 条记录")

    total_inserted = 0
    total_skipped = 0
    per_school: dict = defaultdict(int)

    batch: list = []

    def clean(val, max_len=None):
        """Convert pandas NaN/NaT/None to None for SQLAlchemy."""
        if val is None:
            return None
        if isinstance(val, float) and pd.isna(val):
            return None
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null"):
            return None
        if max_len and len(s) > max_len:
            s = s[:max_len]
        return s

    def flush_batch():
        nonlocal total_inserted
        if not batch:
            return
        if not dry_run:
            session.bulk_insert_mappings(Supervisor, batch)
            session.commit()
        total_inserted += len(batch)
        batch.clear()

    for _, row in df.iterrows():
        key = (row["school_code"] or "", row["name"], row.get("department") or "")
        if key in existing:
            total_skipped += 1
            continue
        existing.add(key)

        record = {
            "id": uuid.uuid4(),
            "school_code": row["school_code"],
            "school_name": row["school_name"],
            "province": row["province"],
            "name": row["name"],
            "department": row["department"],
            "title": clean(row.get("title")),
            "affiliated_unit": clean(row.get("affiliated_unit")),
            "webpage_url_1": clean(row.get("webpage_url_1"), max_len=500),
            "webpage_url_2": clean(row.get("webpage_url_2"), max_len=500),
            "webpage_url_3": clean(row.get("webpage_url_3"), max_len=500),
            "avg_overall_score": None,
            "rating_count": 0,
        }
        batch.append(record)
        per_school[row["school_name"]] += 1

        if len(batch) >= BATCH_SIZE:
            flush_batch()
            print(f"  已插入 {total_inserted} 条...")

    flush_batch()
    session.close()

    print(f"\n{'[模拟运行] ' if dry_run else ''}完成！")
    print(f"总计新增: {total_inserted}")
    print(f"总计跳过（重复）: {total_skipped}")
    print(f"\n各院校摘要（新增≥1条，前30所）:")
    for school, count in sorted(per_school.items(), key=lambda x: -x[1])[:30]:
        print(f"  {school}: {count} 位导师")
    if len(per_school) > 30:
        print(f"  ...（共 {len(per_school)} 所院校）")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="从 XLSX 导入导师数据")
    parser.add_argument(
        "--xlsx",
        default=os.getenv("TUTOR_XLSX", DEFAULT_XLSX),
        help="XLSX 文件路径",
    )
    parser.add_argument(
        "--sheet",
        default=DEFAULT_SHEET,
        help="Sheet 名称",
    )
    parser.add_argument(
        "--db-url",
        default=DEFAULT_DB_URL,
        help="PostgreSQL 连接字符串",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟运行，不写入数据库",
    )
    args = parser.parse_args()
    seed(args.xlsx, args.sheet, args.db_url, args.dry_run)
