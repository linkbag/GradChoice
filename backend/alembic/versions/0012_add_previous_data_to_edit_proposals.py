"""Add previous_data column to edit_proposals

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE edit_proposals ADD COLUMN IF NOT EXISTS previous_data JSONB"
    )


def downgrade() -> None:
    op.drop_column("edit_proposals", "previous_data")
