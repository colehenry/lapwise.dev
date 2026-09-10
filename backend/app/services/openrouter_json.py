"""Small synchronous OpenRouter boundary for backend JSON generation."""

import json
import logging
import re

import httpx

from app.config import settings

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

logger = logging.getLogger(__name__)


def _parse_json_content(text: str) -> dict:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if not match:
            raise
        parsed = json.loads(match.group(1))
    if not isinstance(parsed, dict):
        raise ValueError("OpenRouter response must contain a JSON object")
    return parsed


def generate_openrouter_json(
    prompt: str,
    *,
    model: str,
    max_tokens: int = 1500,
) -> dict | None:
    """Generate one JSON object using the configured OpenRouter account."""
    if not settings.open_router_api_key:
        logger.warning("OPEN_ROUTER_API_KEY not set, skipping model generation")
        return None

    try:
        response = httpx.post(
            OPENROUTER_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.open_router_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.frontend_url,
                "X-Title": "Lapwise session summaries",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
                "provider": {
                    "data_collection": "deny",
                    "require_parameters": True,
                },
            },
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["choices"][0]["message"]["content"]
        if not isinstance(text, str):
            raise ValueError("OpenRouter returned non-text JSON content")
        parsed = _parse_json_content(text)
        usage = payload.get("usage") or {}
        parsed["tokens_used"] = int(
            usage.get("total_tokens")
            or (usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0))
        )
        return parsed
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
        logger.error("OpenRouter API error: %s", error)
        return None
