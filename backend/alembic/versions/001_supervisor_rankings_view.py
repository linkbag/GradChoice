"""Create supervisor_rankings materialized view

Revision ID: 001
Revises:
Create Date: 2026-03-21
"""
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS supervisor_rankings AS
        SELECT
            s.id AS supervisor_id,
            s.school_code,
            s.province,
            s.department,
            s.name AS supervisor_name,
            s.school_name,
            AVG(r.overall_score)::numeric(5,2) AS avg_overall,
            AVG(r.score_academic)::numeric(5,2) AS avg_academic,
            AVG(r.score_mentoring)::numeric(5,2) AS avg_mentoring,
            AVG(r.score_wellbeing)::numeric(5,2) AS avg_wellbeing,
            AVG(r.score_stipend)::numeric(5,2) AS avg_stipend,
            AVG(r.score_resources)::numeric(5,2) AS avg_resources,
            AVG(r.score_ethics)::numeric(5,2) AS avg_ethics,
            COUNT(r.id) AS rating_count,
            PERCENT_RANK() OVER (
                PARTITION BY s.department, s.school_code ORDER BY AVG(r.overall_score)
            )::numeric(8,6) AS dept_percentile,
            PERCENT_RANK() OVER (
                PARTITION BY s.school_code ORDER BY AVG(r.overall_score)
            )::numeric(8,6) AS school_percentile,
            PERCENT_RANK() OVER (
                PARTITION BY s.province ORDER BY AVG(r.overall_score)
            )::numeric(8,6) AS province_percentile,
            PERCENT_RANK() OVER (
                ORDER BY AVG(r.overall_score)
            )::numeric(8,6) AS national_percentile
        FROM supervisors s
        LEFT JOIN ratings r ON r.supervisor_id = s.id
        GROUP BY s.id, s.school_code, s.province, s.department, s.name, s.school_name
        HAVING COUNT(r.id) >= 1
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_rankings_pk
        ON supervisor_rankings (supervisor_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_supervisor_rankings_school
        ON supervisor_rankings (school_code)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_supervisor_rankings_province
        ON supervisor_rankings (province)
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS supervisor_rankings")
