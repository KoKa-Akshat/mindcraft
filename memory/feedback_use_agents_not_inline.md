---
name: feedback-use-agents-not-inline
description: All code changes go to Cursor/Codex implementation agents; this Opus session is architecture and coordination only — never write actual code inline
metadata:
  type: feedback
---

Never write implementation code directly in this session. The process is:
- **Opus (this session)** = head architect — writes build files, defines contracts, coordinates
- **Cursor / Codex / Copilot** = implementation agents — execute the build files

**Why:** Inline coding in the architect session causes lane collisions, loses track of what's been delegated vs done, and bypasses the spec-first review process.

**How to apply:** When asked to implement anything, write a `.md` build file in the repo root instead. Include lane assignment, shared contracts, file-by-file steps, and acceptance criteria. Never open a `.tsx`, `.ts`, or `.py` file and start writing feature code.
