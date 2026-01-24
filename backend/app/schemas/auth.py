"""Authentication schemas for request/response validation."""

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Schema for user registration."""

    email: EmailStr
    password: str
    full_name: str | None = None


class UserResponse(BaseModel):
    """Schema for user response (excludes password)."""

    model_config = {"from_attributes": True}

    id: int
    email: str
    full_name: str | None
    is_active: bool


class Token(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded token data."""

    email: str | None = None


class LoginRequest(BaseModel):
    """Schema for JSON login request."""

    email: EmailStr
    password: str
