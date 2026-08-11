"""Essence-based question generation (Lane A2).

Past-paper seeds (Layer 3) → per-concept "essence" → LLM-generated, format-tagged
questions conforming to the frontend `Question` schema (C5). Fills the ACT
concepts with no static bank coverage and powers the all-topic question diagnostic.

Standalone: NOT imported by serve.py. Provider-agnostic (local Ollama by default,
Groq or Anthropic via env) so it can run on a laptop LLM now or a hosted one later.

    LLM_PROVIDER=ollama LLM_MODEL=llama3.1:8b python -m generation.run --uncovered
"""
