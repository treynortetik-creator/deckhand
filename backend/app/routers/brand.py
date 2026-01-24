"""Brand router for brand management and PDF upload endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.brand import BrandCreate, BrandResponse, BrandUpdate
from app.services.brand import (
    create_or_update_brand,
    extract_brand_from_pdf,
    get_brand,
)

router = APIRouter(prefix="/brand", tags=["brand"])


@router.get("", response_model=BrandResponse)
async def get_current_brand(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BrandResponse:
    """Get the current brand configuration.

    Requires authentication.
    """
    brand = await get_brand(db)
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No brand configured",
        )
    return brand


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    brand_data: BrandCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BrandResponse:
    """Create or update brand configuration from JSON.

    Requires authentication.
    """
    brand = await create_or_update_brand(db, brand_data)
    return brand


@router.patch("", response_model=BrandResponse)
async def update_brand(
    brand_data: BrandUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BrandResponse:
    """Partial update of brand configuration.

    Requires authentication.
    """
    brand = await create_or_update_brand(db, brand_data)
    return brand


@router.post(
    "/upload-pdf",
    response_model=BrandResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_brand_pdf(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandResponse:
    """Upload a PDF file to extract brand information.

    Extracts colors, fonts, and text from the PDF and saves to the brand.
    Requires authentication.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )

    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )

    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading file: {str(e)}",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    # Extract brand info from PDF
    extracted = extract_brand_from_pdf(content)

    # Create brand data from extraction
    brand_data = BrandCreate(
        primary_colors=extracted["primary_colors"],
        secondary_colors=extracted["secondary_colors"],
        fonts=extracted["fonts"],
        guidelines_text=extracted["guidelines_text"],
    )

    # Save to database
    brand = await create_or_update_brand(db, brand_data)
    return brand
