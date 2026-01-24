"""Brand service for PDF extraction and brand management."""

import io
import re
from typing import Any

from PyPDF2 import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.schemas.brand import BrandCreate, BrandUpdate

# Common color names to hex mapping
COLOR_MAP: dict[str, str] = {
    "red": "#FF0000",
    "green": "#00FF00",
    "blue": "#0000FF",
    "black": "#000000",
    "white": "#FFFFFF",
    "gray": "#808080",
    "grey": "#808080",
    "navy": "#000080",
    "teal": "#008080",
    "purple": "#800080",
    "orange": "#FFA500",
    "yellow": "#FFFF00",
    "pink": "#FFC0CB",
    "brown": "#A52A2A",
    "cyan": "#00FFFF",
    "magenta": "#FF00FF",
    "coral": "#FF7F50",
    "gold": "#FFD700",
    "silver": "#C0C0C0",
    "maroon": "#800000",
    "olive": "#808000",
    "lime": "#00FF00",
    "aqua": "#00FFFF",
    "indigo": "#4B0082",
    "violet": "#EE82EE",
}


def extract_hex_colors(text: str) -> list[str]:
    """Extract hex color codes (#RRGGBB or #RGB) from text.

    Args:
        text: Text to search for hex colors.

    Returns:
        List of hex color codes found.
    """
    # Match #RRGGBB or #RGB patterns
    pattern = r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b"
    matches = re.findall(pattern, text)
    # Normalize 3-char hex to 6-char
    normalized = []
    for match in matches:
        if len(match) == 4:  # #RGB
            r, g, b = match[1], match[2], match[3]
            normalized.append(f"#{r}{r}{g}{g}{b}{b}".upper())
        else:
            normalized.append(match.upper())
    return list(set(normalized))


def extract_rgb_colors(text: str) -> list[str]:
    """Extract RGB color values and convert to hex.

    Args:
        text: Text to search for RGB colors.

    Returns:
        List of hex color codes converted from RGB.
    """
    # Match rgb(r, g, b) or rgba(r, g, b, a) patterns
    pattern = r"rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})"
    matches = re.findall(pattern, text, re.IGNORECASE)
    hex_colors = []
    for r, g, b in matches:
        r_int, g_int, b_int = int(r), int(g), int(b)
        if all(0 <= c <= 255 for c in [r_int, g_int, b_int]):
            hex_color = f"#{r_int:02X}{g_int:02X}{b_int:02X}"
            hex_colors.append(hex_color)
    return list(set(hex_colors))


def extract_fonts(text: str) -> list[str]:
    """Extract font names from text.

    Args:
        text: Text to search for font names.

    Returns:
        List of font names found.
    """
    # Common font families to look for
    common_fonts = [
        # Sans-serif
        "Arial",
        "Helvetica",
        "Roboto",
        "Open Sans",
        "Lato",
        "Montserrat",
        "Poppins",
        "Inter",
        "Nunito",
        "Raleway",
        "Source Sans Pro",
        "Ubuntu",
        "Oswald",
        "Merriweather Sans",
        "PT Sans",
        "Work Sans",
        "Noto Sans",
        "Fira Sans",
        "Barlow",
        "Mulish",
        "Rubik",
        "Quicksand",
        "Manrope",
        "DM Sans",
        "Plus Jakarta Sans",
        # Serif
        "Times New Roman",
        "Georgia",
        "Merriweather",
        "Playfair Display",
        "Lora",
        "Libre Baskerville",
        "Crimson Text",
        "PT Serif",
        "Noto Serif",
        "EB Garamond",
        "Source Serif Pro",
        # Display
        "Bebas Neue",
        "Archivo",
        "Josefin Sans",
        "Comfortaa",
        "Righteous",
        # Monospace
        "Courier New",
        "Monaco",
        "Consolas",
        "Fira Code",
        "JetBrains Mono",
        "Source Code Pro",
    ]

    found_fonts = []
    text_lower = text.lower()
    for font in common_fonts:
        if font.lower() in text_lower:
            found_fonts.append(font)

    return list(set(found_fonts))


def extract_brand_from_pdf(pdf_content: bytes) -> dict[str, Any]:
    """Extract brand information from PDF content.

    Args:
        pdf_content: Raw PDF file bytes.

    Returns:
        Dictionary with extracted colors, fonts, and guidelines_text.
    """
    try:
        pdf_file = io.BytesIO(pdf_content)
        reader = PdfReader(pdf_file)

        # Extract all text from PDF
        full_text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n"

        # Extract colors
        hex_colors = extract_hex_colors(full_text)
        rgb_colors = extract_rgb_colors(full_text)
        all_colors = list(set(hex_colors + rgb_colors))

        # Build color dictionaries
        primary_colors: dict[str, str] = {}
        secondary_colors: dict[str, str] = {}

        if all_colors:
            # First color as primary
            primary_colors["primary"] = all_colors[0]
            if len(all_colors) > 1:
                primary_colors["secondary"] = all_colors[1]
            if len(all_colors) > 2:
                primary_colors["accent"] = all_colors[2]
            # Remaining colors as secondary
            for i, color in enumerate(all_colors[3:], start=1):
                secondary_colors[f"color{i}"] = color

        # Extract fonts
        found_fonts = extract_fonts(full_text)
        fonts: dict[str, str] = {}
        if found_fonts:
            fonts["heading"] = found_fonts[0]
            if len(found_fonts) > 1:
                fonts["body"] = found_fonts[1]

        return {
            "primary_colors": primary_colors,
            "secondary_colors": secondary_colors,
            "fonts": fonts,
            "guidelines_text": full_text.strip() if full_text.strip() else None,
        }

    except Exception as e:
        # Return empty extraction on error
        return {
            "primary_colors": {},
            "secondary_colors": {},
            "fonts": {},
            "guidelines_text": f"Error extracting PDF: {str(e)}",
        }


async def get_brand(db: AsyncSession) -> Brand | None:
    """Get the singleton brand from the database.

    Args:
        db: Database session.

    Returns:
        Brand instance or None if not found.
    """
    result = await db.execute(select(Brand).order_by(Brand.id).limit(1))
    return result.scalar_one_or_none()


async def create_or_update_brand(
    db: AsyncSession,
    brand_data: BrandCreate | BrandUpdate,
) -> Brand:
    """Create or update the singleton brand.

    Args:
        db: Database session.
        brand_data: Brand data to create or update.

    Returns:
        Created or updated Brand instance.
    """
    existing_brand = await get_brand(db)

    if existing_brand:
        # Update existing brand
        update_data = brand_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_brand, field, value)
        await db.commit()
        await db.refresh(existing_brand)
        return existing_brand
    else:
        # Create new brand
        if isinstance(brand_data, BrandUpdate):
            # Convert BrandUpdate to BrandCreate with defaults
            create_data = BrandCreate(**brand_data.model_dump(exclude_unset=True))
        else:
            create_data = brand_data

        new_brand = Brand(
            name=create_data.name,
            primary_colors=create_data.primary_colors,
            secondary_colors=create_data.secondary_colors,
            fonts=create_data.fonts,
            logo_urls=create_data.logo_urls,
            guidelines_text=create_data.guidelines_text,
        )
        db.add(new_brand)
        await db.commit()
        await db.refresh(new_brand)
        return new_brand
