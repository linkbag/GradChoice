#!/usr/bin/env python3
"""
seed_external_data.py — 导入外部评论数据到 GradChoice 数据库

支持的数据源:
  1. yankong.org   — 从 data/raw/yankong/reviews.json 读取（后台爬虫持续写入）
  2. RateMySupervisor — 占位，待实现

用法:
    cd backend
    SECRET_KEY=xxx python3 seed_external_data.py [选项]

选项:
    --db-url URL        PostgreSQL 连接字符串（默认从 DATABASE_URL 环境变量读取）
    --yankong-only      仅处理 yankong.org 数据，跳过其他数据源
    --yankong-file PATH yankong reviews.json 路径
                        （默认: ../data/raw/yankong/reviews.json）
    --dry-run           模拟运行，不写入数据库
    --help              显示此帮助并退出

说明:
    - 脚本具有幂等性：重复执行不会创建重复条目
    - 每条 yankong 评论使用确定性 UUID（基于来源内容哈希），避免重复导入
    - 所有 yankong 评论附加来源标注：「此条评论转载自 https://www.yankong.org/」
    - 导入时使用内部系统账号（system+yankong-importer@gradchoice.internal）

reviews.json 格式（每条评论一个对象）:
    {
        "supervisor_name": "张三",
        "school_name": "北京大学",
        "department": "计算机科学与技术系",   # 可选，未知时填 ""
        "content": "这位导师非常认真...",
        "source_url": "https://www.yankong.org/xxx",  # 可选
        "date": "2023-01-15"                          # 可选，YYYY-MM-DD
    }
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Path setup ────────────────────────────────────────────────────────────────
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

DEFAULT_YANKONG_FILE = HERE.parent / "data" / "raw" / "yankong" / "reviews.json"
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice",
)

# Fixed UUID namespace for deterministic comment IDs (yankong source)
YANKONG_UUID_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # URL namespace

# System user for all imported comments
IMPORTER_USER_EMAIL = "system+yankong-importer@gradchoice.internal"
IMPORTER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

YANKONG_ATTRIBUTION = "此条评论转载自 https://www.yankong.org/"

PROGRESS_INTERVAL = 500


# ── Helpers ───────────────────────────────────────────────────────────────────

def _deterministic_comment_id(supervisor_id: uuid.UUID, content: str) -> uuid.UUID:
    """
    Generate a stable UUID for a yankong comment.
    Input: supervisor DB UUID + raw content string.
    Output: UUID5 — guaranteed to be the same UUID if the same review is
    re-imported, ensuring idempotency via primary-key uniqueness.
    """
    key = f"yankong:{supervisor_id}:{content}"
    return uuid.uuid5(YANKONG_UUID_NAMESPACE, key)


def _parse_date(date_str: str | None) -> datetime:
    """Parse optional YYYY-MM-DD string; fall back to now."""
    if date_str:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


# ── Importer system user ──────────────────────────────────────────────────────

def _ensure_importer_user(session) -> uuid.UUID:
    """
    Create the importer system user if it doesn't already exist.
    Uses a fixed UUID so the operation is idempotent.
    Returns the user UUID.
    """
    row = session.execute(
        text("SELECT id FROM users WHERE id = :uid"),
        {"uid": IMPORTER_USER_ID},
    ).fetchone()

    if row is not None:
        return IMPORTER_USER_ID

    # Use a garbage hashed password — this account is not for login
    fake_hash = hashlib.sha256(b"__not_a_real_password__").hexdigest()
    now = datetime.now(timezone.utc)

    session.execute(
        text("""
            INSERT INTO users (
                id, email, hashed_password, display_name,
                is_email_verified, is_student_verified, verification_type,
                school_email_verified, email_notifications_enabled,
                created_at, updated_at
            ) VALUES (
                :id, :email, :pw, :name,
                false, false, 'none',
                false, false,
                :now, :now
            )
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": IMPORTER_USER_ID,
            "email": IMPORTER_USER_EMAIL,
            "pw": fake_hash,
            "name": "yankong.org 数据导入",
            "now": now,
        },
    )
    session.commit()
    print(f"[init] 创建导入系统账号: {IMPORTER_USER_EMAIL}")
    return IMPORTER_USER_ID


# ── Supervisor lookup cache ───────────────────────────────────────────────────

def _build_supervisor_cache(session) -> dict[tuple[str, str], uuid.UUID]:
    """
    Load all supervisors into a dict keyed by (name, school_name).
    Both keys are lowercased for fuzzy matching.
    """
    rows = session.execute(
        text("SELECT id, name, school_name FROM supervisors")
    ).fetchall()
    cache: dict[tuple[str, str], uuid.UUID] = {}
    for row in rows:
        key = (row[1].strip().lower(), row[2].strip().lower())
        cache[key] = row[0]
    return cache


def _lookup_supervisor(
    cache: dict[tuple[str, str], uuid.UUID],
    supervisor_name: str,
    school_name: str,
) -> uuid.UUID | None:
    key = (supervisor_name.strip().lower(), school_name.strip().lower())
    return cache.get(key)


# ── yankong.org importer ──────────────────────────────────────────────────────

def import_yankong(
    session,
    yankong_file: Path,
    importer_user_id: uuid.UUID,
    supervisor_cache: dict,
    dry_run: bool,
) -> tuple[int, int, int]:
    """
    Import yankong.org reviews from JSON file.

    Returns (total_processed, new_inserts, duplicates_skipped).
    """
    if not yankong_file.exists():
        print(f"[yankong] 文件不存在，跳过: {yankong_file}")
        return 0, 0, 0

    with open(yankong_file, encoding="utf-8") as f:
        reviews: list[dict] = json.load(f)

    total = len(reviews)
    print(f"[yankong] 读取到 {total} 条评论，开始处理...")

    if total == 0:
        print("[yankong] 文件为空，跳过。")
        return 0, 0, 0

    # Pre-load existing yankong comment IDs to detect duplicates fast
    existing_ids: set[uuid.UUID] = set()
    if not dry_run:
        rows = session.execute(
            text(
                "SELECT id FROM comments WHERE content LIKE :attr"
            ),
            {"attr": f"%{YANKONG_ATTRIBUTION}%"},
        ).fetchall()
        existing_ids = {row[0] for row in rows}
        print(f"[yankong] 数据库中已有 {len(existing_ids)} 条 yankong 评论（将跳过重复）")

    new_inserts = 0
    duplicates = 0
    not_found = 0
    batch: list[dict] = []
    BATCH_SIZE = 200

    def flush_batch():
        nonlocal new_inserts
        if not batch or dry_run:
            new_inserts += len(batch)
            batch.clear()
            return
        session.execute(
            text("""
                INSERT INTO comments (
                    id, user_id, supervisor_id, parent_comment_id,
                    content, likes_count, dislikes_count,
                    is_flagged, is_deleted, is_edited, flag_count,
                    created_at, updated_at
                ) VALUES (
                    :id, :user_id, :supervisor_id, NULL,
                    :content, 0, 0,
                    false, false, false, 0,
                    :created_at, :updated_at
                )
                ON CONFLICT (id) DO NOTHING
            """),
            batch,
        )
        session.commit()
        new_inserts += len(batch)
        batch.clear()

    for idx, review in enumerate(reviews, start=1):
        # Progress logging every PROGRESS_INTERVAL records
        if idx % PROGRESS_INTERVAL == 0:
            print(f"[yankong] 处理进度 {idx}/{total} 条评论...")

        supervisor_name = (review.get("supervisor_name") or "").strip()
        school_name = (review.get("school_name") or "").strip()
        raw_content = (review.get("content") or "").strip()

        if not supervisor_name or not school_name or not raw_content:
            duplicates += 1  # count malformed entries as skipped
            continue

        supervisor_id = _lookup_supervisor(supervisor_cache, supervisor_name, school_name)
        if supervisor_id is None:
            not_found += 1
            continue

        # Build full comment content with attribution
        source_url = (review.get("source_url") or "").strip()
        attribution_line = YANKONG_ATTRIBUTION
        if source_url:
            attribution_line = f"此条评论转载自 {source_url}"
        full_content = f"{raw_content}\n\n{attribution_line}"

        # Deterministic ID for idempotency
        comment_id = _deterministic_comment_id(supervisor_id, raw_content)

        if comment_id in existing_ids:
            duplicates += 1
            continue

        existing_ids.add(comment_id)  # prevent in-batch duplicates

        created_at = _parse_date(review.get("date"))

        batch.append({
            "id": comment_id,
            "user_id": importer_user_id,
            "supervisor_id": supervisor_id,
            "content": full_content,
            "created_at": created_at,
            "updated_at": created_at,
        })

        if len(batch) >= BATCH_SIZE:
            flush_batch()

    # Flush remaining
    flush_batch()

    print(f"[yankong] 完成。处理: {total} | 新增: {new_inserts} | 跳过(重复/无效): {duplicates} | 导师未匹配: {not_found}")
    return total, new_inserts, duplicates


# ── RateMySupervisor importer (placeholder) ───────────────────────────────────

def import_ratemysupervisor(
    session,
    supervisor_cache: dict,
    dry_run: bool,
) -> tuple[int, int, int]:
    """
    Import RateMySupervisor data.
    TODO: Implement when data source / scraper is ready.
    """
    print("[ratemysupervisor] 数据源尚未实现，跳过。")
    return 0, 0, 0


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=(
            "seed_external_data.py — 导入外部导师评论数据到 GradChoice 数据库\n\n"
            "数据源:\n"
            "  • yankong.org  — 从 data/raw/yankong/reviews.json 读取\n"
            "  • RateMySupervisor — 待实现\n\n"
            "默认行为（无参数）：导入所有数据源。"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--db-url",
        default=DEFAULT_DB_URL,
        metavar="URL",
        help=(
            "PostgreSQL 连接字符串 "
            "（默认: $DATABASE_URL 或 postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice）"
        ),
    )
    parser.add_argument(
        "--yankong-only",
        action="store_true",
        help="仅处理 yankong.org 数据，跳过 RateMySupervisor 等其他数据源",
    )
    parser.add_argument(
        "--yankong-file",
        default=str(DEFAULT_YANKONG_FILE),
        metavar="PATH",
        help=(
            "yankong reviews.json 文件路径 "
            f"（默认: {DEFAULT_YANKONG_FILE}）"
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟运行，读取数据并打印统计，不写入数据库",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("GradChoice 外部数据导入")
    print(f"  数据库: {args.db_url}")
    print(f"  模式:   {'仅 yankong' if args.yankong_only else '全部数据源'}")
    if args.dry_run:
        print("  [模拟运行] 不会写入数据库")
    print("=" * 60)

    engine = create_engine(args.db_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Ensure the importer system user exists
        importer_user_id = _ensure_importer_user(session) if not args.dry_run else IMPORTER_USER_ID

        # Build supervisor lookup cache (name, school) → UUID
        print("[init] 加载导师数据...")
        supervisor_cache = _build_supervisor_cache(session)
        print(f"[init] 已加载 {len(supervisor_cache)} 位导师")

        grand_total = grand_new = grand_dupes = 0

        # ── yankong.org ──
        print()
        yk_total, yk_new, yk_dupes = import_yankong(
            session,
            Path(args.yankong_file),
            importer_user_id,
            supervisor_cache,
            args.dry_run,
        )
        grand_total += yk_total
        grand_new += yk_new
        grand_dupes += yk_dupes

        # ── RateMySupervisor (skip if --yankong-only) ──
        if not args.yankong_only:
            print()
            rms_total, rms_new, rms_dupes = import_ratemysupervisor(
                session,
                supervisor_cache,
                args.dry_run,
            )
            grand_total += rms_total
            grand_new += rms_new
            grand_dupes += rms_dupes

        # ── Summary ──
        print()
        print("=" * 60)
        print("导入汇总")
        print(f"  总处理条数:   {grand_total}")
        print(f"  新增条数:     {grand_new}")
        print(f"  跳过(重复):   {grand_dupes}")
        if args.dry_run:
            print("  [模拟运行] 以上数据未实际写入数据库")
        print("=" * 60)

    finally:
        session.close()


if __name__ == "__main__":
    main()
