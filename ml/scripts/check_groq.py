#!/usr/bin/env python3
"""Verify Groq API key from ml/.env.local (or env)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ENV_PATH = REPO / ".env.local"


def load_dotenv() -> None:
    if not ENV_PATH.exists():
        return
    try:
        from dotenv import dotenv_values  # type: ignore
        for k, v in dotenv_values(ENV_PATH).items():
            if v is not None and str(v).strip():
                os.environ[k] = str(v).strip()
        return
    except ImportError:
        pass
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip()
        if v:
            os.environ[k] = v


def main() -> int:
    load_dotenv()
    key = os.environ.get("GROQ_API_KEY", "").strip()
    provider = os.environ.get("LLM_PROVIDER", "groq").strip()

    if not key:
        print("MISSING: GROQ_API_KEY")
        print("  1. Copy ml/.env.local.example → ml/.env.local")
        print("  2. Paste your key from https://console.groq.com/keys")
        print("  3. Set LLM_PROVIDER=groq")
        return 1

    if provider != "groq":
        print(f"WARNING: LLM_PROVIDER={provider} (should be groq)")

    try:
        import groq  # type: ignore
    except ImportError:
        print("MISSING: pip install groq  (run ml/scripts/setup_platform.sh)")
        return 1

    client = groq.Groq(api_key=key)
    r = client.chat.completions.create(
        model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        messages=[{"role": "user", "content": "Reply with exactly: ok"}],
        max_tokens=8,
        temperature=0,
    )
    text = (r.choices[0].message.content or "").strip()
    print(f"Groq OK — model replied: {text!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
