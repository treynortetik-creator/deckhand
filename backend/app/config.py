"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Deckhand"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/deckhand"

    # Authentication
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # OpenRouter LLM
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    default_llm_model: str = "anthropic/claude-3.5-sonnet"
    default_image_model: str = "openai/dall-e-3"

    # Google API
    google_credentials_json: str | None = None

    # File Upload
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 50


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
