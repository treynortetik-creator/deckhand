"""Application configuration using pydantic-settings."""

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_INSECURE_DEFAULT_KEY = "your-secret-key-change-in-production"


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
    secret_key: str = _INSECURE_DEFAULT_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS - comma-separated list of allowed origins
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

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

    # Error Tracking
    clawdbot_webhook_url: str | None = None
    clawdbot_webhook_secret: str | None = None

    def get_cors_origins(self) -> list[str]:
        """Parse cors_origins string into a list of origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def warn_if_insecure(self) -> None:
        """Log a warning if running with insecure defaults."""
        if self.secret_key == _INSECURE_DEFAULT_KEY:
            logger.warning(
                "SECRET_KEY is using the insecure default value. "
                "Set the SECRET_KEY environment variable before deploying to production."
            )


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    settings = Settings()
    settings.warn_if_insecure()
    return settings
