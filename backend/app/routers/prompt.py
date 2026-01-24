"""Prompt router for user prompts and system prompts management."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.prompt import (
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptUpdate,
    SystemPromptResponse,
    SystemPromptUpdate,
)
from app.services.prompt import (
    create_prompt,
    delete_prompt,
    get_all_system_prompts,
    get_prompt,
    list_prompts,
    seed_system_prompts,
    update_prompt,
    update_system_prompt,
)

router = APIRouter(prefix="/prompts", tags=["prompts"])


# System prompt routes must be defined BEFORE the /{prompt_id} route
# to avoid conflicts with path matching


@router.get("/system/all", response_model=list[SystemPromptResponse])
async def get_system_prompts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SystemPromptResponse]:
    """Get all system prompts."""
    system_prompts = await get_all_system_prompts(db)
    return system_prompts


@router.put("/system/{name}", response_model=SystemPromptResponse)
async def update_system_prompt_endpoint(
    name: str,
    update_data: SystemPromptUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SystemPromptResponse:
    """Update a system prompt by name (creates if it doesn't exist)."""
    system_prompt = await update_system_prompt(db, name, update_data.prompt_text)
    return system_prompt


@router.post("/system/seed", response_model=list[SystemPromptResponse])
async def seed_system_prompts_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SystemPromptResponse]:
    """Seed default system prompts if they don't exist."""
    system_prompts = await seed_system_prompts(db)
    return system_prompts


# User prompt routes


@router.post("", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_endpoint(
    prompt_data: PromptCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PromptResponse:
    """Create a new user prompt."""
    prompt = await create_prompt(
        db=db,
        name=prompt_data.name,
        prompt_text=prompt_data.prompt_text,
        description=prompt_data.description,
        user_id=current_user.id,
    )
    return prompt


@router.get("", response_model=PromptListResponse)
async def list_prompts_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PromptListResponse:
    """List all user prompts with pagination."""
    prompts, total = await list_prompts(db=db, skip=skip, limit=limit)
    return PromptListResponse(prompts=prompts, total=total)


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt_endpoint(
    prompt_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PromptResponse:
    """Get a prompt by ID."""
    prompt = await get_prompt(db, prompt_id)
    if prompt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
    return prompt


@router.patch("/{prompt_id}", response_model=PromptResponse)
async def update_prompt_endpoint(
    prompt_id: int,
    prompt_update: PromptUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PromptResponse:
    """Update a prompt by ID."""
    update_data = prompt_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided",
        )

    prompt = await update_prompt(db, prompt_id, update_data)
    if prompt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
    return prompt


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_endpoint(
    prompt_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a prompt by ID."""
    deleted = await delete_prompt(db, prompt_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
