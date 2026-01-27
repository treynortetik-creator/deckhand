"""Error schemas for request/response validation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ErrorCreate(BaseModel):
    """Schema for creating an error log entry (internal use)."""

    endpoint: str
    method: str
    status_code: int
    error_type: str
    error_message: str
    traceback: str | None = None
    user_id: int | None = None
    request_body: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    """Schema for a single error response."""

    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    endpoint: str
    method: str
    status_code: int
    error_type: str
    error_message: str
    traceback: str | None
    user_id: int | None
    request_body: dict[str, Any] | None
    resolved: bool
    resolved_at: datetime | None
    notes: str | None


class ErrorListResponse(BaseModel):
    """Schema for paginated error list."""

    errors: list[ErrorResponse]
    total: int


class ErrorUpdate(BaseModel):
    """Schema for updating an error (mark resolved, add notes)."""

    resolved: bool | None = None
    notes: str | None = None
