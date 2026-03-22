"""add comment flags table and moderation columns to comments

Revision ID: 0001
Revises:
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add moderation columns to the comments table
    op.add_column("comments", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("comments", sa.Column("is_edited", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("comments", sa.Column("flag_count", sa.Integer(), nullable=False, server_default="0"))

    # 2. Create the comment_flags table
    op.create_table(
        "comment_flags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "comment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reason",
            sa.Enum(
                "虚假信息", "恶意攻击", "垃圾信息", "隐私泄露", "其他",
                name="flagreason",
            ),
            nullable=False,
        ),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("reporter_id", "comment_id", name="uq_comment_flag_reporter_comment"),
    )
    op.create_index("ix_comment_flags_comment_id", "comment_flags", ["comment_id"])
    op.create_index("ix_comment_flags_reporter_id", "comment_flags", ["reporter_id"])


def downgrade() -> None:
    op.drop_index("ix_comment_flags_reporter_id", table_name="comment_flags")
    op.drop_index("ix_comment_flags_comment_id", table_name="comment_flags")
    op.drop_table("comment_flags")
    op.execute("DROP TYPE IF EXISTS flagreason")
    op.drop_column("comments", "flag_count")
    op.drop_column("comments", "is_edited")
    op.drop_column("comments", "is_deleted")
