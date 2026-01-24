"""Asset router for file upload and asset management endpoints."""

import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.asset import AssetListResponse, AssetResponse, AssetUpdate
from app.services.asset import (
    ALLOWED_TYPES,
    create_asset,
    delete_asset,
    get_asset,
    list_assets,
    save_upload_file,
    update_asset_tags,
)

settings = get_settings()
router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    tags: Annotated[str | None, Query(description="JSON array of tags")] = None,
) -> AssetResponse:
    """
    Upload a new asset file.

    Args:
        file: The file to upload
        tags: Optional JSON array of tags (e.g., '["logo", "brand"]')
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"File type '{file.content_type}' not allowed. "
                "Allowed types: images (PNG, JPEG, SVG, WebP) and documents (PDF, DOCX)"
            ),
        )

    # Validate file size
    max_size = settings.max_upload_size_mb * 1024 * 1024
    # Read first chunk to check if file is too large
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
        )
    # Reset file position for save_upload_file
    await file.seek(0)

    # Parse tags from JSON string
    parsed_tags: list[str] = []
    if tags:
        try:
            parsed_tags = json.loads(tags)
            if not isinstance(parsed_tags, list):
                raise ValueError("Tags must be a list")
            parsed_tags = [str(t) for t in parsed_tags]
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid tags format. Expected JSON array. Error: {e}",
            )

    # Save file and create asset record
    file_url, file_size = await save_upload_file(file)
    asset = await create_asset(
        db=db,
        filename=file.filename or "unknown",
        file_type=file.content_type or "application/octet-stream",
        file_url=file_url,
        file_size=file_size,
        tags=parsed_tags,
        user_id=current_user.id,
    )

    return asset


@router.get("", response_model=AssetListResponse)
async def list_assets_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    type_filter: Annotated[
        str | None,
        Query(description="Filter by type: 'image' or 'document'"),
    ] = None,
) -> AssetListResponse:
    """List all assets with pagination and optional type filtering."""
    if type_filter and type_filter not in ("image", "document"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type_filter must be 'image' or 'document'",
        )

    assets, total = await list_assets(
        db=db,
        skip=skip,
        limit=limit,
        type_filter=type_filter,
    )

    return AssetListResponse(assets=assets, total=total)


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset_endpoint(
    asset_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AssetResponse:
    """Get an asset by ID."""
    asset = await get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return asset


@router.get("/{asset_id}/download")
async def download_asset(
    asset_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FileResponse:
    """Download an asset file."""
    asset = await get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    # Convert URL to filesystem path
    file_path = Path(asset.file_url.lstrip("/"))
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk",
        )

    return FileResponse(
        path=file_path,
        filename=asset.filename,
        media_type=asset.file_type,
    )


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset_endpoint(
    asset_id: int,
    asset_update: AssetUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AssetResponse:
    """Update an asset's tags."""
    if asset_update.tags is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided",
        )

    asset = await update_asset_tags(db, asset_id, asset_update.tags)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_endpoint(
    asset_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete an asset and its file."""
    deleted = await delete_asset(db, asset_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
