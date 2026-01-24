"""Brand schemas for request/response validation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class BrandColors(BaseModel):
    """Schema for brand color definitions."""

    primary: str | None = None
    secondary: str | None = None
    accent: str | None = None


class BrandFonts(BaseModel):
    """Schema for brand font definitions."""

    heading: str | None = None
    body: str | None = None


class BrandLogos(BaseModel):
    """Schema for brand logo URLs."""

    primary: str | None = None
    white: str | None = None
    icon: str | None = None


class BrandCreate(BaseModel):
    """Schema for creating a brand."""

    name: str = "SafelyYou"
    primary_colors: dict[str, Any] = {}
    secondary_colors: dict[str, Any] = {}
    fonts: dict[str, Any] = {}
    logo_urls: dict[str, Any] = {}
    guidelines_text: str | None = None


class BrandUpdate(BaseModel):
    """Schema for updating a brand (all fields optional)."""

    name: str | None = None
    primary_colors: dict[str, Any] | None = None
    secondary_colors: dict[str, Any] | None = None
    fonts: dict[str, Any] | None = None
    logo_urls: dict[str, Any] | None = None
    guidelines_text: str | None = None


class BrandResponse(BaseModel):
    """Schema for brand response."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    primary_colors: dict[str, Any] | None
    secondary_colors: dict[str, Any] | None
    fonts: dict[str, Any] | None
    logo_urls: dict[str, Any] | None
    guidelines_text: str | None
    created_at: datetime
    updated_at: datetime
