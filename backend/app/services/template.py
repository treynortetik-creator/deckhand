"""Template service for CRUD operations and starter templates."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import Template

# Starter template definitions
PITCH_DECK_TEMPLATE: dict = {
    "name": "Pitch Deck",
    "description": (
        "A classic 10-slide pitch deck structure for startup fundraising "
        "and investor presentations."
    ),
    "slide_structure": [
        {
            "type": "title",
            "placeholders": ["company_name", "tagline", "logo"],
        },
        {
            "type": "problem",
            "placeholders": ["problem_statement", "pain_points", "market_gap"],
        },
        {
            "type": "solution",
            "placeholders": ["solution_overview", "key_features", "value_proposition"],
        },
        {
            "type": "market",
            "placeholders": ["market_size", "tam_sam_som", "growth_rate"],
        },
        {
            "type": "product",
            "placeholders": ["product_demo", "screenshots", "key_benefits"],
        },
        {
            "type": "business_model",
            "placeholders": ["revenue_streams", "pricing", "unit_economics"],
        },
        {
            "type": "traction",
            "placeholders": ["metrics", "milestones", "growth_chart"],
        },
        {
            "type": "competition",
            "placeholders": ["competitive_landscape", "differentiators", "moat"],
        },
        {
            "type": "team",
            "placeholders": ["founders", "key_hires", "advisors"],
        },
        {
            "type": "ask",
            "placeholders": ["funding_amount", "use_of_funds", "contact_info"],
        },
    ],
}

EVENT_RECAP_TEMPLATE: dict = {
    "name": "Event Recap",
    "description": (
        "An 8-slide template for summarizing events, conferences, "
        "and company gatherings."
    ),
    "slide_structure": [
        {
            "type": "title",
            "placeholders": ["event_name", "date", "location", "logo"],
        },
        {
            "type": "overview",
            "placeholders": ["event_description", "objectives", "theme"],
        },
        {
            "type": "highlights",
            "placeholders": ["key_moments", "photos", "quotes"],
        },
        {
            "type": "speakers",
            "placeholders": ["speaker_list", "topics", "headshots"],
        },
        {
            "type": "attendance",
            "placeholders": ["attendee_count", "demographics", "feedback_stats"],
        },
        {
            "type": "activities",
            "placeholders": ["sessions", "workshops", "networking"],
        },
        {
            "type": "outcomes",
            "placeholders": ["achievements", "learnings", "connections_made"],
        },
        {
            "type": "next_steps",
            "placeholders": ["follow_ups", "future_events", "call_to_action"],
        },
    ],
}


async def seed_starter_templates(db: AsyncSession) -> list[Template]:
    """
    Create starter templates if they don't already exist.

    Returns a list of created templates (empty if they already existed).
    """
    created_templates: list[Template] = []

    for template_def in [PITCH_DECK_TEMPLATE, EVENT_RECAP_TEMPLATE]:
        # Check if template with this name already exists
        result = await db.execute(
            select(Template).where(Template.name == template_def["name"])
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            template = Template(
                name=template_def["name"],
                description=template_def["description"],
                slide_structure=template_def["slide_structure"],
                created_by=None,  # System-created templates have no creator
            )
            db.add(template)
            created_templates.append(template)

    if created_templates:
        await db.commit()
        for template in created_templates:
            await db.refresh(template)

    return created_templates


async def create_template(
    db: AsyncSession,
    name: str,
    description: str | None,
    slide_structure: list[dict],
    user_id: int | None = None,
) -> Template:
    """Create a new template."""
    template = Template(
        name=name,
        description=description,
        slide_structure=slide_structure,
        created_by=user_id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def get_template(db: AsyncSession, template_id: int) -> Template | None:
    """Get a template by ID."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    return result.scalar_one_or_none()


async def list_templates(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[Template], int]:
    """
    List templates with pagination.

    Returns a tuple of (templates, total_count).
    """
    # Get total count
    count_result = await db.execute(select(func.count(Template.id)))
    total = count_result.scalar_one()

    # Get paginated results
    result = await db.execute(
        select(Template)
        .order_by(Template.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    templates = list(result.scalars().all())

    return templates, total


async def update_template(
    db: AsyncSession,
    template_id: int,
    update_data: dict,
) -> Template | None:
    """
    Update a template by ID.

    Returns the updated template or None if not found.
    """
    template = await get_template(db, template_id)
    if template is None:
        return None

    for key, value in update_data.items():
        if value is not None:
            setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template_id: int) -> bool:
    """
    Delete a template by ID.

    Returns True if deleted, False if not found.
    """
    template = await get_template(db, template_id)
    if template is None:
        return False

    await db.delete(template)
    await db.commit()
    return True
