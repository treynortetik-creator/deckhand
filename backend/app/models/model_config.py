"""Model configuration for LLM and Image generation models."""

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModelConfig(Base):
    """Configuration for AI models available through OpenRouter."""

    __tablename__ = "model_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # model_type: 'llm' or 'image'
    model_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # agent_type: 'default', 'outline', 'content' (for LLM models)
    # Allows per-agent model selection. 'default' is used as fallback.
    agent_type: Mapped[str] = mapped_column(String(50), default="default", nullable=False)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, default=dict, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ModelConfig(id={self.id}, model_id={self.model_id}, "
            f"type={self.model_type})>"
        )
