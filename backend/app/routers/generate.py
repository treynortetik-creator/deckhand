"""Generate router for deck generation endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.generation import (
    GenerationProgress,
    GenerationRequest,
    GenerationResult,
)
from app.services.deck_generator import generate_deck

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])

# In-memory progress tracking (per-request)
# Key: generation_id, Value: latest progress update
_progress: dict[str, GenerationProgress] = {}


def _create_progress_callback(generation_id: str):
    """Create a callback that updates the progress dict.

    Args:
        generation_id: Unique ID for this generation request.

    Returns:
        Callback function that stores progress updates.
    """

    def callback(progress: GenerationProgress) -> None:
        _progress[generation_id] = progress

    return callback


@router.post("", response_model=GenerationResult, status_code=status.HTTP_201_CREATED)
async def create_deck(
    request: GenerationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GenerationResult:
    """Generate a new deck from a prompt.

    This endpoint orchestrates the full deck generation pipeline:
    - Loads optional template and brand context
    - Generates deck outline via AI
    - Generates detailed slide content in parallel
    - Creates database records for the deck

    Args:
        request: Generation request with prompt and options.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        GenerationResult with deck ID and metadata.

    Raises:
        HTTPException: If generation fails.
    """
    generation_id = str(uuid.uuid4())

    # Initialize progress
    _progress[generation_id] = GenerationProgress(
        status="pending",
        current_step=0,
        total_steps=5,
        message="Starting deck generation...",
    )

    try:
        result = await generate_deck(
            db=db,
            request=request,
            user_id=current_user.id,
            progress_callback=_create_progress_callback(generation_id),
        )

        # Clean up progress tracking
        _progress.pop(generation_id, None)

        return result

    except ValueError as e:
        # Clean up progress tracking
        _progress.pop(generation_id, None)

        logger.error(f"Deck generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        # Clean up progress tracking
        _progress.pop(generation_id, None)

        logger.exception(f"Unexpected error during deck generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during deck generation",
        )


@router.get("/progress", response_model=dict[str, GenerationProgress])
async def get_generation_progress(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, GenerationProgress]:
    """Get all active generation progress updates.

    This endpoint returns the current progress of all ongoing
    deck generation requests. Useful for polling-based progress tracking.

    Note: For real-time updates, use WebSocket endpoint instead.

    Args:
        current_user: Authenticated user.

    Returns:
        Dict mapping generation_id to current progress.
    """
    return _progress.copy()


@router.get("/progress/{generation_id}", response_model=GenerationProgress | None)
async def get_specific_progress(
    generation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> GenerationProgress | None:
    """Get progress for a specific generation request.

    Args:
        generation_id: UUID of the generation request.
        current_user: Authenticated user.

    Returns:
        Current progress or None if not found.
    """
    return _progress.get(generation_id)
