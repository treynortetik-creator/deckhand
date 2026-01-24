# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (no API URL = same origin)
RUN npm run build

# Stage 2: Setup backend with frontend static files
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package installation
RUN pip install uv

# Copy backend dependency files
COPY backend/pyproject.toml backend/uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Copy backend application code
COPY backend/ .

# Copy built frontend to static directory
COPY --from=frontend-builder /frontend/dist ./static

# Create uploads directory
RUN mkdir -p uploads

# Expose port (Railway uses $PORT)
EXPOSE 8000

# Run the application with Railway's PORT or default to 8000
CMD uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
