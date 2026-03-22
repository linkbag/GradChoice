#!/bin/sh
set -e

# Wait for Postgres to be ready
echo "等待 PostgreSQL 就绪..."
until pg_isready -h "${PGHOST:-db}" -U "${PGUSER:-gradchoice}" -q; do
  sleep 1
done
echo "PostgreSQL 已就绪"

# Run migrations
echo "运行数据库迁移..."
alembic upgrade head
echo "迁移完成"

# Start server
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
