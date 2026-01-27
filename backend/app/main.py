"""Deckhand API - AI-powered pitch deck generator."""

import asyncio
import logging
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import async_session
from app.models.error import Error
from app.routers import (
    asset,
    auth,
    brand,
    error,
    export,
    generate,
    history,
    models,
    prompt,
    template,
)

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-powered pitch deck generator API",
    version="0.1.0",
    debug=settings.debug,
)

# CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(asset.router)
app.include_router(brand.router)
app.include_router(error.router)
app.include_router(export.router)
app.include_router(models.router)
app.include_router(template.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(prompt.router)


# ============================================================================
# Global Exception Handler
# ============================================================================


async def send_webhook_notification(error_data: dict[str, Any]) -> None:
    """Send error notification to Clawdbot webhook (fire-and-forget)."""
    webhook_url = settings.clawdbot_webhook_url
    if not webhook_url:
        return

    payload = {
        "type": "error",
        "app": "deckhand",
        "error": error_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(webhook_url, json=payload)
    except Exception as e:
        logger.warning(f"Failed to send webhook notification: {e}")


async def log_error_to_db(
    endpoint: str,
    method: str,
    status_code: int,
    error_type: str,
    error_message: str,
    tb: str | None = None,
    user_id: int | None = None,
    request_body: dict[str, Any] | None = None,
) -> int | None:
    """Log error to database and return error ID."""
    try:
        async with async_session() as session:
            error_record = Error(
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                error_type=error_type,
                error_message=error_message,
                traceback=tb,
                user_id=user_id,
                request_body=request_body,
            )
            session.add(error_record)
            await session.commit()
            await session.refresh(error_record)
            return error_record.id
    except Exception as e:
        logger.error(f"Failed to log error to database: {e}")
        return None


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all unhandled exceptions, log to database, and send webhook."""
    # Extract request info
    endpoint = str(request.url.path)
    method = request.method
    status_code = 500
    error_type = type(exc).__name__
    error_message = str(exc)
    tb = traceback.format_exc()

    # Try to get user_id from request state (if auth middleware sets it)
    user_id = getattr(request.state, "user_id", None)

    # Try to get request body (may not be available)
    request_body = None
    try:
        if request.method in ("POST", "PUT", "PATCH"):
            body = await request.body()
            if body:
                import json

                request_body = json.loads(body.decode("utf-8"))
    except Exception:
        pass

    # Log error
    logger.exception(f"Unhandled exception on {method} {endpoint}: {error_message}")

    # Log to database
    error_id = await log_error_to_db(
        endpoint=endpoint,
        method=method,
        status_code=status_code,
        error_type=error_type,
        error_message=error_message,
        tb=tb,
        user_id=user_id,
        request_body=request_body,
    )

    # Send webhook notification (non-blocking)
    error_data = {
        "id": error_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
        "error_type": error_type,
        "error_message": error_message,
    }
    asyncio.create_task(send_webhook_notification(error_data))

    # Return sanitized error response
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": "An internal server error occurred",
            "error_id": error_id,
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
    }


@app.get("/api")
async def api_root() -> dict[str, str]:
    """API root endpoint with a pirate greeting."""
    return {
        "message": (
            "Ahoy, matey! Welcome aboard the Deckhand API! "
            "Ready to chart yer pitch deck course?"
        ),
        "status": "sailing",
    }


# Serve static frontend files in production
# Must be mounted LAST so API routes take precedence
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.exists():
    # Mount assets directory for static files (JS, CSS, images)
    ASSETS_DIR = STATIC_DIR / "assets"
    if ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    # Catch-all route for SPA - serves index.html for any non-API route
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA support)."""
        file_path = STATIC_DIR / full_path
        # Serve the file if it exists (e.g., favicon.ico)
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(STATIC_DIR / "index.html")
