"""Error router for error tracking and management endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.error import Error
from app.schemas.error import ErrorListResponse, ErrorResponse, ErrorUpdate

router = APIRouter(prefix="/errors", tags=["errors"])


@router.get("", response_model=ErrorListResponse)
async def list_errors(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    resolved: bool | None = Query(default=None, description="Filter by resolved status"),
    start_date: datetime | None = Query(default=None, description="Filter errors after this date"),
    end_date: datetime | None = Query(default=None, description="Filter errors before this date"),
    error_type: str | None = Query(default=None, description="Filter by error type"),
) -> ErrorListResponse:
    """Get errors with pagination and optional filters."""
    # Build base query
    query = select(Error)
    count_query = select(func.count()).select_from(Error)

    # Apply filters
    if resolved is not None:
        query = query.where(Error.resolved == resolved)
        count_query = count_query.where(Error.resolved == resolved)

    if start_date is not None:
        query = query.where(Error.timestamp >= start_date)
        count_query = count_query.where(Error.timestamp >= start_date)

    if end_date is not None:
        query = query.where(Error.timestamp <= end_date)
        count_query = count_query.where(Error.timestamp <= end_date)

    if error_type is not None:
        query = query.where(Error.error_type == error_type)
        count_query = count_query.where(Error.error_type == error_type)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results ordered by most recent first
    query = query.order_by(Error.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    errors = result.scalars().all()

    return ErrorListResponse(
        errors=[ErrorResponse.model_validate(error) for error in errors],
        total=total,
    )


@router.get("/{error_id}", response_model=ErrorResponse)
async def get_error(
    error_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ErrorResponse:
    """Get a specific error by ID."""
    query = select(Error).where(Error.id == error_id)
    result = await db.execute(query)
    error = result.scalar_one_or_none()

    if error is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Error with id {error_id} not found",
        )

    return ErrorResponse.model_validate(error)


@router.patch("/{error_id}", response_model=ErrorResponse)
async def update_error(
    error_id: int,
    update_data: ErrorUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ErrorResponse:
    """Update an error (mark resolved, add notes)."""
    query = select(Error).where(Error.id == error_id)
    result = await db.execute(query)
    error = result.scalar_one_or_none()

    if error is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Error with id {error_id} not found",
        )

    # Update fields if provided
    if update_data.resolved is not None:
        error.resolved = update_data.resolved
        if update_data.resolved:
            error.resolved_at = datetime.now()
        else:
            error.resolved_at = None

    if update_data.notes is not None:
        error.notes = update_data.notes

    await db.commit()
    await db.refresh(error)

    return ErrorResponse.model_validate(error)


@router.delete("/{error_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_error(
    error_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a specific error."""
    query = select(Error).where(Error.id == error_id)
    result = await db.execute(query)
    error = result.scalar_one_or_none()

    if error is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Error with id {error_id} not found",
        )

    await db.delete(error)
    await db.commit()


@router.post("/clear-resolved", status_code=status.HTTP_200_OK)
async def clear_resolved_errors(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    """Bulk delete all resolved errors."""
    # Count resolved errors first
    count_query = select(func.count()).select_from(Error).where(Error.resolved == True)  # noqa: E712
    count_result = await db.execute(count_query)
    count = count_result.scalar() or 0

    # Delete all resolved errors
    delete_query = delete(Error).where(Error.resolved == True)  # noqa: E712
    await db.execute(delete_query)
    await db.commit()

    return {"deleted_count": count}
