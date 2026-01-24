"""Deckhand API - AI-powered pitch deck generator."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth

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


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with a pirate greeting."""
    return {
        "message": "Ahoy, matey! Welcome aboard the Deckhand API! Ready to chart yer pitch deck course?",
        "status": "sailing",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
    }
