"""Ensure supervisor rating columns exist (handles stale volumes)

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns if missing (idempotent — safe to run multiple times)
    conn = op.get_bind()
    cols = {row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='supervisors'")
    )}
    if "avg_overall_score" not in cols:
        op.add_column("supervisors", sa.Column("avg_overall_score", sa.Float, nullable=True))
    if "rating_count" not in cols:
        op.add_column("supervisors", sa.Column("rating_count", sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    pass  # Leave columns — they're part of the core schema
