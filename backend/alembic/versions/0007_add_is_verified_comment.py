"""Add is_verified_comment to comments table

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column(
            "is_verified_comment",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("comments", "is_verified_comment")
