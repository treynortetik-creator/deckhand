"""History router for generation and deck history endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.deck import Deck, GenerationHistory
from app.schemas.history import (
    DeckListResponse,
    DeckResponse,
    HistoryListResponse,
    HistoryResponse,
)

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/generations", response_model=HistoryListResponse)
async def get_generation_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    success_only: bool = Query(
        default=False, description="Filter to only successful generations"
    ),
) -> HistoryListResponse:
    """Get generation history with pagination and optional success filter."""
    # Build base query
    query = select(GenerationHistory)

    if success_only:
        query = query.where(GenerationHistory.success == True)  # noqa: E712

    # Get total count
    count_query = select(func.count()).select_from(GenerationHistory)
    if success_only:
        count_query = count_query.where(GenerationHistory.success == True)  # noqa: E712

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results ordered by most recent first
    query = query.order_by(GenerationHistory.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    history_records = result.scalars().all()

    return HistoryListResponse(
        history=[HistoryResponse.model_validate(record) for record in history_records],
        total=total,
    )


@router.get("/decks", response_model=DeckListResponse)
async def get_decks(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
) -> DeckListResponse:
    """Get all generated decks with pagination."""
    # Get total count
    count_query = select(func.count()).select_from(Deck)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results ordered by most recent first
    query = select(Deck).order_by(Deck.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    decks = result.scalars().all()

    return DeckListResponse(
        decks=[DeckResponse.model_validate(deck) for deck in decks],
        total=total,
    )


@router.get("/decks/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeckResponse:
    """Get specific deck details by ID."""
    query = select(Deck).where(Deck.id == deck_id)
    result = await db.execute(query)
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deck with id {deck_id} not found",
        )

    return DeckResponse.model_validate(deck)
