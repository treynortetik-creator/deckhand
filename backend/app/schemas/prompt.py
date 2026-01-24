"""Prompt schemas for request/response validation."""

from datetime import datetime

from pydantic import BaseModel


class PromptCreate(BaseModel):
    """Schema for creating a new user prompt."""

    name: str
    description: str | None = None
    prompt_text: str


class PromptUpdate(BaseModel):
    """Schema for updating a user prompt."""

    name: str | None = None
    description: str | None = None
    prompt_text: str | None = None


class PromptResponse(BaseModel):
    """Schema for prompt response."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None
    prompt_text: str
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class PromptListResponse(BaseModel):
    """Schema for paginated prompt list response."""

    prompts: list[PromptResponse]
    total: int


class SystemPromptUpdate(BaseModel):
    """Schema for updating a system prompt."""

    prompt_text: str


class SystemPromptResponse(BaseModel):
    """Schema for system prompt response."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    prompt_text: str
    updated_at: datetime
