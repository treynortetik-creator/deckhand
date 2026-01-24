"""Asset service for file upload and asset management."""

import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.asset import Asset

settings = get_settings()

# Allowed file types
ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/svg+xml",
    "image/webp",
}
ALLOWED_DOC_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_DOC_TYPES


def get_upload_dir() -> Path:
    """Get the upload directory path, creating it if necessary."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def save_upload_file(file: UploadFile) -> tuple[str, int]:
    """
    Save an uploaded file to the filesystem.

    Returns:
        tuple of (file_url, file_size)
    """
    upload_dir = get_upload_dir()

    # Generate unique filename to avoid collisions
    file_ext = Path(file.filename or "file").suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = upload_dir / unique_filename

    # Read file content and save
    content = await file.read()
    file_size = len(content)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Return relative URL path
    file_url = f"/{settings.upload_dir}/{unique_filename}"
    return file_url, file_size


def delete_file(file_url: str) -> bool:
    """
    Delete a file from the filesystem.

    Args:
        file_url: The URL path of the file (e.g., /uploads/uuid.png)

    Returns:
        True if file was deleted, False if file didn't exist
    """
    # Convert URL to filesystem path
    # file_url is like /uploads/uuid.png, we need to strip leading slash
    file_path = Path(file_url.lstrip("/"))

    if file_path.exists():
        os.remove(file_path)
        return True
    return False


async def create_asset(
    db: AsyncSession,
    filename: str,
    file_type: str,
    file_url: str,
    file_size: int,
    tags: list[str],
    user_id: int | None,
) -> Asset:
    """Create a new asset record in the database."""
    asset = Asset(
        filename=filename,
        file_type=file_type,
        file_url=file_url,
        file_size=file_size,
        tags=tags,
        uploaded_by=user_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def get_asset(db: AsyncSession, asset_id: int) -> Asset | None:
    """Get an asset by ID."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    return result.scalar_one_or_none()


async def list_assets(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    type_filter: str | None = None,
) -> tuple[list[Asset], int]:
    """
    List assets with pagination and optional type filtering.

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        type_filter: Filter by file type category ("image" or "document")

    Returns:
        tuple of (list of assets, total count)
    """
    query = select(Asset)

    # Apply type filter if provided
    if type_filter == "image":
        query = query.where(Asset.file_type.in_(ALLOWED_IMAGE_TYPES))
    elif type_filter == "document":
        query = query.where(Asset.file_type.in_(ALLOWED_DOC_TYPES))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Asset.uploaded_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    assets = list(result.scalars().all())

    return assets, total


async def update_asset_tags(
    db: AsyncSession,
    asset_id: int,
    tags: list[str],
) -> Asset | None:
    """Update an asset's tags."""
    asset = await get_asset(db, asset_id)
    if asset is None:
        return None

    asset.tags = tags
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(db: AsyncSession, asset_id: int) -> bool:
    """
    Delete an asset from database and filesystem.

    Returns:
        True if asset was deleted, False if asset wasn't found
    """
    asset = await get_asset(db, asset_id)
    if asset is None:
        return False

    # Delete file from filesystem
    delete_file(asset.file_url)

    # Delete from database
    await db.delete(asset)
    await db.commit()
    return True
