"""PPTX export service for generating PowerPoint presentations."""

import logging
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Any

import httpx
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

from app.config import get_settings
from app.schemas.generation import SlideContent

logger = logging.getLogger(__name__)
settings = get_settings()

# Default brand colors if none provided
DEFAULT_BRAND_COLORS = {
    "primary": "#1a365d",  # Dark blue
    "secondary": "#2d3748",  # Dark gray
    "accent": "#3182ce",  # Blue
}


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple.

    Args:
        hex_color: Hex color string (e.g., "#FF5733" or "FF5733").

    Returns:
        Tuple of (red, green, blue) integers 0-255.
    """
    # Remove leading # if present
    hex_color = hex_color.lstrip("#")

    # Validate hex string
    if len(hex_color) != 6 or not all(c in "0123456789abcdefABCDEF" for c in hex_color):
        logger.warning(f"Invalid hex color: {hex_color}, using default")
        return (26, 54, 93)  # Default dark blue

    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


async def download_image(url: str, save_path: str) -> str | None:
    """Download an image from URL and save to local path.

    Args:
        url: URL of the image to download.
        save_path: Local path to save the image.

    Returns:
        Path to saved image or None if download failed.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                logger.error(
                    f"Failed to download image: {url} (status {response.status_code})"
                )
                return None

            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)

            with open(save_path, "wb") as f:
                f.write(response.content)

            logger.info(f"Downloaded image to {save_path}")
            return save_path

    except Exception as e:
        logger.error(f"Error downloading image {url}: {e}")
        return None


def _get_brand_color(
    brand_colors: dict[str, Any] | None, key: str, default: str
) -> str:
    """Safely get a brand color with fallback to default.

    Args:
        brand_colors: Brand colors dict (may be nested or flat).
        key: Color key to look for (e.g., "primary", "title", "body").
        default: Default hex color if not found.

    Returns:
        Hex color string.
    """
    if brand_colors is None:
        return default

    # Check if the key exists directly
    if key in brand_colors and isinstance(brand_colors[key], str):
        return brand_colors[key]

    # Check in primary_colors
    primary = brand_colors.get("primary_colors", {})
    if isinstance(primary, dict) and key in primary:
        return primary[key]

    # Check in secondary_colors
    secondary = brand_colors.get("secondary_colors", {})
    if isinstance(secondary, dict) and key in secondary:
        return secondary[key]

    # Try first primary color as default
    if isinstance(primary, dict) and primary:
        first_key = next(iter(primary))
        return primary[first_key]

    return default


def create_title_slide(
    prs: Presentation,
    slide: SlideContent,
    brand_colors: dict[str, Any] | None,
) -> None:
    """Create a title slide with centered title and subtitle.

    Args:
        prs: PowerPoint presentation object.
        slide: Slide content with title and optional body.
        brand_colors: Brand color configuration.
    """
    # Use blank layout (index 6)
    slide_layout = prs.slide_layouts[6]
    ppt_slide = prs.slides.add_slide(slide_layout)

    # Slide dimensions
    slide_width = Inches(10)
    _ = Inches(7.5)  # slide_height - unused but kept for documentation

    # Title - centered on slide
    title_left = Inches(0.5)
    title_top = Inches(2.5)
    title_width = slide_width - Inches(1)
    title_height = Inches(1.5)

    title_box = ppt_slide.shapes.add_textbox(
        title_left, title_top, title_width, title_height
    )
    title_frame = title_box.text_frame
    title_frame.word_wrap = True

    title_para = title_frame.paragraphs[0]
    title_para.text = slide.title
    title_para.alignment = 1  # PP_ALIGN.CENTER

    # Apply title formatting
    title_color = _get_brand_color(
        brand_colors, "primary", DEFAULT_BRAND_COLORS["primary"]
    )
    rgb = hex_to_rgb(title_color)
    title_run = title_para.runs[0]
    title_run.font.size = Pt(44)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(rgb[0], rgb[1], rgb[2])

    # Subtitle (body text) - centered below title
    if slide.body:
        subtitle_top = Inches(4.2)
        subtitle_height = Inches(1)

        subtitle_box = ppt_slide.shapes.add_textbox(
            title_left, subtitle_top, title_width, subtitle_height
        )
        subtitle_frame = subtitle_box.text_frame
        subtitle_frame.word_wrap = True

        subtitle_para = subtitle_frame.paragraphs[0]
        subtitle_para.text = slide.body
        subtitle_para.alignment = 1  # PP_ALIGN.CENTER

        subtitle_color = _get_brand_color(
            brand_colors, "secondary", DEFAULT_BRAND_COLORS["secondary"]
        )
        rgb = hex_to_rgb(subtitle_color)
        subtitle_run = subtitle_para.runs[0]
        subtitle_run.font.size = Pt(24)
        subtitle_run.font.color.rgb = RGBColor(rgb[0], rgb[1], rgb[2])


async def create_content_slide(
    prs: Presentation,
    slide: SlideContent,
    brand_colors: dict[str, Any] | None,
    temp_dir: str | None = None,
) -> None:
    """Create a content slide with title, body/bullets, and optional image.

    Args:
        prs: PowerPoint presentation object.
        slide: Slide content with title, body, bullets, and/or image_url.
        brand_colors: Brand color configuration.
        temp_dir: Temporary directory for downloading images.
    """
    # Use blank layout (index 6)
    slide_layout = prs.slide_layouts[6]
    ppt_slide = prs.slides.add_slide(slide_layout)

    # Slide dimensions
    slide_width = Inches(10)

    # Check if we have an image to embed
    image_path = None
    has_image = False
    if slide.image_url and temp_dir:
        # Generate unique filename for the image
        image_filename = f"slide_{slide.slide_number}_{uuid.uuid4().hex[:8]}.png"
        image_save_path = os.path.join(temp_dir, image_filename)

        # Download the image
        image_path = await download_image(slide.image_url, image_save_path)
        has_image = image_path is not None
        if not has_image:
            logger.warning(
                f"Failed to download image for slide {slide.slide_number}, "
                "continuing without image"
            )

    # Adjust content width based on whether we have an image
    # If image present: text on left (60%), image on right (40%)
    if has_image:
        content_width = Inches(5.5)  # Left 60% for text
        image_left = Inches(6.2)
        image_top = Inches(1.7)
        image_width = Inches(3.3)
        image_height = Inches(5.0)
    else:
        content_width = slide_width - Inches(1)  # Full width

    # Title at top
    title_left = Inches(0.5)
    title_top = Inches(0.5)
    title_width = slide_width - Inches(1)
    title_height = Inches(1)

    title_box = ppt_slide.shapes.add_textbox(
        title_left, title_top, title_width, title_height
    )
    title_frame = title_box.text_frame
    title_frame.word_wrap = True

    title_para = title_frame.paragraphs[0]
    title_para.text = slide.title

    # Apply title formatting
    title_color = _get_brand_color(
        brand_colors, "primary", DEFAULT_BRAND_COLORS["primary"]
    )
    rgb = hex_to_rgb(title_color)
    title_run = title_para.runs[0]
    title_run.font.size = Pt(32)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(rgb[0], rgb[1], rgb[2])

    # Content area
    content_left = Inches(0.5)
    content_top = Inches(1.7)
    content_height = Inches(5.3)

    content_box = ppt_slide.shapes.add_textbox(
        content_left, content_top, content_width, content_height
    )
    content_frame = content_box.text_frame
    content_frame.word_wrap = True

    # Get text color
    text_color = _get_brand_color(
        brand_colors, "secondary", DEFAULT_BRAND_COLORS["secondary"]
    )
    rgb = hex_to_rgb(text_color)

    # Add bullets if present
    if slide.bullets:
        for i, bullet in enumerate(slide.bullets):
            if i == 0:
                para = content_frame.paragraphs[0]
            else:
                para = content_frame.add_paragraph()

            para.text = f"\u2022 {bullet}"
            para.level = 0
            para.space_after = Pt(12)

            if para.runs:
                run = para.runs[0]
                run.font.size = Pt(18)
                run.font.color.rgb = RGBColor(rgb[0], rgb[1], rgb[2])

    # Add body text if present (and no bullets, or after bullets)
    elif slide.body:
        para = content_frame.paragraphs[0]
        para.text = slide.body

        if para.runs:
            run = para.runs[0]
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(rgb[0], rgb[1], rgb[2])

    # Add image if successfully downloaded
    if has_image and image_path:
        try:
            ppt_slide.shapes.add_picture(
                image_path, image_left, image_top, image_width, image_height
            )
            logger.info(f"Added image to slide {slide.slide_number}")
        except Exception as e:
            logger.error(f"Failed to add image to slide {slide.slide_number}: {e}")


def _sanitize_filename(title: str) -> str:
    """Sanitize a title for use as a filename.

    Args:
        title: Original title string.

    Returns:
        Sanitized filename-safe string.
    """
    # Remove or replace invalid characters
    sanitized = re.sub(r'[<>:"/\\|?*]', "", title)
    # Replace spaces with underscores
    sanitized = sanitized.replace(" ", "_")
    # Limit length
    sanitized = sanitized[:50]
    return sanitized


async def create_pptx(
    slides: list[SlideContent],
    title: str,
    brand_colors: dict[str, Any] | None = None,
    output_path: str | None = None,
) -> str:
    """Create a PPTX file from slide content.

    Args:
        slides: List of SlideContent objects.
        title: Deck title.
        brand_colors: Optional brand color configuration.
        output_path: Optional output file path. If not provided, generates from title.

    Returns:
        Path to the created PPTX file.
    """
    # Create presentation with 10x7.5 inch slides
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)

    logger.info(f"Creating PPTX with {len(slides)} slides")

    # Create temp directory for downloading images
    with tempfile.TemporaryDirectory(prefix="deckhand_pptx_") as temp_dir:
        for slide in slides:
            slide_type = slide.slide_type.lower()

            if slide_type == "title" or slide.slide_number == 1:
                create_title_slide(prs, slide, brand_colors)
            else:
                await create_content_slide(prs, slide, brand_colors, temp_dir)

        # Generate output path if not provided
        if output_path is None:
            # Ensure exports directory exists
            exports_dir = Path(settings.upload_dir) / "exports"
            exports_dir.mkdir(parents=True, exist_ok=True)

            filename = f"{_sanitize_filename(title)}.pptx"
            output_path = str(exports_dir / filename)

        # Ensure parent directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Save presentation (inside temp_dir context so images still exist)
        prs.save(output_path)
        logger.info(f"Saved PPTX to {output_path}")

    return output_path
