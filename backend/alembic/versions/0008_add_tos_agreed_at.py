"""Add tos_agreed_at column to users

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("tos_agreed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "tos_agreed_at")
