"""Provider-agnostic LLM client for question generation.

One `complete(prompt, system)` call, three backends selected by env:
  LLM_PROVIDER = ollama (default) | groq | anthropic
  LLM_MODEL    = override the per-provider default
  LLM_TEMPERATURE, LLM_TOP_P, LLM_MAX_TOKENS tune hosted chat providers

All providers are asked for JSON output. Keeping this thin + stdlib-only (except
the optional anthropic SDK) so the pipeline runs on a laptop with Ollama and no
extra installs.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except ImportError:
    pass

DEFAULT_MODELS = {
    "ollama": "llama3.1:8b",
    "groq": "llama-3.3-70b-versatile",
    "anthropic": "claude-haiku-4-5-20251001",
}


def _post(url: str, body: dict, headers: dict, timeout: int = 180) -> dict:
    # A real User-Agent is required: Groq sits behind Cloudflare, which blocks
    # the default Python-urllib UA with "error code: 1010".
    retries = _int_env("LLM_RETRIES", 6)
    base = _float_env("LLM_RETRY_BASE_SECONDS", 2.0)
    for attempt in range(retries + 1):
        req = urllib.request.Request(
            url, data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "mindcraft-gen/1.0", **headers},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                sleep = _float_env("LLM_CALL_SLEEP_SECONDS", 0.0)
                if sleep > 0:
                    time.sleep(sleep)
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable or attempt >= retries:
                raise
            retry_after = exc.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else base * (2 ** attempt)
            time.sleep(delay)
    raise RuntimeError("unreachable retry loop")


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    return float(raw)


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return int(raw)


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


def _groq(prompt: str, system: str, model: str, max_tokens: int | None, temperature: float | None) -> str:
    key = os.environ["GROQ_API_KEY"]
    # NB: not using response_format=json_object — Groq hard-400s ("json_validate_
    # failed") on any minor JSON glitch from the model. We parse tolerantly +
    # retry in the generate layer instead, so one bad attempt doesn't kill a batch.
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system or ""},
                     {"role": "user", "content": prompt}],
        "temperature": temperature if temperature is not None else _float_env("LLM_TEMPERATURE", 1.0),
        "max_completion_tokens": max_tokens if max_tokens is not None else _int_env("LLM_MAX_TOKENS", 1024),
        "top_p": _float_env("LLM_TOP_P", 1.0),
        "stream": False,
        "stop": None,
    }
    out = _post("https://api.groq.com/openai/v1/chat/completions", body,
                {"Authorization": f"Bearer {key}"})
    return out["choices"][0]["message"]["content"]


def _anthropic(prompt: str, system: str, model: str, max_tokens: int | None, temperature: float | None) -> str:
    from anthropic import Anthropic  # optional dep
    msg = Anthropic().messages.create(
        model=model, max_tokens=max_tokens or 2048, temperature=temperature, system=system or "",
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


_PROVIDERS = {"ollama": _ollama, "groq": _groq, "anthropic": _anthropic}


def provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama")


def complete(
    prompt: str,
    system: str | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> str:
    p = provider()
    fn = _PROVIDERS.get(p)
    if fn is None:
        raise ValueError(f"unknown LLM_PROVIDER={p!r} (use ollama|groq|anthropic)")
    model = os.getenv("LLM_MODEL", DEFAULT_MODELS[p])
    if p == "ollama":
        return fn(prompt, system or "", model)
    return fn(prompt, system or "", model, max_tokens, temperature)
