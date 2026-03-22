"""Add verified score cache columns to supervisors

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("supervisors", sa.Column("verified_avg_overall_score", sa.Float(), nullable=True))
    op.add_column(
        "supervisors",
        sa.Column("verified_rating_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("supervisors", "verified_rating_count")
    op.drop_column("supervisors", "verified_avg_overall_score")
