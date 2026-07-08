# GROQ_HOMEWORK — Engine Lane (Codex)

**Status:** Ready to implement  
**Lane:** Engine (`homework/**`)  
**Context:** `mindcraft-homework` Cloud Run service is DOWN — Anthropic credits exhausted.
Groq has a free tier with llama-3.3-70b-versatile. Wire Groq in as the primary LLM.

---

## What and why

`homework/` is a FastAPI service that receives a math problem and returns a step-by-step
solution with explanations. It currently uses Anthropic (`anthropic` Python SDK). Since
credits are exhausted, the service returns 400 and the frontend falls back to
`/recommend-ingredients` (ingredient-level cards with no step-by-step).

Groq is already used in `ml/scripts/` (via `ml/generation/llm_client.py`). The same pattern
applies here: add a Groq HTTP client to `homework/`, try Groq first, fall back to Anthropic.

---

## Files to read first

- `homework/main.py` — the FastAPI app entry point
- `homework/solver.py` (or similar) — where the Anthropic call lives
- `ml/generation/llm_client.py` — the working Groq HTTP client pattern to copy

If the homework service has a different structure, `grep -rn "anthropic\|Anthropic\|messages.create" homework/` to find the call site.

---

## Changes

### 1. Add Groq HTTP client to homework

In whatever module makes the Anthropic call, add a Groq function using stdlib `urllib.request`
(same approach as `ml/generation/llm_client.py` — no extra package needed):

```python
import json, os, urllib.request, urllib.error

def _call_groq(system: str, user: str, max_tokens: int = 1024) -> str:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise RuntimeError("GROQ_API_KEY not set")
    body = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_completion_tokens": max_tokens,
        "temperature": 0.4,
        "stream": False,
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "User-Agent": "mindcraft-homework/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]
```

### 2. Replace / wrap the Anthropic call

Find where `anthropic` is called (probably something like `client.messages.create(...)`).
Replace the call body with:

```python
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")

def solve_problem(problem: str, system_prompt: str) -> str:
    if LLM_PROVIDER == "groq":
        return _call_groq(system_prompt, problem)
    # Anthropic fallback
    from anthropic import Anthropic
    client = Anthropic()
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": problem}],
    )
    return msg.content[0].text
```

### 3. `homework/requirements.txt` (or pyproject.toml)

Groq client uses only stdlib — no new package needed.
The `anthropic` SDK can stay (it's the fallback). Do NOT remove it.

### 4. `homework/Dockerfile` (if exists)

Add `ENV LLM_PROVIDER=groq` as the default. The Cloud Run secret `GROQ_API_KEY` must be set
(Blake's ops task — note in a comment that the secret is needed).

### 5. Local test

```bash
cd homework
LLM_PROVIDER=groq GROQ_API_KEY=<key> uvicorn main:app --port 8090
curl -X POST http://localhost:8090/solve \
  -H 'Content-Type: application/json' \
  -d '{"problem": "Solve 2x + 3 = 11 step by step"}'
```

Should return a structured step-by-step solution.

---

## What done looks like

- `homework/` service calls Groq by default (LLM_PROVIDER=groq)
- Anthropic remains as a named fallback (not deleted)
- `LLM_PROVIDER=groq GROQ_API_KEY=<key> uvicorn main:app` starts without errors
- The `/solve` endpoint returns a step-by-step solution for a test problem
- Commit message: "Wire Groq into homework solver — primary LLM, Anthropic as fallback"

## Do not do

- Do not add the `groq` PyPI package — use the stdlib HTTP approach from llm_client.py
- Do not remove the anthropic import/fallback
- Do not touch `ml/**`, `app/**`, `webhook/**`
- Do not deploy to Cloud Run (billing closed) — this is for local dev + future when billing reopens
