import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool, QueuePool
from app.config import settings

# Lambda/serverless: use NullPool (no persistent connections)
# Local/Docker: use QueuePool with connection pooling
_is_lambda = os.getenv("AWS_LAMBDA_FUNCTION_NAME") is not None

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    poolclass=NullPool if _is_lambda else QueuePool,
    **({} if _is_lambda else {"pool_size": 10, "max_overflow": 20}),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
