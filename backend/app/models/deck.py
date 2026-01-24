"""Deck models for generated presentations and version history."""

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Deck(Base):
    """Generated deck/presentation."""

    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    google_slides_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pptx_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generation_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    template = relationship("Template", backref="decks", lazy="selectin")
    creator = relationship("User", backref="decks", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Deck(id={self.id}, title={self.title})>"


class DeckVersion(Base):
    """Version history for deck iterations."""

    __tablename__ = "deck_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    deck_id: Mapped[int] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    assets_used: Mapped[list[Any] | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    google_slides_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pptx_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    deck = relationship("Deck", backref="versions", lazy="selectin")
    template = relationship("Template", lazy="selectin")

    def __repr__(self) -> str:
        return f"<DeckVersion(id={self.id}, deck_id={self.deck_id}, version={self.version_number})>"


class GenerationHistory(Base):
    """History of all deck generation attempts."""

    __tablename__ = "generation_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    assets_used: Mapped[list[Any] | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deck_id: Mapped[int | None] = mapped_column(
        ForeignKey("decks.id", ondelete="SET NULL"), nullable=True
    )
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    template = relationship("Template", lazy="selectin")
    deck = relationship("Deck", backref="generation_history", lazy="selectin")

    def __repr__(self) -> str:
        return f"<GenerationHistory(id={self.id}, success={self.success})>"
