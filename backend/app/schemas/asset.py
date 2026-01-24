"""Asset schemas for request/response validation."""

from datetime import datetime

from pydantic import BaseModel


class AssetCreate(BaseModel):
    """Schema for asset creation (tags only, file handled separately)."""

    tags: list[str] = []


class AssetUpdate(BaseModel):
    """Schema for asset update (tags only)."""

    tags: list[str] | None = None


class AssetResponse(BaseModel):
    """Schema for asset response."""

    model_config = {"from_attributes": True}

    id: int
    filename: str
    file_type: str
    file_url: str
    file_size: int
    tags: list[str] | None
    uploaded_by: int | None
    uploaded_at: datetime


class AssetListResponse(BaseModel):
    """Schema for paginated asset list response."""

    assets: list[AssetResponse]
    total: int
