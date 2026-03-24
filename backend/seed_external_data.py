#!/usr/bin/env python3
"""
seed_external_data.py — 从开源社区导入真实历史评价数据到 GradChoice 数据库

数据来源:
  1. pengp25/RateMySupervisor (urfire.json) — 含分维度评分
  2. pengp25/RateMySupervisor (comments_data.json) — 补充去重后的独有评论
  3. yankong.org (如有原始数据)

用法:
    cd backend
    SECRET_KEY=xxx python3 seed_external_data.py [--db-url URL] [--dry-run] [--reset]

选项:
    --db-url   PostgreSQL 连接字符串
    --dry-run  模拟运行，不写入数据库
    --reset    先删除已导入的历史数据（system-import 用户及其级联数据）
"""

import argparse
import json
import os
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).parent))

from app.models.user import User, VerificationType
from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.models.comment import Comment

try:
    from passlib.context import CryptContext
    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(pw: str) -> str:
        return _pwd_ctx.hash(pw)
except Exception:
    import hashlib
    def hash_password(pw: str) -> str:
        return hashlib.sha256(pw.encode()).hexdigest()


# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

DATA_DIR = Path(__file__).parent.parent / "data" / "raw" / "ratemysupervisor" / "RateMySupervisor" / "data"
YANKONG_DIR = Path(__file__).parent.parent / "data" / "raw" / "yankong"
NORMALIZED_DIR = Path(__file__).parent.parent / "data" / "normalized"

URFIRE_JSON = DATA_DIR / "urfire.json"
COMMENTS_JSON = DATA_DIR / "comments_data.json"

DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"
)

SYSTEM_USER_EMAIL = "system-import@gradchoice.org"
SYSTEM_USER_DISPLAY = "历史数据导入"
SYSTEM_USER_PASSWORD = "system-import-not-for-login-" + uuid.uuid4().hex[:8]

BATCH_SIZE = 500

# Attribution suffixes
ATTR_RATEMYSUPERVISOR = "\n\n——此条评论转载自 https://github.com/kgco/RateMySupervisor"
ATTR_YANKONG = "\n\n——此条评论转载自 https://www.yankong.org/"

# urfire.json scores are 1-5 per dimension, map to GradChoice schema:
# academic_score -> score_academic
# project_money_score -> score_resources (closest match)
# relation_score -> score_mentoring (closest match)
# future_score -> score_wellbeing (closest match, career/future outlook)
# Overall: average of available dimension scores


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def clean_html(text: str) -> str:
    """Remove HTML tags, convert <br> to newlines."""
    if not text:
        return ""
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.strip()
    return text


def clean_supervisor_name(name: str) -> str:
    """Remove parenthetical annotations from supervisor names.
    e.g. '周裕(深圳,千人计划)' -> '周裕'
    """
    if not name:
        return ""
    # Remove parenthetical/bracket annotations
    cleaned = re.sub(r'[（(][^)）]*[)）]', '', name).strip()
    return cleaned or name.strip()


def compute_overall_score(scores: dict) -> float | None:
    """Compute overall score from dimension scores (1-5 scale)."""
    vals = [v for v in scores.values() if v is not None and v > 0]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def to_decimal(val, min_val=1.0, max_val=5.0) -> Decimal | None:
    """Convert a score to Decimal(3,2), clamped to [min_val, max_val]."""
    if val is None:
        return None
    try:
        v = float(val)
        if v <= 0:
            return None
        v = max(min_val, min(max_val, v))
        return Decimal(str(v)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    except (ValueError, TypeError):
        return None


# ─────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────

def load_urfire() -> list[dict]:
    """Load and normalize urfire.json entries with comments."""
    print(f"加载 urfire.json: {URFIRE_JSON}")
    with open(URFIRE_JSON, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    records = []
    for entry in raw:
        if not entry or not isinstance(entry, dict):
            continue
        comments = entry.get('comments')
        if not comments or not isinstance(comments, dict):
            continue
        if comments.get('count', 0) == 0:
            continue

        school = (entry.get('school_name') or '').strip()
        dept = (entry.get('college_name') or '').strip()
        name_raw = (entry.get('name') or '').strip()
        name = clean_supervisor_name(name_raw)
        province = (entry.get('province') or '').strip()

        if not school or not name:
            continue

        for c in (comments.get('data') or []):
            if not c or not isinstance(c, dict):
                continue

            desc = clean_html(c.get('other_desc') or '')
            if not desc or len(desc) < 5:
                continue

            # Dimension scores (1-5 in urfire)
            dim_scores = {
                'academic': c.get('academic_score'),
                'resources': c.get('project_money_score'),
                'mentoring': c.get('relation_score'),
                'wellbeing': c.get('future_score'),
            }

            overall = compute_overall_score(dim_scores)
            date_str = c.get('other_desc_date') or ''

            records.append({
                'source': 'ratemysupervisor',
                'school': school,
                'department': dept,
                'supervisor_name_raw': name_raw,
                'supervisor_name': name,
                'province': province,
                'description': desc,
                'overall_score': overall,
                'score_academic': dim_scores.get('academic'),
                'score_mentoring': dim_scores.get('mentoring'),
                'score_wellbeing': dim_scores.get('wellbeing'),
                'score_resources': dim_scores.get('resources'),
                'date': date_str,
                'dedup_key': desc[:150],
            })

    print(f"  urfire.json: {len(records)} 条评论")
    return records


def load_comments_data() -> list[dict]:
    """Load comments_data.json entries."""
    print(f"加载 comments_data.json: {COMMENTS_JSON}")
    with open(COMMENTS_JSON, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    records = []
    for entry in raw:
        if not entry or not isinstance(entry, dict):
            continue

        desc = clean_html(entry.get('description') or '')
        if not desc or len(desc) < 5:
            continue

        school = (entry.get('university') or '').strip()
        dept = (entry.get('department') or '').strip()
        name_raw = (entry.get('supervisor') or '').strip()
        name = clean_supervisor_name(name_raw)
        rate = entry.get('rate')

        if not school or not name:
            continue

        # comments_data.json rate is 0-5 (overall)
        overall = None
        if rate is not None:
            try:
                overall = float(rate)
                if overall <= 0:
                    overall = None
            except (ValueError, TypeError):
                overall = None

        records.append({
            'source': 'ratemysupervisor',
            'school': school,
            'department': dept,
            'supervisor_name_raw': name_raw,
            'supervisor_name': name,
            'province': '',
            'description': desc,
            'overall_score': overall,
            'score_academic': None,
            'score_mentoring': None,
            'score_wellbeing': None,
            'score_resources': None,
            'date': '',
            'dedup_key': desc[:150],
        })

    print(f"  comments_data.json: {len(records)} 条评论")
    return records


def load_yankong() -> list[dict]:
    """Load scraped yankong.org data if available.

    Yankong data format: [{university, department, professor, sha1, reviews: [{
        description, rate, academic, researchFunding, studentSalary,
        studentProfRelation, workingTime, jobPotential, created_at, ...
    }]}]

    Rate: 0-50 scale (0 = no rating). Dimension scores: 0-5 (0 = not rated).
    """
    yankong_file = YANKONG_DIR / "reviews.json"
    if not yankong_file.exists():
        print(f"  yankong.org 数据不存在: {yankong_file}")
        return []

    print(f"加载 yankong.org: {yankong_file}")
    with open(yankong_file, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    records = []
    for entry in raw:
        if not entry or not isinstance(entry, dict):
            continue

        school = (entry.get('university') or '').strip()
        dept = (entry.get('department') or '').strip()
        name_raw = (entry.get('professor') or '').strip()

        if not school or not name_raw:
            continue

        for review in (entry.get('reviews') or []):
            if not review or not isinstance(review, dict):
                continue

            desc = clean_html(review.get('description') or '')
            if not desc or len(desc) < 5:
                continue

            # Rate: 0-50 scale, convert to 1-5
            rate = review.get('rate')
            overall = None
            if rate is not None:
                try:
                    v = float(rate)
                    if v > 5:
                        v = v / 10  # 50 -> 5.0
                    if 1.0 <= v <= 5.0:
                        overall = v
                except (ValueError, TypeError):
                    pass

            # Dimension scores (0-5, 0 means not rated)
            def yk_score(val):
                if val is None:
                    return None
                try:
                    v = int(val)
                    return v if 1 <= v <= 5 else None
                except (ValueError, TypeError):
                    return None

            # Map yankong dimensions to GradChoice schema
            score_academic = yk_score(review.get('academic'))
            score_resources = yk_score(review.get('researchFunding'))
            score_stipend = yk_score(review.get('studentSalary'))
            score_mentoring = yk_score(review.get('studentProfRelation'))
            score_wellbeing = yk_score(review.get('jobPotential'))

            # If no overall but have dimension scores, compute it
            if overall is None:
                dim_vals = [v for v in [score_academic, score_resources, score_stipend,
                                        score_mentoring, score_wellbeing] if v is not None]
                if dim_vals:
                    overall = sum(dim_vals) / len(dim_vals)

            records.append({
                'source': 'yankong',
                'school': school,
                'department': dept,
                'supervisor_name_raw': name_raw,
                'supervisor_name': clean_supervisor_name(name_raw),
                'province': '',
                'description': desc,
                'overall_score': overall,
                'score_academic': score_academic,
                'score_mentoring': score_mentoring,
                'score_wellbeing': score_wellbeing,
                'score_resources': score_resources,
                'date': (review.get('created_at') or '')[:10],
                'dedup_key': desc[:150],
            })

    print(f"  yankong.org: {len(records)} 条评论")
    return records


# ─────────────────────────────────────────────
# Combine & deduplicate
# ─────────────────────────────────────────────

def combine_and_dedup(urfire: list, comments: list, yankong: list) -> list[dict]:
    """Combine all sources, preferring urfire (has dimension scores). Dedup by text prefix."""
    seen = set()
    combined = []

    # urfire first (richer data)
    for r in urfire:
        key = r['dedup_key']
        if key in seen:
            continue
        seen.add(key)
        combined.append(r)

    # Then comments_data (supplement)
    skipped_cd = 0
    for r in comments:
        key = r['dedup_key']
        if key in seen:
            skipped_cd += 1
            continue
        seen.add(key)
        combined.append(r)

    # Then yankong
    skipped_yk = 0
    for r in yankong:
        key = r['dedup_key']
        if key in seen:
            skipped_yk += 1
            continue
        seen.add(key)
        combined.append(r)

    print(f"\n合并去重结果:")
    print(f"  urfire: {len(urfire)} 条")
    print(f"  comments_data 去重跳过: {skipped_cd} 条, 新增: {len(comments) - skipped_cd} 条")
    print(f"  yankong 去重跳过: {skipped_yk} 条, 新增: {len(yankong) - skipped_yk} 条")
    print(f"  合并总计: {len(combined)} 条")
    return combined


# ─────────────────────────────────────────────
# Database operations
# ─────────────────────────────────────────────

def get_or_create_system_user(session) -> uuid.UUID:
    """Get or create the system import user."""
    user = session.query(User).filter(User.email == SYSTEM_USER_EMAIL).first()
    if user:
        print(f"  系统导入用户已存在: {user.id}")
        return user.id

    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=SYSTEM_USER_EMAIL,
        hashed_password=hash_password(SYSTEM_USER_PASSWORD),
        display_name=SYSTEM_USER_DISPLAY,
        bio="此账号用于导入开源社区的历史评价数据。数据来源包括 RateMySupervisor、研控等。",
        is_email_verified=True,
        is_student_verified=False,
        verification_type=VerificationType.none,
    )
    session.add(user)
    session.flush()
    print(f"  创建系统导入用户: {user_id}")
    return user_id


def build_supervisor_index(session) -> dict:
    """Build a lookup index: (school_name, cleaned_name) -> supervisor row."""
    print("构建导师索引...")
    rows = session.execute(
        text("SELECT id, school_name, name, department, school_code, province FROM supervisors")
    ).fetchall()

    index = {}
    for row in rows:
        sid, school, name, dept, code, prov = row
        key = (school.strip(), name.strip())
        # Store first match (there might be multiples for different departments)
        if key not in index:
            index[key] = {
                'id': sid, 'school_name': school, 'name': name,
                'department': dept, 'school_code': code, 'province': prov
            }

    print(f"  索引中 {len(index)} 位导师")
    return index


def build_school_code_map(session) -> dict:
    """Build school_name -> school_code mapping from existing supervisors."""
    rows = session.execute(
        text("SELECT DISTINCT school_name, school_code FROM supervisors WHERE school_code IS NOT NULL AND school_code != ''")
    ).fetchall()
    return {r[0].strip(): r[1].strip() for r in rows}


def seed_data(records: list[dict], db_url: str, dry_run: bool = False, reset: bool = False):
    """Insert normalized records into the database."""
    engine = create_engine(db_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Reset if requested
    if reset:
        print("\n清理已导入的历史数据...")
        user = session.query(User).filter(User.email == SYSTEM_USER_EMAIL).first()
        if user:
            deleted_ratings = session.query(Rating).filter(Rating.user_id == user.id).delete()
            deleted_comments = session.query(Comment).filter(Comment.user_id == user.id).delete()
            session.delete(user)
            session.commit()
            print(f"  已删除: {deleted_ratings} 评分, {deleted_comments} 评论, 1 用户")
        else:
            print("  未找到系统导入用户，无需清理")

    # Create system user
    print("\n准备系统导入用户...")
    system_user_id = get_or_create_system_user(session)
    session.commit()

    # Build supervisor index
    sup_index = build_supervisor_index(session)
    school_code_map = build_school_code_map(session)

    # Check existing imported data to avoid duplicates on re-run
    existing_comments = set()
    existing_rows = session.execute(
        text("SELECT content FROM comments WHERE user_id = :uid"),
        {'uid': str(system_user_id)}
    ).fetchall()
    for row in existing_rows:
        existing_comments.add(row[0][:150] if row[0] else '')
    print(f"  已导入的评论数: {len(existing_comments)}")

    # Build existing DB constraint keys to avoid UniqueViolation on new supervisors
    existing_sup_keys = set()
    existing_key_rows = session.execute(
        text("SELECT COALESCE(school_code,''), name, COALESCE(department,'') FROM supervisors")
    ).fetchall()
    for row in existing_key_rows:
        existing_sup_keys.add((row[0], row[1], row[2]))
    print(f"  已有导师唯一键: {len(existing_sup_keys)}")

    # Process records
    stats = Counter()
    ratings_batch = []
    comments_batch = []
    new_supervisors = {}  # (school_code, name, department) -> supervisor dict
    new_sup_lookup = {}   # (school_name, name) -> supervisor_id (for comment linking)
    sup_rating_sums = defaultdict(lambda: {'total': 0.0, 'count': 0})

    for i, rec in enumerate(records):
        school = rec['school']
        name = rec['supervisor_name']
        key = (school, name)

        # Try to find supervisor in our DB
        sup_info = sup_index.get(key)
        if not sup_info:
            # Try with raw name too
            key_raw = (school, rec['supervisor_name_raw'])
            sup_info = sup_index.get(key_raw)

        if not sup_info:
            # Check new_sup_lookup first
            if key in new_sup_lookup:
                sup_id = new_sup_lookup[key]
            else:
                school_code = school_code_map.get(school, '')
                department = rec.get('department', '') or ''
                province = rec.get('province', '')
                db_key = (school_code, name, department)

                # Check against DB constraint
                if db_key in existing_sup_keys:
                    # Supervisor exists in DB but wasn't found in our index
                    # (likely different school_name or cleaned name)
                    stats['skipped_sup_conflict'] += 1
                    continue

                if db_key not in new_supervisors:
                    new_sup_id = uuid.uuid4()
                    new_supervisors[db_key] = {
                        'id': new_sup_id,
                        'school_code': school_code,
                        'school_name': school,
                        'province': province,
                        'name': name,
                        'department': department,
                        'title': None,
                        'affiliated_unit': None,
                        'avg_overall_score': None,
                        'rating_count': 0,
                        'verified_avg_overall_score': None,
                        'verified_rating_count': 0,
                    }
                    existing_sup_keys.add(db_key)
                sup_id = new_supervisors[db_key]['id']
                new_sup_lookup[key] = sup_id
            stats['new_supervisors'] += 1
        else:
            sup_id = sup_info['id']
            stats['matched_supervisors'] += 1

        # Add attribution to description
        if rec['source'] == 'yankong':
            content = rec['description'] + ATTR_YANKONG
        else:
            content = rec['description'] + ATTR_RATEMYSUPERVISOR

        # Check for duplicates (idempotent)
        if content[:150] in existing_comments:
            stats['skipped_duplicate'] += 1
            continue

        # Create comment
        comment_id = uuid.uuid4()
        comments_batch.append({
            'id': comment_id,
            'user_id': system_user_id,
            'supervisor_id': sup_id,
            'parent_comment_id': None,
            'content': content,
            'likes_count': 0,
            'dislikes_count': 0,
            'is_flagged': False,
            'is_deleted': False,
            'is_edited': False,
            'flag_count': 0,
        })
        existing_comments.add(content[:150])

        # Create rating if we have scores
        overall = rec.get('overall_score')
        if overall is not None and overall > 0:
            overall_dec = to_decimal(overall)
            if overall_dec:
                rating_id = uuid.uuid4()
                ratings_batch.append({
                    'id': rating_id,
                    'user_id': system_user_id,
                    'supervisor_id': sup_id,
                    'is_verified_rating': False,
                    'overall_score': overall_dec,
                    'score_academic': to_decimal(rec.get('score_academic')),
                    'score_mentoring': to_decimal(rec.get('score_mentoring')),
                    'score_wellbeing': to_decimal(rec.get('score_wellbeing')),
                    'score_stipend': None,
                    'score_resources': to_decimal(rec.get('score_resources')),
                    'score_ethics': None,
                    'upvotes': 0,
                    'downvotes': 0,
                })
                sup_rating_sums[str(sup_id)]['total'] += float(overall_dec)
                sup_rating_sums[str(sup_id)]['count'] += 1
                stats['ratings_created'] += 1

        stats['comments_created'] += 1

        if (i + 1) % 5000 == 0:
            print(f"  处理进度: {i+1}/{len(records)}")

    # Summary before inserting
    unique_new_sups = len(new_supervisors)
    print(f"\n统计:")
    print(f"  匹配到已有导师: {stats['matched_supervisors']} 次")
    print(f"  需要新建导师: {unique_new_sups} 位")
    print(f"  评论: {stats['comments_created']} 条")
    print(f"  评分: {stats['ratings_created']} 条")
    print(f"  跳过重复: {stats['skipped_duplicate']} 条")

    if dry_run:
        print("\n[模拟运行] 不写入数据库")
        session.close()
        return stats

    # Insert new supervisors
    if new_supervisors:
        print(f"\n插入 {len(new_supervisors)} 位新导师...")
        sup_list = list(new_supervisors.values())
        for batch_start in range(0, len(sup_list), BATCH_SIZE):
            batch = sup_list[batch_start:batch_start + BATCH_SIZE]
            session.bulk_insert_mappings(Supervisor, batch)
            session.commit()
            print(f"  导师: {min(batch_start + BATCH_SIZE, len(sup_list))}/{len(sup_list)}")

    # Insert comments
    if comments_batch:
        print(f"\n插入 {len(comments_batch)} 条评论...")
        for batch_start in range(0, len(comments_batch), BATCH_SIZE):
            batch = comments_batch[batch_start:batch_start + BATCH_SIZE]
            session.bulk_insert_mappings(Comment, batch)
            session.commit()
            print(f"  评论: {min(batch_start + BATCH_SIZE, len(comments_batch))}/{len(comments_batch)}")

    # Insert ratings — need to handle unique constraint (user_id, supervisor_id)
    # Since multiple comments can be for same supervisor, we need to aggregate
    if ratings_batch:
        # Group ratings by supervisor_id, keep only one per supervisor
        print(f"\n处理评分（合并同导师多条评分）...")
        by_supervisor = defaultdict(list)
        for r in ratings_batch:
            by_supervisor[str(r['supervisor_id'])].append(r)

        final_ratings = []
        for sup_id, rlist in by_supervisor.items():
            # Average all ratings for this supervisor
            avg_overall = sum(float(r['overall_score']) for r in rlist) / len(rlist)
            # Use dimension scores from first entry that has them
            best = rlist[0]
            for r in rlist:
                if r.get('score_academic') is not None:
                    best = r
                    break

            final_ratings.append({
                'id': uuid.uuid4(),
                'user_id': system_user_id,
                'supervisor_id': uuid.UUID(sup_id) if isinstance(sup_id, str) else sup_id,
                'is_verified_rating': False,
                'overall_score': to_decimal(avg_overall),
                'score_academic': best.get('score_academic'),
                'score_mentoring': best.get('score_mentoring'),
                'score_wellbeing': best.get('score_wellbeing'),
                'score_stipend': None,
                'score_resources': best.get('score_resources'),
                'score_ethics': None,
                'upvotes': 0,
                'downvotes': 0,
            })

        print(f"  合并后评分: {len(final_ratings)} 条（从 {len(ratings_batch)} 条原始评分）")

        for batch_start in range(0, len(final_ratings), BATCH_SIZE):
            batch = final_ratings[batch_start:batch_start + BATCH_SIZE]
            session.bulk_insert_mappings(Rating, batch)
            session.commit()
            print(f"  评分: {min(batch_start + BATCH_SIZE, len(final_ratings))}/{len(final_ratings)}")

        # Update supervisor aggregate scores
        print("\n更新导师聚合评分...")
        session.execute(text("""
            UPDATE supervisors s SET
                avg_overall_score = sub.avg_score,
                rating_count = sub.cnt
            FROM (
                SELECT supervisor_id,
                       AVG(overall_score) as avg_score,
                       COUNT(*) as cnt
                FROM ratings
                GROUP BY supervisor_id
            ) sub
            WHERE s.id = sub.supervisor_id
        """))
        session.commit()
        print("  聚合评分更新完成")

    session.close()
    print(f"\n完成！共导入 {stats['comments_created']} 条评论, {len(final_ratings) if ratings_batch else 0} 条评分")
    return stats


# ─────────────────────────────────────────────
# Save normalized data
# ─────────────────────────────────────────────

def save_normalized(records: list[dict]):
    """Save normalized combined data to JSON."""
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = NORMALIZED_DIR / "combined.json"

    # Convert to serializable format
    serializable = []
    for r in records:
        serializable.append({
            'source': r['source'],
            'school': r['school'],
            'department': r['department'],
            'supervisor_name': r['supervisor_name'],
            'description': r['description'],
            'overall_score': r['overall_score'],
            'score_academic': r.get('score_academic'),
            'score_mentoring': r.get('score_mentoring'),
            'score_wellbeing': r.get('score_wellbeing'),
            'score_resources': r.get('score_resources'),
            'date': r.get('date', ''),
        })

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(serializable, f, ensure_ascii=False, indent=2)

    print(f"\n已保存归一化数据: {out_path} ({len(serializable)} 条)")


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="从开源社区导入历史评价数据")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="PostgreSQL 连接字符串")
    parser.add_argument("--dry-run", action="store_true", help="模拟运行，不写入数据库")
    parser.add_argument("--reset", action="store_true", help="先删除已导入的历史数据")
    args = parser.parse_args()

    print("=" * 60)
    print("GradChoice 外部数据导入")
    print("=" * 60)

    # Load data from all sources
    urfire = load_urfire()
    comments = load_comments_data()
    yankong = load_yankong()

    # Combine and deduplicate
    combined = combine_and_dedup(urfire, comments, yankong)

    if len(combined) < 100:
        print(f"\n⚠ 总数据量不足 100 条 ({len(combined)})，不导入数据库")
        save_normalized(combined)
        return

    # Save normalized data
    save_normalized(combined)

    # Seed database
    print(f"\n{'[模拟运行] ' if args.dry_run else ''}开始导入数据库...")
    seed_data(combined, args.db_url, dry_run=args.dry_run, reset=args.reset)

    # School distribution
    school_counts = Counter(r['school'] for r in combined)
    print(f"\n数据分布 (前20所院校):")
    for school, cnt in school_counts.most_common(20):
        print(f"  {school}: {cnt} 条评论")
    print(f"  ...共 {len(school_counts)} 所院校")


if __name__ == "__main__":
    main()
