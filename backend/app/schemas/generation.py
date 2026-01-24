"""Generation schemas for deck creation request/response validation."""

from pydantic import BaseModel, Field


class SlideContent(BaseModel):
    """Schema for individual slide content."""

    slide_number: int
    slide_type: str = Field(
        description=(
            "Type of slide: title, content, bullets, image, two-column, quote, etc."
        )
    )
    title: str
    body: str | None = None
    bullets: list[str] | None = None
    image_prompt: str | None = Field(
        default=None, description="Prompt for generating an image for this slide"
    )
    image_url: str | None = Field(
        default=None, description="URL of generated or provided image"
    )
    speaker_notes: str | None = None


class DeckOutline(BaseModel):
    """Schema for complete deck outline with all slides."""

    title: str
    slides: list[SlideContent]
    summary: str = Field(description="Brief summary of the deck's purpose and content")


class GenerationRequest(BaseModel):
    """Schema for deck generation request."""

    prompt: str = Field(
        min_length=10, description="Description of the deck to generate"
    )
    template_id: int | None = None
    slide_count: int = Field(default=10, ge=3, le=50)
    tone: str = Field(
        default="professional",
        description=(
            "Tone of the presentation: professional, casual, formal, inspirational"
        ),
    )
    asset_ids: list[int] = Field(default_factory=list)


class GenerationProgress(BaseModel):
    """Schema for tracking generation progress via WebSocket or polling."""

    status: str = Field(
        description=(
            "Current status: pending, generating_outline, generating_slides, "
            "generating_images, complete, error"
        )
    )
    current_step: int
    total_steps: int
    message: str
    slide_progress: dict[int, str] = Field(
        default_factory=dict, description="Per-slide generation status"
    )


class GenerationResult(BaseModel):
    """Schema for completed deck generation result."""

    deck_id: int
    title: str
    google_slides_url: str | None = None
    pptx_download_url: str | None = None
    generation_time_seconds: float
    slides_generated: int
