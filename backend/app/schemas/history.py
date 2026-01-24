"""History schemas for generation and deck history request/response validation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class HistoryResponse(BaseModel):
    """Schema for a single generation history entry."""

    model_config = {"from_attributes": True}

    id: int
    prompt: str | None
    template_id: int | None
    assets_used: list[Any] | None
    model_used: str | None
    deck_id: int | None
    success: bool
    error_message: str | None
    created_at: datetime


class HistoryListResponse(BaseModel):
    """Schema for paginated generation history list."""

    history: list[HistoryResponse]
    total: int


class DeckResponse(BaseModel):
    """Schema for a single deck entry."""

    model_config = {"from_attributes": True}

    id: int
    title: str
    prompt_used: str | None
    template_id: int | None
    google_slides_url: str | None
    pptx_file_path: str | None
    model_used: str | None
    generation_time_seconds: float | None
    created_by: int | None
    created_at: datetime


class DeckListResponse(BaseModel):
    """Schema for paginated deck list."""

    decks: list[DeckResponse]
    total: int
