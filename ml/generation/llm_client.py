"""Provider-agnostic LLM client for question generation.

One `complete(prompt, system)` call, three backends selected by env:
  LLM_PROVIDER = ollama (default) | groq | anthropic
  LLM_MODEL    = override the per-provider default

All providers are asked for JSON output. Keeping this thin + stdlib-only (except
the optional anthropic SDK) so the pipeline runs on a laptop with Ollama and no
extra installs.
"""
from __future__ import annotations

import json
import os
import urllib.request

DEFAULT_MODELS = {
    "ollama": "llama3.1:8b",
    "groq": "llama-3.3-70b-versatile",
    "anthropic": "claude-haiku-4-5-20251001",
}


def _post(url: str, body: dict, headers: dict, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _ollama(prompt: str, system: str, model: str) -> str:
    host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    body = {
        "model": model,
        "prompt": prompt,
        "system": system or "",
        "stream": False,
        "format": "json",           # force valid JSON output
        "options": {"temperature": 0.4},
    }
    return _post(f"{host}/api/generate", body, {})["response"]


def _groq(prompt: str, system: str, model: str) -> str:
    key = os.environ["GROQ_API_KEY"]
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system or ""},
                     {"role": "user", "content": prompt}],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    out = _post("https://api.groq.com/openai/v1/chat/completions", body,
                {"Authorization": f"Bearer {key}"})
    return out["choices"][0]["message"]["content"]


def _anthropic(prompt: str, system: str, model: str) -> str:
    from anthropic import Anthropic  # optional dep
    msg = Anthropic().messages.create(
        model=model, max_tokens=2048, system=system or "",
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


_PROVIDERS = {"ollama": _ollama, "groq": _groq, "anthropic": _anthropic}


def provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama")


def complete(prompt: str, system: str | None = None) -> str:
    p = provider()
    fn = _PROVIDERS.get(p)
    if fn is None:
        raise ValueError(f"unknown LLM_PROVIDER={p!r} (use ollama|groq|anthropic)")
    model = os.getenv("LLM_MODEL", DEFAULT_MODELS[p])
    return fn(prompt, system or "", model)
