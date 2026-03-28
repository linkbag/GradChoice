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
    # Use raw SQL with IF NOT EXISTS to be safe — column was pre-applied on Neon manually
    op.execute("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS first_year_income INTEGER")


def downgrade() -> None:
    op.drop_column("ratings", "first_year_income")
