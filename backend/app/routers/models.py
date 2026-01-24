"""Router for model configuration management."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.model_config import ModelConfig
from app.routers.auth import get_current_user

router = APIRouter(prefix="/models", tags=["models"])


class ModelConfigResponse(BaseModel):
    """Model configuration response schema."""

    id: int
    model_type: str
    model_id: str
    display_name: str
    is_default: bool
    is_enabled: bool
    config: dict[str, Any] | None = None

    class Config:
        from_attributes = True


class ModelConfigUpdate(BaseModel):
    """Model configuration update schema."""

    is_default: bool | None = None
    is_enabled: bool | None = None
    config: dict[str, Any] | None = None


class ModelConfigCreate(BaseModel):
    """Model configuration create schema."""

    model_type: str  # 'llm' or 'image'
    model_id: str
    display_name: str
    is_default: bool = False
    is_enabled: bool = True
    config: dict[str, Any] | None = None


# Available models on OpenRouter - curated list with proper IDs
OPENROUTER_MODELS = {
    "llm": [
        {
            "model_id": "anthropic/claude-3.5-sonnet",
            "display_name": "Claude 3.5 Sonnet",
        },
        {"model_id": "anthropic/claude-3-opus", "display_name": "Claude 3 Opus"},
        {"model_id": "anthropic/claude-3-haiku", "display_name": "Claude 3 Haiku"},
        {"model_id": "openai/gpt-4o", "display_name": "GPT-4o"},
        {"model_id": "openai/gpt-4o-mini", "display_name": "GPT-4o Mini"},
        {"model_id": "openai/gpt-4-turbo", "display_name": "GPT-4 Turbo"},
        {"model_id": "google/gemini-pro-1.5", "display_name": "Gemini Pro 1.5"},
        {"model_id": "google/gemini-flash-1.5", "display_name": "Gemini Flash 1.5"},
        {
            "model_id": "meta-llama/llama-3.1-70b-instruct",
            "display_name": "Llama 3.1 70B",
        },
        {
            "model_id": "meta-llama/llama-3.1-8b-instruct",
            "display_name": "Llama 3.1 8B",
        },
        {"model_id": "mistralai/mistral-large", "display_name": "Mistral Large"},
        {"model_id": "mistralai/mixtral-8x7b-instruct", "display_name": "Mixtral 8x7B"},
        {"model_id": "deepseek/deepseek-chat", "display_name": "DeepSeek Chat"},
        {"model_id": "qwen/qwen-2.5-72b-instruct", "display_name": "Qwen 2.5 72B"},
    ],
    "image": [
        {"model_id": "openai/dall-e-3", "display_name": "DALL-E 3"},
        {"model_id": "openai/dall-e-2", "display_name": "DALL-E 2"},
        {
            "model_id": "black-forest-labs/flux-1-dev",
            "display_name": "Flux 1 Dev (Nana Banana)",
        },
        {
            "model_id": "black-forest-labs/flux-schnell",
            "display_name": "Flux Schnell (Nana Banana)",
        },
        {
            "model_id": "black-forest-labs/flux-1.1-pro",
            "display_name": "Flux 1.1 Pro",
        },
        {
            "model_id": "stability-ai/stable-diffusion-3",
            "display_name": "Stable Diffusion 3",
        },
        {"model_id": "stability-ai/sdxl", "display_name": "SDXL"},
    ],
}


@router.get("/available", response_model=dict[str, list[dict[str, str]]])
async def get_available_models(
    _: dict = Depends(get_current_user),
) -> dict[str, list[dict[str, str]]]:
    """Get list of available models from OpenRouter.

    Returns curated list of LLM and image models.
    """
    return OPENROUTER_MODELS


@router.get("/", response_model=list[ModelConfigResponse])
async def list_model_configs(
    model_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> list[ModelConfig]:
    """List all model configurations.

    Args:
        model_type: Filter by model type ('llm' or 'image').
        db: Database session.

    Returns:
        List of model configurations.
    """
    query = select(ModelConfig)
    if model_type:
        query = query.where(ModelConfig.model_type == model_type)
    query = query.order_by(ModelConfig.model_type, ModelConfig.display_name)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/defaults", response_model=dict[str, ModelConfigResponse | None])
async def get_default_models(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> dict[str, ModelConfig | None]:
    """Get default models for each type.

    Returns:
        Dict with 'llm' and 'image' default model configs.
    """
    defaults = {}

    for model_type in ["llm", "image"]:
        result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.model_type == model_type,
                ModelConfig.is_default == True,  # noqa: E712
            )
        )
        defaults[model_type] = result.scalar_one_or_none()

    return defaults


@router.post("/", response_model=ModelConfigResponse)
async def create_model_config(
    config: ModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> ModelConfig:
    """Create a new model configuration.

    Args:
        config: Model configuration data.
        db: Database session.

    Returns:
        Created model configuration.
    """
    # If this is set as default, unset other defaults of same type
    if config.is_default:
        await db.execute(
            update(ModelConfig)
            .where(ModelConfig.model_type == config.model_type)
            .values(is_default=False)
        )

    model_config = ModelConfig(
        model_type=config.model_type,
        model_id=config.model_id,
        display_name=config.display_name,
        is_default=config.is_default,
        is_enabled=config.is_enabled,
        config=config.config or {},
    )
    db.add(model_config)
    await db.commit()
    await db.refresh(model_config)
    return model_config


@router.patch("/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: int,
    updates: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> ModelConfig:
    """Update a model configuration.

    Args:
        config_id: ID of the configuration to update.
        updates: Fields to update.
        db: Database session.

    Returns:
        Updated model configuration.
    """
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.id == config_id)
    )
    model_config = result.scalar_one_or_none()

    if not model_config:
        raise HTTPException(status_code=404, detail="Model configuration not found")

    # If setting as default, unset other defaults of same type
    if updates.is_default is True:
        await db.execute(
            update(ModelConfig)
            .where(
                ModelConfig.model_type == model_config.model_type,
                ModelConfig.id != config_id,
            )
            .values(is_default=False)
        )

    # Apply updates
    if updates.is_default is not None:
        model_config.is_default = updates.is_default
    if updates.is_enabled is not None:
        model_config.is_enabled = updates.is_enabled
    if updates.config is not None:
        model_config.config = updates.config

    await db.commit()
    await db.refresh(model_config)
    return model_config


@router.delete("/{config_id}")
async def delete_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a model configuration.

    Args:
        config_id: ID of the configuration to delete.
        db: Database session.

    Returns:
        Success message.
    """
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.id == config_id)
    )
    model_config = result.scalar_one_or_none()

    if not model_config:
        raise HTTPException(status_code=404, detail="Model configuration not found")

    await db.delete(model_config)
    await db.commit()
    return {"message": "Model configuration deleted"}


@router.post("/seed")
async def seed_default_models(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Seed the database with default model configurations.

    Only adds models that don't already exist.
    """
    added = 0

    for model_type, models in OPENROUTER_MODELS.items():
        for i, model in enumerate(models):
            # Check if model already exists
            result = await db.execute(
                select(ModelConfig).where(ModelConfig.model_id == model["model_id"])
            )
            if result.scalar_one_or_none():
                continue

            # First model of each type is default
            is_default = i == 0

            model_config = ModelConfig(
                model_type=model_type,
                model_id=model["model_id"],
                display_name=model["display_name"],
                is_default=is_default,
                is_enabled=True,
                config={},
            )
            db.add(model_config)
            added += 1

    await db.commit()
    return {"message": f"Added {added} model configurations"}
