# Error Handling Feature Design

## Overview

Add comprehensive error tracking to Deckhand with a database-backed error log, admin UI for viewing/managing errors, and webhook notifications for external alerting.

## Backend Components

### 1. Error Model (`backend/app/models/error.py`)

```python
class Error(Base):
    __tablename__ = "errors"

    id: int (primary key)
    timestamp: datetime (server_default=now)
    endpoint: str (255 chars)
    method: str (10 chars) - GET, POST, PATCH, DELETE
    status_code: int
    error_type: str (255 chars) - exception class name
    error_message: text
    traceback: text (nullable)
    user_id: int (FK to users, nullable, SET NULL on delete)
    request_body: JSONB (nullable)
    resolved: bool (default=False)
    resolved_at: datetime (nullable)
    notes: text (nullable)
```

Indexes: timestamp, resolved, error_type

### 2. Error Schemas (`backend/app/schemas/error.py`)

- **ErrorCreate**: For internal use when logging errors
- **ErrorResponse**: Full error details for API responses
- **ErrorListResponse**: Paginated list with total count
- **ErrorUpdate**: For PATCH (resolved, notes)

### 3. Error Router (`backend/app/routers/error.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/errors` | GET | List errors with pagination, filters |
| `/api/errors/{id}` | GET | Get single error details |
| `/api/errors/{id}` | PATCH | Mark resolved, add notes |
| `/api/errors/{id}` | DELETE | Delete single error |
| `/api/errors/clear-resolved` | POST | Bulk delete resolved errors |

**Filters for GET /api/errors:**
- `resolved`: bool
- `start_date`, `end_date`: datetime range
- `error_type`: string
- `skip`, `limit`: pagination

### 4. Global Exception Handler (`backend/app/main.py`)

- Catches all unhandled exceptions
- Logs to error table with full context
- Sends async webhook notification (non-blocking)
- Returns sanitized error response to client

### 5. Webhook Integration

- Environment variable: `CLAWDBOT_WEBHOOK_URL` (optional)
- Payload format:
  ```json
  {
    "type": "error",
    "app": "deckhand",
    "error": {
      "id": 123,
      "timestamp": "2026-01-27T10:30:00Z",
      "endpoint": "/api/generate",
      "method": "POST",
      "status_code": 500,
      "error_type": "ValueError",
      "error_message": "Invalid template ID"
    },
    "timestamp": "2026-01-27T10:30:00Z"
  }
  ```
- Fire-and-forget with 5s timeout, log failures but don't block

## Frontend Components

### Admin Panel Errors Tab

- Add "Errors" tab to existing Admin.tsx
- Table columns: timestamp, endpoint, error_type, message (truncated), resolved status
- Click row to expand: full traceback, request body, notes
- Actions: Mark resolved, add notes, delete
- Filters: resolved/unresolved toggle, date range picker
- Bulk action: Clear all resolved errors

## Implementation Order

1. Create model and add to models/__init__.py
2. Create Alembic migration
3. Create schemas
4. Create router with all endpoints
5. Add global exception handler to main.py
6. Add webhook config to settings
7. Register router in main.py
8. Add frontend API client
9. Create ErrorsTab component in Admin.tsx
