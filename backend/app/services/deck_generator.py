"""Deck generator service orchestrating AI-powered deck creation."""

import logging
import time
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.brand import Brand
from app.models.deck import Deck, DeckVersion, GenerationHistory
from app.models.template import Template
from app.routers.export import store_slides
from app.schemas.generation import (
    DeckOutline,
    GenerationProgress,
    GenerationRequest,
    GenerationResult,
    SlideContent,
)
from app.routers.models import get_model_for_agent
from app.services.openrouter import (
    create_deck_outline,
    generate_slides_parallel,
    get_openrouter_client,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# Type alias for progress callback
ProgressCallback = Callable[[GenerationProgress], None]


async def get_brand_context(db: AsyncSession) -> dict[str, Any] | None:
    """Get the current brand context for deck generation.

    Args:
        db: Database session.

    Returns:
        Brand context dict or None if no brand exists.
    """
    result = await db.execute(select(Brand).limit(1))
    brand = result.scalar_one_or_none()

    if brand is None:
        return None

    return {
        "name": brand.name,
        "primary_colors": brand.primary_colors,
        "secondary_colors": brand.secondary_colors,
        "fonts": brand.fonts,
        "logo_urls": brand.logo_urls,
        "guidelines_text": brand.guidelines_text,
    }


async def get_template_structure(
    db: AsyncSession, template_id: int
) -> list[dict[str, Any]] | None:
    """Get template slide structure if template exists.

    Args:
        db: Database session.
        template_id: ID of the template.

    Returns:
        Template slide structure or None if not found.
    """
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()

    if template is None:
        return None

    return template.slide_structure


def _update_progress(
    callback: ProgressCallback | None,
    status: str,
    current_step: int,
    total_steps: int,
    message: str,
    slide_progress: dict[int, str] | None = None,
) -> None:
    """Helper to send progress updates if callback is provided.

    Args:
        callback: Optional progress callback function.
        status: Current generation status.
        current_step: Current step number.
        total_steps: Total number of steps.
        message: Human-readable progress message.
        slide_progress: Optional per-slide progress dict.
    """
    if callback is None:
        return

    progress = GenerationProgress(
        status=status,
        current_step=current_step,
        total_steps=total_steps,
        message=message,
        slide_progress=slide_progress or {},
    )
    callback(progress)


async def generate_deck(
    db: AsyncSession,
    request: GenerationRequest,
    user_id: int | None = None,
    progress_callback: ProgressCallback | None = None,
) -> GenerationResult:
    """Generate a complete deck from a user request.

    This orchestrates the full deck generation pipeline:
    1. Load template (if specified)
    2. Load brand context
    3. Generate deck outline via LLM
    4. Generate slide content in parallel
    5. Create database records
    6. Return result with timing

    Args:
        db: Database session.
        request: Generation request with prompt, template, etc.
        user_id: Optional user ID for tracking.
        progress_callback: Optional callback for progress updates.

    Returns:
        GenerationResult with deck ID and metadata.

    Raises:
        ValueError: If generation fails.
    """
    start_time = time.time()
    total_steps = 5  # Template, brand, outline, slides, save

    # Step 1: Get template structure if specified
    _update_progress(
        progress_callback,
        status="pending",
        current_step=1,
        total_steps=total_steps,
        message="Loading template...",
    )

    template_structure: list[dict[str, Any]] | None = None
    if request.template_id:
        template_structure = await get_template_structure(db, request.template_id)
        logger.info(f"Loaded template {request.template_id}")

    # Step 2: Get brand context
    _update_progress(
        progress_callback,
        status="pending",
        current_step=2,
        total_steps=total_steps,
        message="Loading brand context...",
    )

    brand_context = await get_brand_context(db)
    if brand_context:
        logger.info(f"Loaded brand context: {brand_context.get('name')}")

    # Step 3: Generate deck outline
    _update_progress(
        progress_callback,
        status="generating_outline",
        current_step=3,
        total_steps=total_steps,
        message="Generating deck outline with AI...",
    )

    client = get_openrouter_client()

    # Get configured models for each agent
    outline_model = await get_model_for_agent(db, "outline")
    content_model = await get_model_for_agent(db, "content")
    logger.info(f"Using models - outline: {outline_model or 'default'}, content: {content_model or 'default'}")

    try:
        outline: DeckOutline = await create_deck_outline(
            client=client,
            prompt=request.prompt,
            template_structure=template_structure,
            slide_count=request.slide_count,
            tone=request.tone,
            brand_context=brand_context,
            model=outline_model,
        )
        logger.info(f"Generated outline with {len(outline.slides)} slides")
    except Exception as e:
        logger.error(f"Outline generation failed: {e}")
        # Record failed attempt
        history = GenerationHistory(
            prompt=request.prompt,
            template_id=request.template_id,
            assets_used=request.asset_ids,
            model_used=outline_model or settings.default_llm_model,
            success=False,
            error_message=str(e),
        )
        db.add(history)
        await db.commit()
        raise ValueError(f"Failed to generate deck outline: {e}")

    # Step 4: Generate slide content in parallel
    _update_progress(
        progress_callback,
        status="generating_slides",
        current_step=4,
        total_steps=total_steps,
        message="Generating detailed slide content...",
        slide_progress={s.slide_number: "pending" for s in outline.slides},
    )

    try:
        enhanced_slides: list[SlideContent] = await generate_slides_parallel(
            client=client,
            outline=outline,
            brand_context=brand_context,
            max_concurrent=3,
            model=content_model,
        )
        logger.info(f"Enhanced {len(enhanced_slides)} slides")
    except Exception as e:
        logger.error(f"Slide generation failed: {e}")
        # Continue with original slides on failure
        enhanced_slides = outline.slides

    # Step 5: Save to database
    _update_progress(
        progress_callback,
        status="complete",
        current_step=5,
        total_steps=total_steps,
        message="Saving deck to database...",
    )

    generation_time = time.time() - start_time

    # Create Deck record
    deck = Deck(
        title=outline.title,
        prompt_used=request.prompt,
        template_id=request.template_id,
        model_used=outline_model or settings.default_llm_model,
        generation_time_seconds=generation_time,
        created_by=user_id,
    )
    db.add(deck)
    await db.flush()  # Get the deck ID

    # Store slides for export service
    store_slides(deck.id, enhanced_slides)

    # Create DeckVersion record (version 1)
    version = DeckVersion(
        deck_id=deck.id,
        version_number=1,
        prompt=request.prompt,
        template_id=request.template_id,
        assets_used=request.asset_ids,
    )
    db.add(version)

    # Create GenerationHistory record
    history = GenerationHistory(
        prompt=request.prompt,
        template_id=request.template_id,
        assets_used=request.asset_ids,
        model_used=outline_model or settings.default_llm_model,
        deck_id=deck.id,
        success=True,
    )
    db.add(history)

    await db.commit()
    await db.refresh(deck)

    logger.info(
        f"Created deck {deck.id} with {len(enhanced_slides)} slides "
        f"in {generation_time:.2f}s"
    )

    return GenerationResult(
        deck_id=deck.id,
        title=outline.title,
        google_slides_url=None,  # Will be populated by export service
        pptx_download_url=None,  # Will be populated by export service
        generation_time_seconds=generation_time,
        slides_generated=len(enhanced_slides),
    )
