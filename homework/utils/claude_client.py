# homework/utils/claude_client.py
# Single entry point for all Anthropic API calls in the homework service.
# Uses the synchronous Anthropic client wrapped in asyncio.to_thread so the
# FastAPI event loop stays non-blocking. This avoids httpx.AsyncClient
# lifecycle issues that manifest as "Connection error" on Cloud Run cold starts.

from __future__ import annotations
import asyncio, os, logging
import anthropic

logger = logging.getLogger(__name__)

MODEL      = "claude-haiku-4-5-20251001"
MAX_TOKENS = 2048


def _make_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


async def call_claude(
    system_prompt: str,
    user_message:  str,
    temperature:   float = 0.3,
    max_tokens:    int   = MAX_TOKENS,
) -> str:
    """Single-turn text call to Claude. Runs the sync client in a thread pool."""
    def _sync() -> str:
        client  = _make_client()
        message = client.messages.create(
            model       = MODEL,
            max_tokens  = max_tokens,
            temperature = temperature,
            system      = system_prompt,
            messages    = [{"role": "user", "content": user_message}],
        )
        if not message.content or message.content[0].type != "text":
            raise ValueError("Claude returned no text content")
        return message.content[0].text

    logger.debug("Claude call | model=%s temp=%.1f", MODEL, temperature)
    return await asyncio.to_thread(_sync)


async def call_claude_with_content(
    system_prompt:  str,
    content_blocks: list,
    max_tokens:     int = 512,
) -> str:
    """Multimodal call to Claude (images, PDFs). content_blocks is a list of
    Anthropic content dicts passed directly as the user message content."""
    def _sync() -> str:
        client  = _make_client()
        message = client.messages.create(
            model      = MODEL,
            max_tokens = max_tokens,
            system     = system_prompt,
            messages   = [{"role": "user", "content": content_blocks}],
        )
        if not message.content or message.content[0].type != "text":
            raise ValueError("Claude returned no text content")
        return message.content[0].text

    return await asyncio.to_thread(_sync)
