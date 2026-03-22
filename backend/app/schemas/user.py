import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr

# Inline the enum values to avoid importing from models (prevents circular imports)
VerificationType = Literal["none", "email_edu", "student_id"]


class UserBase(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None


class UserPublicProfile(BaseModel):
    id: uuid.UUID
    display_name: Optional[str] = None
    bio: Optional[str] = None
    is_student_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMe(BaseModel):
    id: uuid.UUID
    email: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    is_email_verified: bool
    is_student_verified: bool
    verification_type: VerificationType
    email_notifications_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
