#!/usr/bin/env python3
"""
seed_mock.py — 生成模拟用户、评分、评论、聊天数据，用于测试分析图表和可视化

用法:
    cd backend
    SECRET_KEY=xxx python3 seed_mock.py [--db-url URL] [--dry-run] [--reset]

选项:
    --db-url   PostgreSQL 连接字符串（默认从 DATABASE_URL 环境变量读取）
    --dry-run  模拟运行，不写入数据库
    --reset    先删除已生成的模拟数据（email 含 mock 标识的用户及其级联数据）

生成规模:
    - 200 模拟用户（含 .edu.cn 邮箱自动验证）
    - ~3000 评分，分布在 500 位导师（含时间趋势）
    - ~4000 评论（含回复、投票）
    - ~150 聊天，每个聊天含 3-15 条消息
"""

import argparse
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).parent))

from app.models.user import User, VerificationType  # noqa: E402
from app.models.supervisor import Supervisor  # noqa: E402
from app.models.rating import Rating  # noqa: E402
from app.models.comment import Comment  # noqa: E402
from app.models.chat import Chat, ChatMessage  # noqa: E402

try:
    from passlib.context import CryptContext
    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash_password(pw: str) -> str:
        return _pwd_ctx.hash(pw)

except Exception:
    import hashlib

    def hash_password(pw: str) -> str:  # type: ignore[misc]
        return hashlib.sha256(pw.encode()).hexdigest()


# ─────────────────────────────────────────────
# Corpus
# ─────────────────────────────────────────────

SURNAMES = [
    "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
]
GIVEN_NAMES = [
    "子涵", "宇轩", "浩然", "思远", "雨晴", "诗涵", "若曦", "梓萱",
    "睿泽", "晓峰", "嘉宝", "欣悦", "明轩", "文博", "雅琪", "心悦",
    "俊杰", "紫薇", "天翔", "梦琪", "志远", "芷涵", "宸宇", "雅楠",
    "昊天", "婉婷", "泽宇", "静怡", "弘毅", "乐瑶", "鸿儒", "冰清",
]

EDU_DOMAINS = [
    "stu.pku.edu.cn", "mail.tsinghua.edu.cn", "student.fudan.edu.cn",
    "zju.edu.cn", "stu.hit.edu.cn", "mail.ustc.edu.cn",
    "sjtu.edu.cn", "stu.nju.edu.cn", "student.whu.edu.cn",
    "mail.sysu.edu.cn", "stu.xjtu.edu.cn", "student.hust.edu.cn",
    "mail.buaa.edu.cn", "stu.bit.edu.cn", "student.bnu.edu.cn",
    "mail.nankai.edu.cn", "stu.sdu.edu.cn", "student.csu.edu.cn",
    "mail.dlut.edu.cn", "stu.jlu.edu.cn",
]

POSITIVE_COMMENTS = [
    "导师非常认真负责，经常一对一讨论研究进展，受益匪浅。",
    "科研氛围很好，实验室经费充足，导师给了很大的自由度。",
    "导师人品很好，从不压榨学生，周末不要求坐班。",
    "每周组会有实质性反馈，导师对论文修改非常细致。",
    "发表文章支持力度大，帮忙联系审稿人和推荐信。",
    "导师在业界人脉广，推荐就业非常给力。",
    "对学生生活也很关心，逢年过节会发红包。",
    "科研方向前沿，发顶刊概率很高。",
    "经费充足，仪器设备一流，实验条件很好。",
    "导师亲自指导实验，不是甩手掌柜。",
    "组里学长学姐都很nice，整体氛围融洽。",
    "导师鼓励参加国际会议，报销费用没有问题。",
    "毕业要求合理，按时毕业基本没问题。",
    "导师英语很好，经常和学生讨论英文文献。",
    "推荐信质量很高，几个师兄都顺利出国读博。",
]

NEGATIVE_COMMENTS = [
    "压力很大，几乎没有个人时间，慎重考虑。",
    "经费不足，做实验需要自己想办法。",
    "导师不太管学生，需要很强的自驱力。",
    "毕业年限偏长，了解清楚再决定。",
    "组会批评比较严厉，心理素质弱的同学注意。",
    "方向较老，顶刊发表难度大。",
    "导师比较忙，一个月见不了几次面。",
    "横向项目多，有时会占用科研时间。",
    "薪资偏低，生活质量一般。",
    "导师要求严格，小论文没完成不给开题。",
]

NEUTRAL_COMMENTS = [
    "中规中矩，适合踏实做事的同学。",
    "导师人品没问题，科研方向一般。",
    "需要一定的主动性，被动型的同学可能不太适合。",
    "实验室氛围还行，没有太多内卷。",
    "整体来说还不错，就是课题组人数偏少。",
    "导师比较严格，但学到的东西确实多。",
    "建议提前联系导师聊一聊，看看是否合适。",
]

CHAT_MESSAGES_INITIATOR = [
    "你好，请问你在{}组吗？想多了解一下这位导师。",
    "请问你跟{}老师读博几年了？有什么经验可以分享吗？",
    "你好！看到你评价了{}老师，想多咨询一下。",
    "你好，我在考虑报{}老师的课题组，可以聊聊吗？",
    "请问{}老师对学生的要求严不严？",
]

CHAT_MESSAGES_RECIPIENT = [
    "你好！有什么想了解的直接问吧。",
    "当然可以，你有什么问题？",
    "可以的，我在这个组已经两年了。",
    "我知道一些，你想了解哪方面？",
    "没问题，有什么想聊的都行。",
]

CHAT_FOLLOW_UPS = [
    "感谢分享！那经费方面怎么样？",
    "那导师管不管学生的日常打卡？",
    "了解了，请问毕业要求是什么？",
    "好的，那平时组会频率是多少？",
    "谢谢！那发顶刊的机会大吗？",
    "明白了，那导师对学生的就业支持怎么样？",
    "原来如此，那你觉得选这位导师值得吗？",
    "谢谢你的建议！我会认真考虑的。",
    "太感谢了，你给我很多帮助！",
    "了解，我会提前联系导师聊聊的。",
]

REPLY_COMMENTS = [
    "同意楼上，确实是这样的体验。",
    "补充一点，导师在xx方向特别强。",
    "我也有类似的感受，总体推荐。",
    "不太一样，我这届体验稍差一些。",
    "谢谢分享！很有参考价值。",
    "这个信息很重要，提前了解到了。",
    "赞同，进组前一定要多了解。",
]


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

MOCK_MARKER = "@mock."  # appears in email to identify mock users


def random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    seconds = int(delta.total_seconds())
    return start + timedelta(seconds=random.randint(0, seconds))


def skewed_score(mean: float, std: float = 0.6) -> float:
    """Generate a score skewed toward mean, clamped [1, 5]."""
    score = random.gauss(mean, std)
    return round(max(1.0, min(5.0, score)), 2)


def make_display_name() -> str:
    surname = random.choice(SURNAMES)
    given = random.choice(GIVEN_NAMES)
    return surname + given


def make_email(display_name: str, idx: int) -> str:
    domain = random.choice(EDU_DOMAINS)
    return f"mock_user_{idx:04d}@mock.{domain}"


# ─────────────────────────────────────────────
# Seeder
# ─────────────────────────────────────────────

NUM_USERS = 200
NUM_SUPERVISORS_TO_RATE = 500  # supervisors that get ratings
RATINGS_PER_SUPERVISOR_RANGE = (3, 12)  # min/max ratings per supervisor
COMMENTS_PER_SUPERVISOR_RANGE = (2, 10)
REPLY_PROBABILITY = 0.35
VOTE_PROBABILITY = 0.5
NUM_CHATS = 150
MESSAGES_PER_CHAT_RANGE = (3, 15)

# Date range: last 18 months (for trend data)
NOW = datetime.now(timezone.utc)
DATE_START = NOW - timedelta(days=540)


def seed(db_url: str, dry_run: bool, reset: bool):
    engine = create_engine(db_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()

    if reset:
        print("删除已有模拟数据（email 含 @mock. 的用户及其级联数据）...")
        if not dry_run:
            session.execute(
                text("DELETE FROM users WHERE email LIKE '%@mock.%'")
            )
            session.commit()
            # Recalculate supervisor stats after cascade-deleting ratings
            session.execute(text("""
                UPDATE supervisors s
                SET
                    avg_overall_score = sub.avg_score,
                    rating_count = sub.cnt
                FROM (
                    SELECT supervisor_id,
                           ROUND(AVG(overall_score)::numeric, 2) AS avg_score,
                           COUNT(*) AS cnt
                    FROM ratings
                    GROUP BY supervisor_id
                ) sub
                WHERE s.id = sub.supervisor_id
            """))
            # Zero out supervisors that now have no ratings
            session.execute(text("""
                UPDATE supervisors
                SET avg_overall_score = NULL, rating_count = 0
                WHERE id NOT IN (SELECT DISTINCT supervisor_id FROM ratings)
                  AND rating_count > 0
            """))
            # Rebuild supervisor_rating_cache for supervisors that still have ratings
            try:
                session.execute(text("""
                    DELETE FROM supervisor_rating_cache
                    WHERE supervisor_id NOT IN (SELECT DISTINCT supervisor_id FROM ratings)
                """))
                session.execute(text("""
                    INSERT INTO supervisor_rating_cache (
                        supervisor_id,
                        all_avg_overall, all_avg_academic, all_avg_mentoring,
                        all_avg_wellbeing, all_avg_stipend, all_avg_resources, all_avg_ethics,
                        verified_avg_overall, verified_avg_academic, verified_avg_mentoring,
                        verified_avg_wellbeing, verified_avg_stipend, verified_avg_resources, verified_avg_ethics,
                        all_count, verified_count,
                        distribution_1, distribution_2, distribution_3, distribution_4, distribution_5,
                        updated_at
                    )
                    SELECT
                        supervisor_id,
                        ROUND(AVG(overall_score)::numeric, 2),
                        ROUND(AVG(score_academic)::numeric, 2),
                        ROUND(AVG(score_mentoring)::numeric, 2),
                        ROUND(AVG(score_wellbeing)::numeric, 2),
                        ROUND(AVG(score_stipend)::numeric, 2),
                        ROUND(AVG(score_resources)::numeric, 2),
                        ROUND(AVG(score_ethics)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN overall_score END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_academic END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_mentoring END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_wellbeing END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_stipend END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_resources END)::numeric, 2),
                        ROUND(AVG(CASE WHEN is_verified_rating THEN score_ethics END)::numeric, 2),
                        COUNT(*),
                        SUM(CASE WHEN is_verified_rating THEN 1 ELSE 0 END),
                        SUM(CASE WHEN overall_score < 1.5 THEN 1 ELSE 0 END),
                        SUM(CASE WHEN overall_score >= 1.5 AND overall_score < 2.5 THEN 1 ELSE 0 END),
                        SUM(CASE WHEN overall_score >= 2.5 AND overall_score < 3.5 THEN 1 ELSE 0 END),
                        SUM(CASE WHEN overall_score >= 3.5 AND overall_score < 4.5 THEN 1 ELSE 0 END),
                        SUM(CASE WHEN overall_score >= 4.5 THEN 1 ELSE 0 END),
                        NOW()
                    FROM ratings
                    GROUP BY supervisor_id
                    ON CONFLICT (supervisor_id) DO UPDATE SET
                        all_avg_overall       = EXCLUDED.all_avg_overall,
                        all_avg_academic      = EXCLUDED.all_avg_academic,
                        all_avg_mentoring     = EXCLUDED.all_avg_mentoring,
                        all_avg_wellbeing     = EXCLUDED.all_avg_wellbeing,
                        all_avg_stipend       = EXCLUDED.all_avg_stipend,
                        all_avg_resources     = EXCLUDED.all_avg_resources,
                        all_avg_ethics        = EXCLUDED.all_avg_ethics,
                        verified_avg_overall  = EXCLUDED.verified_avg_overall,
                        verified_avg_academic = EXCLUDED.verified_avg_academic,
                        verified_avg_mentoring= EXCLUDED.verified_avg_mentoring,
                        verified_avg_wellbeing= EXCLUDED.verified_avg_wellbeing,
                        verified_avg_stipend  = EXCLUDED.verified_avg_stipend,
                        verified_avg_resources= EXCLUDED.verified_avg_resources,
                        verified_avg_ethics   = EXCLUDED.verified_avg_ethics,
                        all_count             = EXCLUDED.all_count,
                        verified_count        = EXCLUDED.verified_count,
                        distribution_1        = EXCLUDED.distribution_1,
                        distribution_2        = EXCLUDED.distribution_2,
                        distribution_3        = EXCLUDED.distribution_3,
                        distribution_4        = EXCLUDED.distribution_4,
                        distribution_5        = EXCLUDED.distribution_5,
                        updated_at            = EXCLUDED.updated_at
                """))
            except Exception as e:
                session.rollback()
                print(f"  (supervisor_rating_cache 清理跳过: {e})")
            session.commit()
        print("  清理完成。")
        session.close()
        return

    # ── 1. Load random supervisors ───────────────────────────────────────
    print(f"从数据库随机抽取 {NUM_SUPERVISORS_TO_RATE} 位导师...")
    rows = session.execute(
        text(
            "SELECT id, name FROM supervisors ORDER BY RANDOM() LIMIT :n"
        ),
        {"n": NUM_SUPERVISORS_TO_RATE},
    ).fetchall()
    supervisor_ids = [row[0] for row in rows]
    supervisor_names = {row[0]: row[1] for row in rows}
    print(f"  抽取到 {len(supervisor_ids)} 位导师")

    if not supervisor_ids:
        print("[错误] 数据库中没有导师数据，请先运行 seed_tutors.py")
        session.close()
        sys.exit(1)

    # ── 2. Create mock users ─────────────────────────────────────────────
    print(f"\n生成 {NUM_USERS} 名模拟用户...")
    users: list[User] = []
    for i in range(NUM_USERS):
        name = make_display_name()
        email = make_email(name, i)
        created = random_date(DATE_START, NOW)
        u = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hash_password("mock_password_123"),
            display_name=name,
            is_email_verified=True,
            is_student_verified=True,
            verification_type=VerificationType.email_edu,
            school_email=email,
            school_email_verified=True,
            created_at=created,
            updated_at=created,
        )
        users.append(u)

    if not dry_run:
        session.bulk_save_objects(users)
        session.commit()
    print(f"  创建 {len(users)} 名用户")

    if dry_run:
        print("[模拟运行] 跳过写入，退出。")
        session.close()
        return

    # Reload user objects with IDs
    db_users = session.execute(
        text("SELECT id FROM users WHERE email LIKE '%@mock.%'")
    ).fetchall()
    user_ids = [row[0] for row in db_users]
    print(f"  数据库中确认 {len(user_ids)} 名模拟用户")

    # ── 3. Create ratings ────────────────────────────────────────────────
    print("\n生成评分数据...")

    # Assign each supervisor a "personality" (mean scores)
    sup_profiles: dict = {}
    for sid in supervisor_ids:
        base = random.uniform(2.5, 4.8)
        sup_profiles[sid] = {
            "academic":  skewed_score(base, 0.4),
            "mentoring": skewed_score(base, 0.5),
            "wellbeing": skewed_score(base, 0.6),
            "stipend":   skewed_score(base, 0.7),
            "resources": skewed_score(base, 0.4),
            "ethics":    skewed_score(base, 0.3),
        }

    ratings: list[dict] = []
    # Track which (user, supervisor) pairs already have a rating
    used_pairs: set = set()

    for sid in supervisor_ids:
        profile = sup_profiles[sid]
        n_ratings = random.randint(*RATINGS_PER_SUPERVISOR_RANGE)
        raters = random.sample(user_ids, min(n_ratings, len(user_ids)))

        for uid in raters:
            pair = (uid, sid)
            if pair in used_pairs:
                continue
            used_pairs.add(pair)

            academic  = skewed_score(profile["academic"],  0.4)
            mentoring = skewed_score(profile["mentoring"], 0.5)
            wellbeing = skewed_score(profile["wellbeing"], 0.6)
            stipend   = skewed_score(profile["stipend"],   0.7)
            resources = skewed_score(profile["resources"], 0.4)
            ethics    = skewed_score(profile["ethics"],    0.3)
            overall   = round(
                (academic + mentoring + wellbeing + stipend + resources + ethics) / 6, 2
            )

            created = random_date(DATE_START, NOW)
            rating_id = uuid.uuid4()
            ratings.append({
                "id": rating_id,
                "user_id": uid,
                "supervisor_id": sid,
                "is_verified_rating": True,
                "overall_score": overall,
                "score_academic":  academic,
                "score_mentoring": mentoring,
                "score_wellbeing": wellbeing,
                "score_stipend":   stipend,
                "score_resources": resources,
                "score_ethics":    ethics,
                "upvotes":   random.randint(0, 20),
                "downvotes": random.randint(0, 5),
                "created_at": created,
                "updated_at": created,
            })

    # Batch insert ratings
    BATCH = 500
    for i in range(0, len(ratings), BATCH):
        session.bulk_insert_mappings(Rating, ratings[i:i + BATCH])
        session.commit()
        print(f"  已插入评分 {min(i + BATCH, len(ratings))}/{len(ratings)}")

    print(f"  共生成 {len(ratings)} 条评分")

    # ── 4. Update supervisor cache columns ───────────────────────────────
    print("\n更新导师缓存列（avg_overall_score, rating_count）...")
    session.execute(text("""
        UPDATE supervisors s
        SET
            avg_overall_score = sub.avg_score,
            rating_count = sub.cnt
        FROM (
            SELECT supervisor_id,
                   ROUND(AVG(overall_score)::numeric, 2) AS avg_score,
                   COUNT(*) AS cnt
            FROM ratings
            GROUP BY supervisor_id
        ) sub
        WHERE s.id = sub.supervisor_id
    """))
    session.commit()
    print("  缓存更新完成")

    # ── 5. Also update supervisor_rating_cache if it exists ─────────────
    try:
        session.execute(text("""
            INSERT INTO supervisor_rating_cache (
                supervisor_id,
                all_avg_overall, all_avg_academic, all_avg_mentoring,
                all_avg_wellbeing, all_avg_stipend, all_avg_resources, all_avg_ethics,
                verified_avg_overall, verified_avg_academic, verified_avg_mentoring,
                verified_avg_wellbeing, verified_avg_stipend, verified_avg_resources, verified_avg_ethics,
                all_count, verified_count,
                distribution_1, distribution_2, distribution_3, distribution_4, distribution_5,
                updated_at
            )
            SELECT
                supervisor_id,
                ROUND(AVG(overall_score)::numeric, 2),
                ROUND(AVG(score_academic)::numeric, 2),
                ROUND(AVG(score_mentoring)::numeric, 2),
                ROUND(AVG(score_wellbeing)::numeric, 2),
                ROUND(AVG(score_stipend)::numeric, 2),
                ROUND(AVG(score_resources)::numeric, 2),
                ROUND(AVG(score_ethics)::numeric, 2),
                -- verified only (all mock ratings are verified)
                ROUND(AVG(overall_score)::numeric, 2),
                ROUND(AVG(score_academic)::numeric, 2),
                ROUND(AVG(score_mentoring)::numeric, 2),
                ROUND(AVG(score_wellbeing)::numeric, 2),
                ROUND(AVG(score_stipend)::numeric, 2),
                ROUND(AVG(score_resources)::numeric, 2),
                ROUND(AVG(score_ethics)::numeric, 2),
                COUNT(*),
                SUM(CASE WHEN is_verified_rating THEN 1 ELSE 0 END),
                -- score distribution buckets 1-5
                SUM(CASE WHEN overall_score < 1.5 THEN 1 ELSE 0 END),
                SUM(CASE WHEN overall_score >= 1.5 AND overall_score < 2.5 THEN 1 ELSE 0 END),
                SUM(CASE WHEN overall_score >= 2.5 AND overall_score < 3.5 THEN 1 ELSE 0 END),
                SUM(CASE WHEN overall_score >= 3.5 AND overall_score < 4.5 THEN 1 ELSE 0 END),
                SUM(CASE WHEN overall_score >= 4.5 THEN 1 ELSE 0 END),
                NOW()
            FROM ratings
            WHERE supervisor_id = ANY(
                SELECT supervisor_id FROM ratings
                WHERE user_id IN (
                    SELECT id FROM users WHERE email LIKE '%@mock.%'
                )
            )
            GROUP BY supervisor_id
            ON CONFLICT (supervisor_id) DO UPDATE SET
                all_avg_overall      = EXCLUDED.all_avg_overall,
                all_avg_academic     = EXCLUDED.all_avg_academic,
                all_avg_mentoring    = EXCLUDED.all_avg_mentoring,
                all_avg_wellbeing    = EXCLUDED.all_avg_wellbeing,
                all_avg_stipend      = EXCLUDED.all_avg_stipend,
                all_avg_resources    = EXCLUDED.all_avg_resources,
                all_avg_ethics       = EXCLUDED.all_avg_ethics,
                verified_avg_overall  = EXCLUDED.verified_avg_overall,
                verified_avg_academic = EXCLUDED.verified_avg_academic,
                verified_avg_mentoring= EXCLUDED.verified_avg_mentoring,
                verified_avg_wellbeing= EXCLUDED.verified_avg_wellbeing,
                verified_avg_stipend  = EXCLUDED.verified_avg_stipend,
                verified_avg_resources= EXCLUDED.verified_avg_resources,
                verified_avg_ethics   = EXCLUDED.verified_avg_ethics,
                all_count            = EXCLUDED.all_count,
                verified_count       = EXCLUDED.verified_count,
                distribution_1       = EXCLUDED.distribution_1,
                distribution_2       = EXCLUDED.distribution_2,
                distribution_3       = EXCLUDED.distribution_3,
                distribution_4       = EXCLUDED.distribution_4,
                distribution_5       = EXCLUDED.distribution_5,
                updated_at           = EXCLUDED.updated_at
        """))
        session.commit()
        print("  supervisor_rating_cache 已更新")
    except Exception as e:
        session.rollback()
        print(f"  (跳过 supervisor_rating_cache: {e})")

    # ── 6. Create comments ───────────────────────────────────────────────
    print("\n生成评论数据...")
    # Supervisors that now have ratings
    rated_sids = list({r["supervisor_id"] for r in ratings})
    comments_inserted: list[dict] = []

    for sid in rated_sids:
        n_comments = random.randint(*COMMENTS_PER_SUPERVISOR_RANGE)
        commenters = random.sample(user_ids, min(n_comments, len(user_ids)))

        parent_comment_ids: list[uuid.UUID] = []

        for uid in commenters:
            # Pick comment text based on supervisor profile
            mean_score = sum(sup_profiles[sid].values()) / len(sup_profiles[sid])
            if mean_score >= 3.8:
                pool = POSITIVE_COMMENTS + NEUTRAL_COMMENTS
            elif mean_score <= 2.8:
                pool = NEGATIVE_COMMENTS + NEUTRAL_COMMENTS
            else:
                pool = NEUTRAL_COMMENTS + POSITIVE_COMMENTS[:5] + NEGATIVE_COMMENTS[:5]

            content = random.choice(pool)
            created = random_date(DATE_START, NOW)
            cid = uuid.uuid4()
            likes = random.randint(0, 30)
            dislikes = random.randint(0, 5)

            comments_inserted.append({
                "id": cid,
                "user_id": uid,
                "supervisor_id": sid,
                "parent_comment_id": None,
                "content": content,
                "likes_count": likes,
                "dislikes_count": dislikes,
                "is_flagged": False,
                "is_deleted": False,
                "is_edited": False,
                "flag_count": 0,
                "created_at": created,
                "updated_at": created,
            })
            parent_comment_ids.append(cid)

        # Add replies
        for parent_id in parent_comment_ids:
            if random.random() < REPLY_PROBABILITY:
                uid = random.choice(user_ids)
                created = random_date(DATE_START, NOW)
                cid = uuid.uuid4()
                comments_inserted.append({
                    "id": cid,
                    "user_id": uid,
                    "supervisor_id": sid,
                    "parent_comment_id": parent_id,
                    "content": random.choice(REPLY_COMMENTS),
                    "likes_count": random.randint(0, 10),
                    "dislikes_count": random.randint(0, 2),
                    "is_flagged": False,
                    "is_deleted": False,
                    "is_edited": False,
                    "flag_count": 0,
                    "created_at": created,
                    "updated_at": created,
                })

    for i in range(0, len(comments_inserted), BATCH):
        session.bulk_insert_mappings(Comment, comments_inserted[i:i + BATCH])
        session.commit()
        print(f"  已插入评论 {min(i + BATCH, len(comments_inserted))}/{len(comments_inserted)}")

    print(f"  共生成 {len(comments_inserted)} 条评论")

    # ── 7. Create chats ──────────────────────────────────────────────────
    print(f"\n生成 {NUM_CHATS} 个聊天会话...")
    chats_inserted: list[dict] = []
    messages_inserted: list[dict] = []

    used_chat_pairs: set = set()

    for _ in range(NUM_CHATS):
        # Pick two different users
        uid1, uid2 = random.sample(user_ids, 2)
        pair = (min(str(uid1), str(uid2)), max(str(uid1), str(uid2)))
        if pair in used_chat_pairs:
            continue
        used_chat_pairs.add(pair)

        sup_id = random.choice(supervisor_ids) if random.random() < 0.7 else None
        sup_name = supervisor_names.get(sup_id, "某位导师") if sup_id else "某位导师"
        chat_id = uuid.uuid4()
        chat_created = random_date(DATE_START, NOW)

        chats_inserted.append({
            "id": chat_id,
            "initiator_id": uid1,
            "recipient_id": uid2,
            "supervisor_id": sup_id,
            "created_at": chat_created,
        })

        # Generate messages
        n_messages = random.randint(*MESSAGES_PER_CHAT_RANGE)
        msg_time = chat_created
        turn = 0  # 0 = initiator, 1 = recipient

        for _ in range(n_messages):
            msg_time += timedelta(minutes=random.randint(1, 120))
            if msg_time > NOW:
                msg_time = NOW

            sender_id = uid1 if turn == 0 else uid2

            if turn == 0 and _ == 0:
                # First message from initiator
                content = random.choice(CHAT_MESSAGES_INITIATOR).format(sup_name)
            elif turn == 1 and _ == 1:
                content = random.choice(CHAT_MESSAGES_RECIPIENT)
            else:
                content = random.choice(CHAT_FOLLOW_UPS)

            is_read = msg_time < NOW - timedelta(hours=1)

            messages_inserted.append({
                "id": uuid.uuid4(),
                "chat_id": chat_id,
                "sender_id": sender_id,
                "content": content,
                "is_read": is_read,
                "read_at": msg_time + timedelta(minutes=5) if is_read else None,
                "created_at": msg_time,
            })
            turn = 1 - turn

    for i in range(0, len(chats_inserted), BATCH):
        session.bulk_insert_mappings(Chat, chats_inserted[i:i + BATCH])
        session.commit()

    for i in range(0, len(messages_inserted), BATCH):
        session.bulk_insert_mappings(ChatMessage, messages_inserted[i:i + BATCH])
        session.commit()

    print(f"  共生成 {len(chats_inserted)} 个聊天，{len(messages_inserted)} 条消息")

    # ── 8. Summary ───────────────────────────────────────────────────────
    print("\n─────────────── 完成 ───────────────")
    print(f"用户: {len(users)}")
    print(f"评分: {len(ratings)}")
    print(f"评论: {len(comments_inserted)}")
    print(f"聊天: {len(chats_inserted)},  消息: {len(messages_inserted)}")
    print(f"涉及导师: {len(rated_sids)}")

    session.close()


# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice",
)


def main():
    parser = argparse.ArgumentParser(description="生成模拟数据")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="先清除已有模拟数据，不生成新数据",
    )
    args = parser.parse_args()
    seed(args.db_url, args.dry_run, args.reset)


if __name__ == "__main__":
    main()
