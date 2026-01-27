"""Deck generator service orchestrating AI-powered deck creation."""

import asyncio
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
    OpenRouterClient,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# Type alias for progress callback
ProgressCallback = Callable[[GenerationProgress], None]


async def generate_images_for_slides(
    client: OpenRouterClient,
    slides: list[SlideContent],
    image_model: str | None = None,
    max_concurrent: int = 3,
) -> list[SlideContent]:
    """Generate images for slides that have image_prompt defined.

    Args:
        client: OpenRouter client instance.
        slides: List of slides to process.
        image_model: Model to use for image generation.
        max_concurrent: Maximum concurrent image generation requests.

    Returns:
        List of slides with image_url populated where applicable.
    """
    # Find slides that need images
    slides_needing_images = [
        (i, slide) for i, slide in enumerate(slides)
        if slide.image_prompt and not slide.image_url
    ]

    if not slides_needing_images:
        logger.info("No slides require image generation")
        return slides

    logger.info(
        f"Generating images for {len(slides_needing_images)} slides "
        f"with model: {image_model or 'default'}"
    )

    # Create a mutable copy of slides
    result_slides = list(slides)

    # Process in batches to respect rate limits
    for batch_start in range(0, len(slides_needing_images), max_concurrent):
        batch = slides_needing_images[batch_start:batch_start + max_concurrent]

        async def generate_single_image(
            idx: int, slide: SlideContent
        ) -> tuple[int, str | None]:
            """Generate image for a single slide."""
            try:
                image_url = await client.generate_image(
                    prompt=slide.image_prompt,
                    model=image_model,
                )
                if image_url:
                    logger.info(f"Generated image for slide {slide.slide_number}")
                else:
                    logger.warning(
                        f"No image returned for slide {slide.slide_number}"
                    )
                return idx, image_url
            except Exception as e:
                logger.error(
                    f"Image generation failed for slide {slide.slide_number}: {e}"
                )
                return idx, None

        # Run batch concurrently
        tasks = [generate_single_image(idx, slide) for idx, slide in batch]
        try:
            async with asyncio.timeout(120):  # 2 minute timeout per batch
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        except TimeoutError:
            logger.error("Image generation batch timed out")
            batch_results = [(idx, None) for idx, _ in batch]

        # Update slides with generated image URLs
        for result in batch_results:
            if isinstance(result, Exception):
                logger.error(f"Image generation task failed: {result}")
                continue
            idx, image_url = result
            if image_url:
                # Create new SlideContent with image_url
                original_slide = result_slides[idx]
                result_slides[idx] = SlideContent(
                    slide_number=original_slide.slide_number,
                    slide_type=original_slide.slide_type,
                    title=original_slide.title,
                    body=original_slide.body,
                    bullets=original_slide.bullets,
                    image_prompt=original_slide.image_prompt,
                    image_url=image_url,
                    speaker_notes=original_slide.speaker_notes,
                )

    images_generated = sum(
        1 for slide in result_slides if slide.image_url
    )
    logger.info(f"Successfully generated {images_generated} images")

    return result_slides


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
    total_steps = 6  # Template, brand, outline, slides, images, save

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
    image_model = await get_model_for_agent(db, "image")
    logger.info(
        f"Using models - outline: {outline_model or 'default'}, "
        f"content: {content_model or 'default'}, image: {image_model or 'default'}"
    )

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

    # Step 5: Generate images for slides
    slides_with_prompts = sum(1 for s in enhanced_slides if s.image_prompt)
    if slides_with_prompts > 0 and image_model:
        _update_progress(
            progress_callback,
            status="generating_images",
            current_step=5,
            total_steps=total_steps,
            message=f"Generating images for {slides_with_prompts} slides...",
        )

        try:
            enhanced_slides = await generate_images_for_slides(
                client=client,
                slides=enhanced_slides,
                image_model=image_model,
                max_concurrent=2,  # Be conservative with image generation
            )
            images_generated = sum(1 for s in enhanced_slides if s.image_url)
            logger.info(f"Generated {images_generated} images for slides")
        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            # Continue without images - slides are still valid
    else:
        if slides_with_prompts > 0:
            logger.info("Skipping image generation - no image model configured")
        else:
            logger.info("No slides have image prompts - skipping image generation")

    # Step 6: Save to database
    _update_progress(
        progress_callback,
        status="complete",
        current_step=6,
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
