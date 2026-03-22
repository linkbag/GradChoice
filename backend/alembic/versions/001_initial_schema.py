"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Enums ---
    verificationtype = postgresql.ENUM(
        "none", "email_edu", "student_id", name="verificationtype", create_type=False
    )
    verificationtype.create(op.get_bind(), checkfirst=True)

    votetype = postgresql.ENUM("up", "down", name="votetype", create_type=False)
    votetype.create(op.get_bind(), checkfirst=True)

    proposalstatus = postgresql.ENUM(
        "pending", "approved", "rejected", name="proposalstatus", create_type=False
    )
    proposalstatus.create(op.get_bind(), checkfirst=True)

    reviewdecision = postgresql.ENUM(
        "approve", "reject", name="reviewdecision", create_type=False
    )
    reviewdecision.create(op.get_bind(), checkfirst=True)

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- supervisors ---
    op.create_table(
        "supervisors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_code", "name", "department", name="uq_supervisor_school_name_dept"),
    )
    op.create_index("ix_supervisors_school_code", "supervisors", ["school_code"])
    op.create_index("ix_supervisors_school_name", "supervisors", ["school_name"])
    op.create_index("ix_supervisors_name", "supervisors", ["name"])

    # --- ratings ---
    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_verified_rating", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("overall_score", sa.Numeric(3, 2), nullable=False),
        sa.Column("score_academic", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_mentoring", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_wellbeing", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_stipend", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_resources", sa.Numeric(3, 2), nullable=True),
        sa.Column("score_ethics", sa.Numeric(3, 2), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "supervisor_id", name="uq_rating_user_supervisor"),
    )
    op.create_index("ix_ratings_user_id", "ratings", ["user_id"])
    op.create_index("ix_ratings_supervisor_id", "ratings", ["supervisor_id"])

    # --- rating_votes ---
    op.create_table(
        "rating_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rating_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vote_type", sa.Enum("up", "down", name="votetype"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rating_id"], ["ratings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "rating_id", name="uq_rating_vote_user_rating"),
    )
    op.create_index("ix_rating_votes_user_id", "rating_votes", ["user_id"])
    op.create_index("ix_rating_votes_rating_id", "rating_votes", ["rating_id"])

    # --- supervisor_rating_cache ---
    op.create_table(
        "supervisor_rating_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("supervisor_id"),
    )
    op.create_index("ix_supervisor_rating_cache_supervisor_id", "supervisor_rating_cache", ["supervisor_id"])

    # --- comments ---
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("likes_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("dislikes_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_flagged", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comments_user_id", "comments", ["user_id"])
    op.create_index("ix_comments_supervisor_id", "comments", ["supervisor_id"])
    op.create_index("ix_comments_parent_comment_id", "comments", ["parent_comment_id"])

    # --- comment_votes ---
    op.create_table(
        "comment_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("comment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vote_type", sa.Enum("up", "down", name="votetype"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_comment_vote_user_comment"),
    )
    op.create_index("ix_comment_votes_user_id", "comment_votes", ["user_id"])
    op.create_index("ix_comment_votes_comment_id", "comment_votes", ["comment_id"])

    # --- chats ---
    op.create_table(
        "chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("initiator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["initiator_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chats_initiator_id", "chats", ["initiator_id"])
    op.create_index("ix_chats_recipient_id", "chats", ["recipient_id"])
    op.create_index("ix_chats_supervisor_id", "chats", ["supervisor_id"])

    # --- chat_messages ---
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("read_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"])
    op.create_index("ix_chat_messages_sender_id", "chat_messages", ["sender_id"])

    # --- edit_proposals ---
    op.create_table(
        "edit_proposals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("proposed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("proposed_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="proposalstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewer_1_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "reviewer_1_decision",
            sa.Enum("approve", "reject", name="reviewdecision"),
            nullable=True,
        ),
        sa.Column("reviewer_2_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "reviewer_2_decision",
            sa.Enum("approve", "reject", name="reviewdecision"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proposed_by"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_1_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_2_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
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

    op.execute("DROP TYPE IF EXISTS reviewdecision")
    op.execute("DROP TYPE IF EXISTS proposalstatus")
    op.execute("DROP TYPE IF EXISTS votetype")
    op.execute("DROP TYPE IF EXISTS verificationtype")
