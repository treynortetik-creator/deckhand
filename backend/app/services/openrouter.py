"""OpenRouter service for LLM-powered deck generation."""

import asyncio
import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings
from app.schemas.generation import DeckOutline, SlideContent

logger = logging.getLogger(__name__)
settings = get_settings()

# Singleton client instance
_openrouter_client: "OpenRouterClient | None" = None


class OpenRouterClient:
    """Async HTTP client for OpenRouter API."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        """Initialize the OpenRouter client.

        Args:
            api_key: OpenRouter API key. Defaults to settings.
            base_url: OpenRouter base URL. Defaults to settings.
        """
        self.api_key = api_key or settings.openrouter_api_key
        self.base_url = base_url or settings.openrouter_base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://deckhand.ai",
            "X-Title": "Deckhand",
        }
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.headers,
                timeout=120.0,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion request to OpenRouter.

        Args:
            messages: List of message dicts with role and content.
            model: Model to use. Defaults to settings.default_llm_model.
            temperature: Sampling temperature (0-2).
            max_tokens: Maximum tokens in response.

        Returns:
            The content of the assistant's response.

        Raises:
            httpx.HTTPStatusError: If the API request fails.
            ValueError: If response format is unexpected.
        """
        client = await self._get_client()
        model = model or settings.default_llm_model

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = await client.post("/chat/completions", json=payload)
        response.raise_for_status()

        data = response.json()

        if "choices" not in data or not data["choices"]:
            raise ValueError(f"Unexpected API response format: {data}")

        return data["choices"][0]["message"]["content"]

    async def generate_image(
        self,
        prompt: str,
        model: str | None = None,
    ) -> str | None:
        """Generate an image using OpenRouter's image generation.

        Args:
            prompt: Description of the image to generate.
            model: Image model to use. Defaults to settings.default_image_model.

        Returns:
            URL of the generated image, or None if generation fails.
        """
        client = await self._get_client()
        model = model or settings.default_image_model

        payload = {
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
        }

        try:
            response = await client.post("/images/generations", json=payload)
            response.raise_for_status()
            data = response.json()

            if "data" in data and data["data"]:
                return data["data"][0].get("url")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"Image generation failed: {e}")
            return None


def _extract_json_from_response(content: str) -> dict[str, Any]:
    """Extract JSON from LLM response, handling markdown code blocks.

    Args:
        content: Raw LLM response that may contain JSON in code blocks.

    Returns:
        Parsed JSON dictionary.

    Raises:
        ValueError: If no valid JSON can be extracted.
    """
    # Try to extract JSON from markdown code block
    json_pattern = r"```(?:json)?\s*([\s\S]*?)```"
    matches = re.findall(json_pattern, content)

    if matches:
        # Try each match until we find valid JSON
        for match in matches:
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue

    # Try parsing the entire content as JSON
    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        pass

    # Try finding JSON object in the text
    json_object_pattern = r"\{[\s\S]*\}"
    object_match = re.search(json_object_pattern, content)
    if object_match:
        try:
            return json.loads(object_match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from response: {content[:500]}...")


def _build_outline_system_prompt(
    template_structure: list[dict[str, Any]] | None,
    slide_count: int,
    tone: str,
    brand_context: dict[str, Any] | None,
) -> str:
    """Build the system prompt for deck outline generation.

    Args:
        template_structure: Optional template slide structure to follow.
        slide_count: Target number of slides.
        tone: Desired tone of the presentation.
        brand_context: Optional brand guidelines and colors.

    Returns:
        System prompt string.
    """
    prompt_parts = [
        "You are a professional presentation designer and content strategist.",
        "Your task is to create a detailed deck outline based on the user's request.",
        "",
        f"Target slide count: {slide_count}",
        f"Tone: {tone}",
        "",
        "IMPORTANT: Respond with ONLY valid JSON, no additional text.",
        "",
        "Required JSON structure:",
        """{
    "title": "Deck Title",
    "summary": "Brief summary of the deck's purpose",
    "slides": [
        {
            "slide_number": 1,
            "slide_type": "title",
            "title": "Slide Title",
            "body": "Optional body text",
            "bullets": ["bullet 1", "bullet 2"],
            "image_prompt": "Optional image description",
            "speaker_notes": "Optional presenter notes"
        }
    ]
}""",
        "",
        "Slide types to use:",
        "- title: Opening slide with main title and subtitle",
        "- content: Text-heavy informational slide",
        "- bullets: Slide with bullet points",
        "- image: Slide with prominent image and minimal text",
        "- two-column: Split layout for comparisons",
        "- quote: Quote or testimonial slide",
        "- data: Slide for charts/statistics",
        "- closing: Final slide with call-to-action or summary",
    ]

    if template_structure:
        prompt_parts.extend([
            "",
            "Follow this template structure as a guide:",
            json.dumps(template_structure, indent=2),
        ])

    if brand_context:
        prompt_parts.extend([
            "",
            "Brand context to incorporate:",
            f"- Brand name: {brand_context.get('name', 'Unknown')}",
        ])
        if brand_context.get("guidelines_text"):
            prompt_parts.append(
                f"- Guidelines: {brand_context['guidelines_text'][:500]}..."
            )

    return "\n".join(prompt_parts)


async def create_deck_outline(
    client: OpenRouterClient,
    prompt: str,
    template_structure: list[dict[str, Any]] | None = None,
    slide_count: int = 10,
    tone: str = "professional",
    brand_context: dict[str, Any] | None = None,
) -> DeckOutline:
    """Generate a deck outline from a user prompt.

    Args:
        client: OpenRouter client instance.
        prompt: User's description of the desired deck.
        template_structure: Optional template to follow.
        slide_count: Target number of slides.
        tone: Desired presentation tone.
        brand_context: Optional brand guidelines.

    Returns:
        DeckOutline with title, slides, and summary.

    Raises:
        ValueError: If outline generation fails.
    """
    system_prompt = _build_outline_system_prompt(
        template_structure, slide_count, tone, brand_context
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Create a presentation about: {prompt}"},
    ]

    response = await client.chat_completion(
        messages=messages,
        temperature=0.7,
        max_tokens=8192,
    )

    outline_data = _extract_json_from_response(response)

    # Validate and create SlideContent objects
    slides = []
    for slide_data in outline_data.get("slides", []):
        slides.append(SlideContent(**slide_data))

    return DeckOutline(
        title=outline_data.get("title", "Untitled Deck"),
        slides=slides,
        summary=outline_data.get("summary", ""),
    )


async def generate_slide_content(
    client: OpenRouterClient,
    slide: SlideContent,
    deck_context: str,
    brand_context: dict[str, Any] | None = None,
) -> SlideContent:
    """Enhance a single slide with more detailed content.

    Args:
        client: OpenRouter client instance.
        slide: The slide to enhance.
        deck_context: Overall deck title and summary for context.
        brand_context: Optional brand guidelines.

    Returns:
        Enhanced SlideContent with richer details.
    """
    system_prompt = """You are a presentation content expert. Enhance the given slide with more detailed, engaging content.

IMPORTANT: Respond with ONLY valid JSON matching the exact structure provided.

Keep the same slide_number and slide_type. Improve:
- Title: Make it more compelling
- Body/bullets: Add more detail and value
- Speaker notes: Add helpful presenter guidance
- Image prompt: If applicable, create a detailed image generation prompt

JSON structure:
{
    "slide_number": 1,
    "slide_type": "content",
    "title": "Enhanced Title",
    "body": "Enhanced body text",
    "bullets": ["detailed bullet 1", "detailed bullet 2"],
    "image_prompt": "Detailed image description for AI generation",
    "speaker_notes": "Presenter guidance"
}"""

    user_prompt = f"""Deck context: {deck_context}

Enhance this slide:
{slide.model_dump_json(indent=2)}"""

    if brand_context:
        user_prompt += f"\n\nBrand voice/tone: {brand_context.get('guidelines_text', '')[:300]}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = await client.chat_completion(
            messages=messages,
            temperature=0.6,
            max_tokens=2048,
        )

        enhanced_data = _extract_json_from_response(response)
        return SlideContent(**enhanced_data)
    except Exception as e:
        logger.warning(f"Failed to enhance slide {slide.slide_number}: {e}")
        return slide


async def generate_slides_parallel(
    client: OpenRouterClient,
    outline: DeckOutline,
    brand_context: dict[str, Any] | None = None,
    max_concurrent: int = 3,
) -> list[SlideContent]:
    """Process slides in parallel batches for faster generation.

    Args:
        client: OpenRouter client instance.
        outline: The deck outline with slides to enhance.
        brand_context: Optional brand guidelines.
        max_concurrent: Maximum concurrent requests (default 3 to avoid rate limits).

    Returns:
        List of enhanced SlideContent objects.
    """
    deck_context = f"Title: {outline.title}\nSummary: {outline.summary}"
    enhanced_slides: list[SlideContent] = []

    # Process in batches to respect rate limits
    for i in range(0, len(outline.slides), max_concurrent):
        batch = outline.slides[i : i + max_concurrent]

        tasks = [
            generate_slide_content(client, slide, deck_context, brand_context)
            for slide in batch
        ]

        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        for j, result in enumerate(batch_results):
            if isinstance(result, Exception):
                logger.error(f"Slide enhancement failed: {result}")
                # Use original slide on failure
                enhanced_slides.append(batch[j])
            else:
                enhanced_slides.append(result)

    # Sort by slide number to maintain order
    enhanced_slides.sort(key=lambda s: s.slide_number)
    return enhanced_slides


def get_openrouter_client() -> OpenRouterClient:
    """Get or create the singleton OpenRouter client.

    Returns:
        OpenRouterClient instance.
    """
    global _openrouter_client
    if _openrouter_client is None:
        _openrouter_client = OpenRouterClient()
    return _openrouter_client
