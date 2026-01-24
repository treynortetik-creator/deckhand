"""Router for model configuration management."""

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.model_config import ModelConfig
from app.routers.auth import get_current_user
from app.services.openrouter import get_openrouter_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/models", tags=["models"])

# Cache for OpenRouter models (refreshes every 5 minutes)
_models_cache: dict[str, Any] = {"data": None, "timestamp": 0}
CACHE_TTL_SECONDS = 300  # 5 minutes

# Known image generation model patterns (for categorization)
IMAGE_MODEL_PATTERNS = [
    "dall-e",
    "flux",
    "stable-diffusion",
    "sdxl",
    "midjourney",
    "imagen",
    "ideogram",
]


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


def _is_image_model(model_id: str) -> bool:
    """Check if a model ID is an image generation model."""
    model_lower = model_id.lower()
    return any(pattern in model_lower for pattern in IMAGE_MODEL_PATTERNS)


async def _fetch_openrouter_models() -> dict[str, list[dict[str, str]]]:
    """Fetch and categorize models from OpenRouter API with caching."""
    global _models_cache

    now = time.time()
    if _models_cache["data"] and (now - _models_cache["timestamp"]) < CACHE_TTL_SECONDS:
        return _models_cache["data"]

    try:
        client = get_openrouter_client()
        raw_models = await client.list_models()

        llm_models = []
        image_models = []

        for model in raw_models:
            model_id = model.get("id", "")
            name = model.get("name", model_id)

            model_entry = {
                "model_id": model_id,
                "display_name": name,
                "context_length": model.get("context_length"),
                "pricing": model.get("pricing"),
            }

            if _is_image_model(model_id):
                image_models.append(model_entry)
            else:
                llm_models.append(model_entry)

        # Sort by name for better UX
        llm_models.sort(key=lambda m: m["display_name"])
        image_models.sort(key=lambda m: m["display_name"])

        result = {"llm": llm_models, "image": image_models}
        _models_cache = {"data": result, "timestamp": now}

        logger.info(
            f"Fetched {len(llm_models)} LLM and "
            f"{len(image_models)} image models from OpenRouter"
        )
        return result

    except Exception as e:
        logger.warning(f"Failed to fetch models from OpenRouter: {e}")
        return {"llm": [], "image": []}


@router.get("/available")
async def get_available_models(
    _: dict = Depends(get_current_user),
) -> dict[str, list[dict[str, Any]]]:
    """Get list of available models from OpenRouter.

    Fetches models directly from OpenRouter API with caching.
    Returns categorized LLM and image models.
    """
    return await _fetch_openrouter_models()


@router.get("/", response_model=list[ModelConfigResponse])
async def list_model_configs(
    model_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> list[ModelConfig]:
    """List all model configurations from database.

    Args:
        model_type: Filter by model type ('llm' or 'image').
        db: Database session.

    Returns:
        List of saved model configurations.
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


@router.post("/refresh-cache")
async def refresh_models_cache(
    _: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Force refresh the OpenRouter models cache.

    Returns:
        Updated model counts.
    """
    global _models_cache
    _models_cache = {"data": None, "timestamp": 0}

    models = await _fetch_openrouter_models()
    return {
        "message": "Cache refreshed",
        "llm_count": len(models.get("llm", [])),
        "image_count": len(models.get("image", [])),
    }
