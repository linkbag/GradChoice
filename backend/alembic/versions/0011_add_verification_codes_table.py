"""Add verification_codes table

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE verificationpurpose AS ENUM ('signup', 'password_reset');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.create_table(
        "verification_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum("signup", "password_reset", name="verificationpurpose"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_verification_codes_email", "verification_codes", ["email"])
    op.create_index("ix_verification_codes_email_purpose", "verification_codes", ["email", "purpose"])


def downgrade() -> None:
    op.drop_index("ix_verification_codes_email_purpose", table_name="verification_codes")
    op.drop_index("ix_verification_codes_email", table_name="verification_codes")
    op.drop_table("verification_codes")
    op.execute("DROP TYPE IF EXISTS verificationpurpose")
