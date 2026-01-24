"""Deckhand API - AI-powered pitch deck generator."""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import (
    asset,
    auth,
    brand,
    export,
    generate,
    history,
    models,
    prompt,
    template,
)

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
app.include_router(export.router)
app.include_router(models.router)
app.include_router(template.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(prompt.router)


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
    # Mount entire static directory with html=True for SPA support
    # html=True serves index.html for directory requests and 404s
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
