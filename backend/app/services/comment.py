"""
Comment service: business logic for comments, voting, and flagging.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentVote, VoteType
from app.models.flag import CommentFlag, FlagReason
from app.schemas.comment import CommentAuthor, CommentResponse

# Auto-hide threshold: hide comment if flagged by this many unique users
FLAG_THRESHOLD = 3

# Rate limit: max comments per user per day
DAILY_COMMENT_LIMIT = 20

# Edit window: can only edit within this many hours of posting
EDIT_WINDOW_HOURS = 24


def get_daily_comment_count(user_id: uuid.UUID, db: Session) -> int:
    """Count how many comments this user has posted today (UTC)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Remove tzinfo for comparison with naive datetimes in DB
    today_start_naive = today_start.replace(tzinfo=None)
    return (
        db.query(Comment)
        .filter(
            Comment.user_id == user_id,
            Comment.created_at >= today_start_naive,
            Comment.is_deleted == False,  # noqa: E712
        )
        .count()
    )


def get_user_vote(comment_id: uuid.UUID, user_id: uuid.UUID | None, db: Session) -> VoteType | None:
    """Return the current user's vote on a comment, or None."""
    if user_id is None:
        return None
    vote = (
        db.query(CommentVote)
        .filter(CommentVote.comment_id == comment_id, CommentVote.user_id == user_id)
        .first()
    )
    return vote.vote_type if vote else None


def build_comment_response(
    comment: Comment,
    current_user_id: uuid.UUID | None,
    db: Session,
    depth: int = 0,
    max_depth: int = 2,
) -> CommentResponse:
    """Build a CommentResponse from an ORM Comment, including nested replies up to max_depth."""
    user_vote = get_user_vote(comment.id, current_user_id, db)

    # Sanitize content: if deleted, replace content
    display_content = "(该评论已删除)" if comment.is_deleted else comment.content

    # Build author info (always anonymous — never expose email)
    author = None
    if comment.user and not comment.is_deleted:
        author = CommentAuthor(
            id=comment.user.id,
            display_name=comment.user.display_name,
            is_student_verified=comment.user.is_student_verified,
        )

    # Build replies (up to max_depth levels)
    replies: list[CommentResponse] = []
    if depth < max_depth:
        for reply in sorted(comment.replies, key=lambda r: r.created_at):
            replies.append(
                build_comment_response(reply, current_user_id, db, depth + 1, max_depth)
            )

    reply_count = len(comment.replies)

    return CommentResponse(
        id=comment.id,
        supervisor_id=comment.supervisor_id,
        parent_comment_id=comment.parent_comment_id,
        content=display_content,
        is_deleted=comment.is_deleted,
        is_edited=comment.is_edited,
        likes_count=comment.likes_count,
        dislikes_count=comment.dislikes_count,
        is_flagged=comment.is_flagged,
        user_vote=user_vote,
        reply_count=reply_count,
        author=author,
        replies=replies,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def update_vote_counts(comment: Comment, db: Session) -> None:
    """Recalculate denormalized likes/dislikes counts from the votes table."""
    likes = db.query(CommentVote).filter(
        CommentVote.comment_id == comment.id,
        CommentVote.vote_type == VoteType.up,
    ).count()
    dislikes = db.query(CommentVote).filter(
        CommentVote.comment_id == comment.id,
        CommentVote.vote_type == VoteType.down,
    ).count()
    comment.likes_count = likes
    comment.dislikes_count = dislikes
    db.flush()


def apply_flag(
    comment: Comment,
    reporter_id: uuid.UUID,
    reason: FlagReason,
    detail: str | None,
    db: Session,
) -> CommentFlag:
    """Add a flag record and auto-moderate if threshold exceeded."""
    flag = CommentFlag(
        comment_id=comment.id,
        reporter_id=reporter_id,
        reason=reason,
        detail=detail,
    )
    db.add(flag)
    db.flush()

    # Update denormalized flag count
    comment.flag_count = db.query(CommentFlag).filter(
        CommentFlag.comment_id == comment.id
    ).count()

    # Auto-hide if threshold reached
    if comment.flag_count >= FLAG_THRESHOLD:
        comment.is_flagged = True

    db.flush()
    return flag


def can_edit(comment: Comment) -> bool:
    """Check whether the comment is still within the edit window."""
    age = datetime.utcnow() - comment.created_at
    return age <= timedelta(hours=EDIT_WINDOW_HOURS)
