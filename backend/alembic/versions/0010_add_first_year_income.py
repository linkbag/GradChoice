"""Add first_year_income column to ratings

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ratings",
        sa.Column("first_year_income", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ratings", "first_year_income")
