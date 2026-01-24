"""Prompt service for user prompts and system prompts management."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prompt import Prompt, SystemPrompt

# Default system prompts
DEFAULT_SYSTEM_PROMPTS: dict[str, str] = {
    "deck_generation": (
        "You are an expert pitch deck consultant. Your task is to generate "
        "professional, compelling pitch deck content based on the user's "
        "business information. Create clear, concise slides that tell a "
        "compelling story about the business, its value proposition, market "
        "opportunity, and growth potential.\n\n"
        "Follow these guidelines:\n"
        "- Keep text concise and impactful\n"
        "- Use data and metrics where possible\n"
        "- Structure content logically\n"
        "- Focus on the value proposition\n"
        "- Address the target audience's concerns"
    ),
    "content_agent": (
        "You are a professional content writer specializing in business "
        "communication. Help users refine and improve their pitch deck "
        "content. Suggest improvements for clarity, impact, and "
        "persuasiveness while maintaining the user's voice and key messages.\n\n"
        "Focus on:\n"
        "- Clear and concise language\n"
        "- Strong value propositions\n"
        "- Compelling storytelling\n"
        "- Professional tone\n"
        "- Audience engagement"
    ),
    "image_generation": (
        "Generate professional, clean images suitable for business "
        "presentations. The images should be:\n"
        "- Minimalist and modern design\n"
        "- Corporate-friendly color palette\n"
        "- High contrast for readability\n"
        "- Suitable for slide backgrounds or illustrations\n"
        "- Abstract or conceptual rather than literal representations"
    ),
}


async def create_prompt(
    db: AsyncSession,
    name: str,
    prompt_text: str,
    description: str | None = None,
    user_id: int | None = None,
) -> Prompt:
    """Create a new user prompt."""
    prompt = Prompt(
        name=name,
        prompt_text=prompt_text,
        description=description,
        created_by=user_id,
    )
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def get_prompt(db: AsyncSession, prompt_id: int) -> Prompt | None:
    """Get a prompt by ID."""
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    return result.scalar_one_or_none()


async def list_prompts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Prompt], int]:
    """
    List prompts with pagination.

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        tuple of (list of prompts, total count)
    """
    query = select(Prompt)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Prompt.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    prompts = list(result.scalars().all())

    return prompts, total


async def update_prompt(
    db: AsyncSession,
    prompt_id: int,
    update_data: dict,
) -> Prompt | None:
    """Update a prompt with the provided data."""
    prompt = await get_prompt(db, prompt_id)
    if prompt is None:
        return None

    for key, value in update_data.items():
        if value is not None and hasattr(prompt, key):
            setattr(prompt, key, value)

    await db.commit()
    await db.refresh(prompt)
    return prompt


async def delete_prompt(db: AsyncSession, prompt_id: int) -> bool:
    """
    Delete a prompt from the database.

    Returns:
        True if prompt was deleted, False if prompt wasn't found
    """
    prompt = await get_prompt(db, prompt_id)
    if prompt is None:
        return False

    await db.delete(prompt)
    await db.commit()
    return True


async def get_system_prompt(db: AsyncSession, name: str) -> SystemPrompt | None:
    """Get a system prompt by name."""
    result = await db.execute(
        select(SystemPrompt).where(SystemPrompt.name == name)
    )
    return result.scalar_one_or_none()


async def get_all_system_prompts(db: AsyncSession) -> list[SystemPrompt]:
    """Get all system prompts."""
    result = await db.execute(
        select(SystemPrompt).order_by(SystemPrompt.name)
    )
    return list(result.scalars().all())


async def update_system_prompt(
    db: AsyncSession,
    name: str,
    prompt_text: str,
) -> SystemPrompt:
    """
    Update or create a system prompt (upsert).

    If the system prompt exists, update it. Otherwise, create it.
    """
    system_prompt = await get_system_prompt(db, name)

    if system_prompt is None:
        # Create new system prompt
        system_prompt = SystemPrompt(
            name=name,
            prompt_text=prompt_text,
        )
        db.add(system_prompt)
    else:
        # Update existing
        system_prompt.prompt_text = prompt_text

    await db.commit()
    await db.refresh(system_prompt)
    return system_prompt


async def seed_system_prompts(db: AsyncSession) -> list[SystemPrompt]:
    """
    Seed default system prompts if they don't exist.

    Returns a list of all system prompts after seeding.
    """
    seeded = []
    for name, prompt_text in DEFAULT_SYSTEM_PROMPTS.items():
        existing = await get_system_prompt(db, name)
        if existing is None:
            system_prompt = SystemPrompt(
                name=name,
                prompt_text=prompt_text,
            )
            db.add(system_prompt)
            seeded.append(system_prompt)

    if seeded:
        await db.commit()
        for prompt in seeded:
            await db.refresh(prompt)

    return await get_all_system_prompts(db)
