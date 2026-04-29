# homework/utils/claude_client.py
# Single entry point for all Anthropic API calls in the homework service.
# Every other module imports call_claude() from here — no file creates its
# own anthropic.Anthropic() instance.

from __future__ import annotations
import os, logging
import anthropic

logger = logging.getLogger(__name__)

MODEL      = "claude-sonnet-4-20250514"
MAX_TOKENS = 2048

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    """Return the shared async Anthropic client, creating it on first call."""
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


async def call_claude(
    system_prompt: str,
    user_message:  str,
    temperature:   float = 0.3,
    max_tokens:    int   = MAX_TOKENS,
) -> str:
    """
    Make a single-turn Claude API call and return the text response.

    Args:
        system_prompt: The system prompt defining Claude's role and output rules.
        user_message:  The user turn content.
        temperature:   Sampling temperature. Lower = more deterministic.
        max_tokens:    Maximum tokens in the response.

    Returns:
        The text content of Claude's first content block.

    Raises:
        anthropic.APIError: If the API call fails.
        ValueError: If the response contains no text block.
    """
    logger.debug(
        "Claude call | model=%s temp=%.1f system_len=%d",
        MODEL, temperature, len(system_prompt),
    )
    client  = _get_client()
    message = await client.messages.create(
        model       = MODEL,
        max_tokens  = max_tokens,
        temperature = temperature,
        system      = system_prompt,
        messages    = [{"role": "user", "content": user_message}],
    )
    if not message.content or message.content[0].type != "text":
        raise ValueError("Claude returned no text content")
    return message.content[0].text
