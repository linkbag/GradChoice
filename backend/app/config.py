from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"

    # JWT
    SECRET_KEY: str = "changeme-use-a-secure-random-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    EMAIL_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1

    # App
    APP_NAME: str = "研选 GradChoice"
    APP_URL: str = "https://gradchoice.cn"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Email (SMTP)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL: str = "noreply@gradchoice.cn"

    # Storage
    UPLOAD_DIR: str = "/tmp/uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
