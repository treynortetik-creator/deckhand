"""Template schemas for request/response validation."""

from datetime import datetime

from pydantic import BaseModel, Field


class SlideDefinition(BaseModel):
    """Schema for defining a slide in a template."""

    type: str = Field(..., description="Type of slide (e.g., title, content, image)")
    placeholders: list[str] = Field(
        default_factory=list,
        description="List of placeholder names for this slide",
    )


class TemplateCreate(BaseModel):
    """Schema for creating a new template."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    slide_structure: list[SlideDefinition] = Field(
        ..., description="List of slide definitions"
    )


class TemplateUpdate(BaseModel):
    """Schema for updating a template (all fields optional)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    slide_structure: list[SlideDefinition] | None = None


class TemplateResponse(BaseModel):
    """Schema for template response."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None
    slide_structure: list[dict] | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    """Schema for paginated template list response."""

    templates: list[TemplateResponse]
    total: int
