"""Add stats_snapshots table for persistent overview cache

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stats_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("total_supervisors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_ratings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_users", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rated_supervisors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recent_ratings_30d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("most_active_schools", sa.Text(), nullable=True),
        sa.Column("last_refreshed", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("stats_snapshots")
