"""Add is_anonymous column to comments

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column(
            "is_anonymous",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("comments", "is_anonymous")
