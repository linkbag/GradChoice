"""Add school email verification fields to users

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("school_email", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("school_email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("verification_code", sa.String(6), nullable=True))
    op.add_column("users", sa.Column("verification_code_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "verification_code_expires_at")
    op.drop_column("users", "verification_code")
    op.drop_column("users", "school_email_verified")
    op.drop_column("users", "school_email")
