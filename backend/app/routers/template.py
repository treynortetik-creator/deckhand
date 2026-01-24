"""Template router for CRUD operations."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.template import (
    TemplateCreate,
    TemplateListResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services.template import (
    create_template,
    delete_template,
    get_template,
    list_templates,
    seed_starter_templates,
    update_template,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post(
    "/seed",
    response_model=list[TemplateResponse],
    status_code=status.HTTP_201_CREATED,
)
async def seed_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    """
    Seed starter templates (Pitch Deck, Event Recap).

    Creates templates only if they don't already exist.
    Returns the list of newly created templates.
    """
    templates = await seed_starter_templates(db)
    return templates


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_new_template(
    template_data: TemplateCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TemplateResponse:
    """Create a new template."""
    # Convert slide definitions to dicts for storage
    slide_structure = [slide.model_dump() for slide in template_data.slide_structure]

    template = await create_template(
        db=db,
        name=template_data.name,
        description=template_data.description,
        slide_structure=slide_structure,
        user_id=current_user.id,
    )
    return template


@router.get("/", response_model=TemplateListResponse)
async def get_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(0, ge=0, description="Number of templates to skip"),
    limit: int = Query(100, ge=1, le=100, description="Max templates to return"),
) -> TemplateListResponse:
    """List all templates with pagination."""
    templates, total = await list_templates(db, skip=skip, limit=limit)
    return TemplateListResponse(templates=templates, total=total)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template_by_id(
    template_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TemplateResponse:
    """Get a template by ID."""
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template_by_id(
    template_id: int,
    template_data: TemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TemplateResponse:
    """Update a template by ID."""
    # Build update dict, converting slide definitions if present
    update_dict = template_data.model_dump(exclude_unset=True)
    if "slide_structure" in update_dict and update_dict["slide_structure"] is not None:
        update_dict["slide_structure"] = [
            slide.model_dump() for slide in template_data.slide_structure
        ]

    template = await update_template(db, template_id, update_dict)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_by_id(
    template_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a template by ID."""
    deleted = await delete_template(db, template_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
