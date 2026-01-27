"""Export router for PPTX and other export formats."""

import logging
import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.brand import Brand
from app.models.deck import Deck
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.generation import SlideContent
from app.services.google_slides import create_google_slides_presentation
from app.services.pptx_export import create_pptx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])

# In-memory slide storage (keyed by deck_id)
# In production, this would be stored in database or cache
_deck_slides: dict[int, list[SlideContent]] = {}


def store_slides(deck_id: int, slides: list[SlideContent]) -> None:
    """Store slides for a deck in memory.

    Args:
        deck_id: ID of the deck.
        slides: List of slide content objects.
    """
    _deck_slides[deck_id] = slides
    logger.info(f"Stored {len(slides)} slides for deck {deck_id}")


def get_slides(deck_id: int) -> list[SlideContent] | None:
    """Get stored slides for a deck.

    Args:
        deck_id: ID of the deck.

    Returns:
        List of slides or None if not found.
    """
    return _deck_slides.get(deck_id)


async def _get_brand_colors(db: AsyncSession) -> dict | None:
    """Get brand colors from database.

    Args:
        db: Database session.

    Returns:
        Brand colors dict or None.
    """
    result = await db.execute(select(Brand).limit(1))
    brand = result.scalar_one_or_none()

    if brand is None:
        return None

    return {
        "primary_colors": brand.primary_colors,
        "secondary_colors": brand.secondary_colors,
    }


@router.post("/{deck_id}/pptx", status_code=status.HTTP_201_CREATED)
async def create_pptx_export(
    deck_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Create a PPTX export for a deck.

    Args:
        deck_id: ID of the deck to export.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Dict with download URL.

    Raises:
        HTTPException: If deck not found or slides not available.
    """
    # Get deck from database
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deck {deck_id} not found",
        )

    # Get slides from memory storage
    slides = get_slides(deck_id)

    if slides is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Slides for deck {deck_id} not available. "
                "Deck may need to be regenerated."
            ),
        )

    # Get brand colors
    brand_colors = await _get_brand_colors(db)

    # Create PPTX
    try:
        pptx_path = await create_pptx(
            slides=slides,
            title=deck.title,
            brand_colors=brand_colors,
        )
    except Exception as e:
        logger.error(f"Failed to create PPTX for deck {deck_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create PPTX: {e}",
        )

    # Update deck with PPTX path
    deck.pptx_file_path = pptx_path
    await db.commit()
    await db.refresh(deck)

    logger.info(f"Created PPTX for deck {deck_id} at {pptx_path}")

    return {
        "deck_id": deck_id,
        "pptx_file_path": pptx_path,
        "download_url": f"/export/{deck_id}/pptx/download",
    }


@router.get("/{deck_id}/pptx/download")
async def download_pptx(
    deck_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FileResponse:
    """Download the PPTX file for a deck.

    Args:
        deck_id: ID of the deck.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        FileResponse with the PPTX file.

    Raises:
        HTTPException: If deck not found or PPTX not available.
    """
    # Get deck from database
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deck {deck_id} not found",
        )

    if deck.pptx_file_path is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"PPTX not yet created for deck {deck_id}. "
                f"Call POST /export/{deck_id}/pptx first."
            ),
        )

    if not os.path.exists(deck.pptx_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PPTX file not found on disk. It may have been deleted.",
        )

    # Generate a clean filename for download
    filename = f"{deck.title.replace(' ', '_')}.pptx"

    return FileResponse(
        path=deck.pptx_file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )


@router.post("/{deck_id}/google-slides", status_code=status.HTTP_201_CREATED)
async def create_google_slides_export(
    deck_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Export a deck to Google Slides.

    Creates a new Google Slides presentation from the deck's slides and
    updates the deck record with the Google Slides URL.

    Args:
        deck_id: ID of the deck to export.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Dict with the Google Slides URL.

    Raises:
        HTTPException: If deck not found, slides not available, or export fails.
    """
    # Get deck from database
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deck {deck_id} not found",
        )

    # Get slides from memory storage
    slides = get_slides(deck_id)

    if slides is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Slides for deck {deck_id} not available. "
                "Deck may need to be regenerated."
            ),
        )

    # Get brand colors
    brand_colors = await _get_brand_colors(db)

    # Create Google Slides presentation
    try:
        google_slides_url = await create_google_slides_presentation(
            slides=slides,
            title=deck.title,
            brand_colors=brand_colors,
        )
    except ValueError as e:
        # Credentials not configured
        logger.error(f"Google credentials error for deck {deck_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to create Google Slides for deck {deck_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Slides presentation: {e}",
        )

    # Update deck with Google Slides URL
    deck.google_slides_url = google_slides_url
    await db.commit()
    await db.refresh(deck)

    logger.info(f"Created Google Slides for deck {deck_id}: {google_slides_url}")

    return {
        "deck_id": deck_id,
        "url": google_slides_url,
    }
