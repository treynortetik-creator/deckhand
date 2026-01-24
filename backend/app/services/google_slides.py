"""Google Slides export service for creating presentations via API."""

import base64
import json
import logging
from typing import Any

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build, Resource

from app.config import get_settings
from app.schemas.generation import SlideContent

logger = logging.getLogger(__name__)
settings = get_settings()

# Google API scopes required for Slides and Drive access
SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
]


def get_slides_service() -> Resource:
    """Build and return an authenticated Google Slides API service.

    Decodes base64-encoded service account credentials from settings
    and creates an authenticated Slides API client.

    Returns:
        Google Slides API service resource.

    Raises:
        ValueError: If credentials are not configured or invalid.
    """
    if not settings.google_credentials_json:
        raise ValueError(
            "Google credentials not configured. "
            "Set GOOGLE_CREDENTIALS_JSON environment variable with base64-encoded service account JSON."
        )

    try:
        # Decode base64 credentials
        credentials_json = base64.b64decode(settings.google_credentials_json).decode(
            "utf-8"
        )
        credentials_info = json.loads(credentials_json)
    except Exception as e:
        raise ValueError(f"Failed to decode Google credentials: {e}")

    credentials = Credentials.from_service_account_info(
        credentials_info, scopes=SCOPES
    )

    service = build("slides", "v1", credentials=credentials)
    return service


def get_drive_service() -> Resource:
    """Build and return an authenticated Google Drive API service.

    Used for setting sharing permissions on created presentations.

    Returns:
        Google Drive API service resource.

    Raises:
        ValueError: If credentials are not configured or invalid.
    """
    if not settings.google_credentials_json:
        raise ValueError(
            "Google credentials not configured. "
            "Set GOOGLE_CREDENTIALS_JSON environment variable with base64-encoded service account JSON."
        )

    try:
        # Decode base64 credentials
        credentials_json = base64.b64decode(settings.google_credentials_json).decode(
            "utf-8"
        )
        credentials_info = json.loads(credentials_json)
    except Exception as e:
        raise ValueError(f"Failed to decode Google credentials: {e}")

    credentials = Credentials.from_service_account_info(
        credentials_info, scopes=SCOPES
    )

    service = build("drive", "v3", credentials=credentials)
    return service


def hex_to_rgb_float(hex_color: str) -> dict[str, float]:
    """Convert a hex color string to RGB float values (0-1 range).

    Args:
        hex_color: Hex color string like "#FF5733" or "FF5733".

    Returns:
        Dict with "red", "green", "blue" keys as floats from 0-1.
    """
    # Remove # prefix if present
    hex_color = hex_color.lstrip("#")

    # Parse hex values
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)

    # Convert to 0-1 range
    return {
        "red": r / 255.0,
        "green": g / 255.0,
        "blue": b / 255.0,
    }


def _create_text_box_request(
    page_id: str,
    element_id: str,
    text: str,
    x: float,
    y: float,
    width: float,
    height: float,
    font_size: int,
    bold: bool = False,
    color: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """Create requests for adding a styled text box to a slide.

    Args:
        page_id: ID of the slide page.
        element_id: Unique ID for the text box element.
        text: Text content for the box.
        x: X position in EMU (English Metric Units).
        y: Y position in EMU.
        width: Width in EMU.
        height: Height in EMU.
        font_size: Font size in points.
        bold: Whether text should be bold.
        color: Optional RGB color dict for text.

    Returns:
        List of API request dicts.
    """
    requests = [
        # Create shape (text box)
        {
            "createShape": {
                "objectId": element_id,
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": page_id,
                    "size": {
                        "width": {"magnitude": width, "unit": "EMU"},
                        "height": {"magnitude": height, "unit": "EMU"},
                    },
                    "transform": {
                        "scaleX": 1,
                        "scaleY": 1,
                        "translateX": x,
                        "translateY": y,
                        "unit": "EMU",
                    },
                },
            }
        },
        # Insert text
        {
            "insertText": {
                "objectId": element_id,
                "insertionIndex": 0,
                "text": text,
            }
        },
    ]

    # Style the text
    text_style: dict[str, Any] = {
        "fontSize": {"magnitude": font_size, "unit": "PT"},
        "bold": bold,
    }

    if color:
        text_style["foregroundColor"] = {"opaqueColor": {"rgbColor": color}}

    requests.append(
        {
            "updateTextStyle": {
                "objectId": element_id,
                "style": text_style,
                "textRange": {"type": "ALL"},
                "fields": "fontSize,bold" + (",foregroundColor" if color else ""),
            }
        }
    )

    return requests


async def create_google_slides_presentation(
    slides: list[SlideContent],
    title: str,
    brand_colors: dict[str, Any] | None = None,
) -> str:
    """Create a Google Slides presentation from slide content.

    Args:
        slides: List of SlideContent objects with slide data.
        title: Title for the presentation.
        brand_colors: Optional brand color dict with "primary" and "secondary" keys.

    Returns:
        URL to edit the created presentation.

    Raises:
        ValueError: If Google credentials are not configured.
        Exception: If API calls fail.
    """
    slides_service = get_slides_service()
    drive_service = get_drive_service()

    # Extract colors for styling
    primary_color = None
    secondary_color = None
    if brand_colors:
        if "primary" in brand_colors and brand_colors["primary"]:
            primary_color = hex_to_rgb_float(brand_colors["primary"])
        elif isinstance(brand_colors, dict):
            # Try to get first color value
            for key, value in brand_colors.items():
                if isinstance(value, str) and len(value) in (6, 7):
                    primary_color = hex_to_rgb_float(value)
                    break

    # Create new presentation
    presentation = slides_service.presentations().create(body={"title": title}).execute()
    presentation_id = presentation["presentationId"]

    logger.info(f"Created presentation {presentation_id} with title: {title}")

    # Get the default slide ID to delete later
    default_slide_id = presentation["slides"][0]["objectId"]

    # Build batch update requests
    requests: list[dict[str, Any]] = []

    # EMU constants (English Metric Units)
    # 1 inch = 914400 EMU
    EMU_PER_INCH = 914400
    SLIDE_WIDTH = 10 * EMU_PER_INCH  # 10 inches
    SLIDE_HEIGHT = 7.5 * EMU_PER_INCH  # 7.5 inches (standard 4:3)

    # Margins and spacing
    MARGIN = 0.5 * EMU_PER_INCH
    TITLE_HEIGHT = 0.8 * EMU_PER_INCH
    BODY_TOP = 1.5 * EMU_PER_INCH

    for idx, slide in enumerate(slides):
        slide_id = f"slide_{idx}"

        # Create blank slide
        requests.append(
            {
                "createSlide": {
                    "objectId": slide_id,
                    "slideLayoutReference": {"predefinedLayout": "BLANK"},
                }
            }
        )

        # Add title text box
        title_id = f"title_{idx}"
        title_text = slide.title or f"Slide {slide.slide_number}"
        requests.extend(
            _create_text_box_request(
                page_id=slide_id,
                element_id=title_id,
                text=title_text,
                x=MARGIN,
                y=MARGIN,
                width=SLIDE_WIDTH - (2 * MARGIN),
                height=TITLE_HEIGHT,
                font_size=32,
                bold=True,
                color=primary_color,
            )
        )

        # Build body content
        body_text = ""
        if slide.body:
            body_text = slide.body
        elif slide.bullets:
            # Format bullets as text with bullet points
            body_text = "\n".join(f"• {bullet}" for bullet in slide.bullets)

        if body_text:
            body_id = f"body_{idx}"
            requests.extend(
                _create_text_box_request(
                    page_id=slide_id,
                    element_id=body_id,
                    text=body_text,
                    x=MARGIN,
                    y=BODY_TOP,
                    width=SLIDE_WIDTH - (2 * MARGIN),
                    height=SLIDE_HEIGHT - BODY_TOP - MARGIN,
                    font_size=18,
                    bold=False,
                    color=secondary_color,
                )
            )

    # Delete the default blank slide
    requests.append({"deleteObject": {"objectId": default_slide_id}})

    # Execute batch update
    if requests:
        slides_service.presentations().batchUpdate(
            presentationId=presentation_id, body={"requests": requests}
        ).execute()
        logger.info(f"Added {len(slides)} slides to presentation {presentation_id}")

    # Set sharing permissions (anyone with link can edit)
    try:
        drive_service.permissions().create(
            fileId=presentation_id,
            body={"type": "anyone", "role": "writer"},
            fields="id",
        ).execute()
        logger.info(f"Set sharing permissions for presentation {presentation_id}")
    except Exception as e:
        logger.warning(f"Failed to set sharing permissions: {e}")

    # Return the edit URL
    edit_url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
    return edit_url
