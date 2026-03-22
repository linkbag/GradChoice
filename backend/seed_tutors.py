#!/usr/bin/env python3
"""
seed_tutors.py — 导入导师 CSV 数据到 GradChoice 数据库

用法:
    python seed_tutors.py [--csv-dir PATH] [--db-url URL] [--dry-run]

默认 CSV 目录: /mnt/d/Startup projects/cn-grad-units/tutors/

CSV 文件期望列:
    院校代码, 院校, 省份, 导师姓名, 导师院系/单位, 职级, 合作/挂名单位
"""

import argparse
import sys
import os
from pathlib import Path
from collections import defaultdict

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# Add backend/ to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.models.supervisor import Supervisor
from app.database import Base

DEFAULT_CSV_DIR = "/mnt/d/Startup projects/cn-grad-units/tutors/"
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"
)

# Map CSV column names → model field names
COLUMN_MAP = {
    "院校代码": "school_code",
    "院校":    "school_name",
    "省份":    "province",
    "导师姓名": "name",
    "导师院系/单位": "department",
    "职级":    "title",
    "合作/挂名单位": "affiliated_unit",
}

REQUIRED_COLS = {"院校代码", "院校", "省份", "导师姓名", "导师院系/单位"}


def load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV, detect encoding, return DataFrame."""
    for encoding in ("utf-8", "utf-8-sig", "gbk", "gb18030"):
        try:
            df = pd.read_csv(path, encoding=encoding, dtype=str)
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError(f"无法解码文件: {path}")


def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace, rename columns, fill NaN."""
    df.columns = [c.strip() for c in df.columns]
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"缺少必要列: {missing}")
    df = df.rename(columns=COLUMN_MAP)
    # Fill optional fields
    for col in ("title", "affiliated_unit"):
        if col not in df.columns:
            df[col] = None
        else:
            df[col] = df[col].where(df[col].notna(), None)
    # Strip strings
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].str.strip()
    return df


def seed(csv_dir: str, db_url: str, dry_run: bool = False):
    csv_path = Path(csv_dir)
    if not csv_path.exists():
        print(f"[错误] CSV 目录不存在: {csv_path}")
        sys.exit(1)

    csv_files = sorted(csv_path.glob("*.csv"))
    if not csv_files:
        print(f"[警告] 目录中未找到 CSV 文件: {csv_path}")
        return

    print(f"找到 {len(csv_files)} 个 CSV 文件")

    engine = create_engine(db_url, pool_pre_ping=True)
    Base.metadata.create_all(engine)  # ensure tables exist
    Session = sessionmaker(bind=engine)
    session = Session()

    stats = defaultdict(lambda: {"inserted": 0, "skipped": 0, "errors": 0})
    total_inserted = 0
    total_skipped = 0

    for csv_file in csv_files:
        print(f"\n处理: {csv_file.name}")
        try:
            df = load_csv(csv_file)
            df = normalize_df(df)
        except Exception as e:
            print(f"  [跳过] 加载失败: {e}")
            continue

        school_name = df["school_name"].iloc[0] if len(df) > 0 else csv_file.stem

        for _, row in df.iterrows():
            # Skip rows with missing required fields
            if not all([row.get("school_code"), row.get("name"), row.get("department")]):
                stats[school_name]["errors"] += 1
                continue

            supervisor = Supervisor(
                school_code=row["school_code"],
                school_name=row["school_name"],
                province=row["province"],
                name=row["name"],
                department=row["department"],
                title=row.get("title"),
                affiliated_unit=row.get("affiliated_unit"),
            )

            if dry_run:
                stats[school_name]["inserted"] += 1
                continue

            try:
                session.add(supervisor)
                session.flush()
                stats[school_name]["inserted"] += 1
            except IntegrityError:
                session.rollback()
                stats[school_name]["skipped"] += 1
            except Exception as e:
                session.rollback()
                stats[school_name]["errors"] += 1
                print(f"  [错误] {row.get('name')}: {e}")

        if not dry_run:
            session.commit()

        s = stats[school_name]
        total_inserted += s["inserted"]
        total_skipped += s["skipped"]
        print(
            f"  {school_name}: 新增 {s['inserted']}，跳过 {s['skipped']}（重复），错误 {s['errors']}"
        )

    session.close()
    print(f"\n{'[模拟运行] ' if dry_run else ''}完成！")
    print(f"总计新增: {total_inserted}")
    print(f"总计跳过: {total_skipped}")

    # Per-school summary
    print("\n各院校摘要:")
    for school, s in sorted(stats.items()):
        if s["inserted"] > 0:
            print(f"  {school}: {s['inserted']} 位导师")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导入导师 CSV 数据")
    parser.add_argument(
        "--csv-dir",
        default=os.getenv("TUTOR_CSV_DIR", DEFAULT_CSV_DIR),
        help="CSV 文件目录"
    )
    parser.add_argument(
        "--db-url",
        default=DEFAULT_DB_URL,
        help="PostgreSQL 连接字符串"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟运行，不写入数据库"
    )
    args = parser.parse_args()
    seed(args.csv_dir, args.db_url, args.dry_run)
