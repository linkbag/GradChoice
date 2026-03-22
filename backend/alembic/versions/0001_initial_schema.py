"""Initial schema: all base tables with pg_trgm and supervisor_rating_cache

Combined from gc-supervisors (pg_trgm GIN indexes) and gc-ratings
(supervisor_rating_cache, upvotes/downvotes on ratings).

Revision ID: 0001
Revises:
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pg_trgm for fuzzy text search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("is_email_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_student_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "verification_type",
            sa.Enum("none", "email_edu", "student_id", name="verificationtype"),
            nullable=False,
            server_default="none",
        ),
        sa.Column("student_id_file_path", sa.String(500), nullable=True),
        sa.Column("email_notifications_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- supervisors ---
    op.create_table(
        "supervisors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("school_code", sa.String(20), nullable=False),
        sa.Column("school_name", sa.String(200), nullable=False),
        sa.Column("province", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("department", sa.String(300), nullable=False),
        sa.Column("title", sa.String(100), nullable=True),
        sa.Column("affiliated_unit", sa.String(300), nullable=True),
        sa.Column("webpage_url_1", sa.String(500), nullable=True),
        sa.Column("webpage_url_2", sa.String(500), nullable=True),
        sa.Column("webpage_url_3", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("school_code", "name", "department", name="uq_supervisor_school_name_dept"),
    )
    op.create_index("ix_supervisors_school_code", "supervisors", ["school_code"])
    op.create_index("ix_supervisors_school_name", "supervisors", ["school_name"])
    op.create_index("ix_supervisors_name", "supervisors", ["name"])
    # Trigram GIN indexes for fuzzy search (requires pg_trgm extension)
    op.execute("CREATE INDEX ix_supervisors_name_trgm ON supervisors USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX ix_supervisors_school_name_trgm ON supervisors USING gin (school_name gin_trgm_ops)")
    op.execute("CREATE INDEX ix_supervisors_department_trgm ON supervisors USING gin (department gin_trgm_ops)")

    # --- ratings ---
    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_verified_rating", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("overall_score", sa.Numeric(3, 2), nullable=False),
        sa.Column("score_academic", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_mentoring", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_wellbeing", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_stipend", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_resources", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_ethics", sa.Numeric(3, 2), nullable=True),
        sa.Column("upvotes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("downvotes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "supervisor_id", name="uq_rating_user_supervisor"),
    )
    op.create_index("ix_ratings_user_id", "ratings", ["user_id"])
    op.create_index("ix_ratings_supervisor_id", "ratings", ["supervisor_id"])

    # --- rating_votes ---
    op.create_table(
        "rating_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ratings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vote_type", sa.Enum("up", "down", name="votetype"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "rating_id", name="uq_rating_vote_user_rating"),
    )
    op.create_index("ix_rating_votes_user_id", "rating_votes", ["user_id"])
    op.create_index("ix_rating_votes_rating_id", "rating_votes", ["rating_id"])

    # --- supervisor_rating_cache (gc-ratings addition) ---
    op.create_table(
        "supervisor_rating_cache",
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supervisors.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("all_avg_overall", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_academic", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_mentoring", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_wellbeing", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_stipend", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_resources", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_avg_ethics", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_overall", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_academic", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_mentoring", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_wellbeing", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_stipend", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_resources", sa.Numeric(4, 2), nullable=True),
        sa.Column("verified_avg_ethics", sa.Numeric(4, 2), nullable=True),
        sa.Column("all_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("verified_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("distribution_1", sa.Integer, nullable=False, server_default="0"),
        sa.Column("distribution_2", sa.Integer, nullable=False, server_default="0"),
        sa.Column("distribution_3", sa.Integer, nullable=False, server_default="0"),
        sa.Column("distribution_4", sa.Integer, nullable=False, server_default="0"),
        sa.Column("distribution_5", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_supervisor_rating_cache_supervisor_id", "supervisor_rating_cache", ["supervisor_id"])

    # --- comments ---
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("likes_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("dislikes_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_flagged", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_comments_user_id", "comments", ["user_id"])
    op.create_index("ix_comments_supervisor_id", "comments", ["supervisor_id"])
    op.create_index("ix_comments_parent_comment_id", "comments", ["parent_comment_id"])

    # --- comment_votes ---
    op.create_table(
        "comment_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vote_type", sa.Enum("up", "down", name="votetype"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_comment_vote_user_comment"),
    )
    op.create_index("ix_comment_votes_user_id", "comment_votes", ["user_id"])
    op.create_index("ix_comment_votes_comment_id", "comment_votes", ["comment_id"])

    # --- chats ---
    op.create_table(
        "chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("initiator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supervisors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chats_initiator_id", "chats", ["initiator_id"])
    op.create_index("ix_chats_recipient_id", "chats", ["recipient_id"])
    op.create_index("ix_chats_supervisor_id", "chats", ["supervisor_id"])

    # --- chat_messages ---
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"])
    op.create_index("ix_chat_messages_sender_id", "chat_messages", ["sender_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["chat_id", "created_at"])

    # --- edit_proposals ---
    op.create_table(
        "edit_proposals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=True),
        sa.Column("proposed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proposed_data", postgresql.JSONB, nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="proposalstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewer_1_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewer_1_decision", sa.Enum("approve", "reject", name="reviewdecision"), nullable=True),
        sa.Column("reviewer_2_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewer_2_decision", sa.Enum("approve", "reject", name="reviewdecision"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_edit_proposals_supervisor_id", "edit_proposals", ["supervisor_id"])
    op.create_index("ix_edit_proposals_proposed_by", "edit_proposals", ["proposed_by"])
    op.create_index("ix_edit_proposals_status", "edit_proposals", ["status"])


def downgrade() -> None:
    op.drop_table("edit_proposals")
    op.drop_table("chat_messages")
    op.drop_table("chats")
    op.drop_table("comment_votes")
    op.drop_table("comments")
    op.drop_table("supervisor_rating_cache")
    op.drop_table("rating_votes")
    op.drop_table("ratings")
    op.drop_table("supervisors")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS proposalstatus")
    op.execute("DROP TYPE IF EXISTS reviewdecision")
    op.execute("DROP TYPE IF EXISTS votetype")
    op.execute("DROP TYPE IF EXISTS verificationtype")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
