/**
 * lib/studentGemini.ts
 *
 * BYOK helper (2026-08-25): calls Gemini using a STUDENT-supplied key, not
 * MindCraft's own platform GEMINI_API_KEY - for handlers that want to
 * spend a student's own free quota instead of the shared, budget-capped
 * platform account (generationBudget.ts). Every existing platform-key
 * Gemini call in this repo (agent-check-in.ts, transcribe-scratch.ts,
 * parse-homework.ts, etc.) is untouched - this is a separate, additive
 * path, not a replacement for those.
 *
 * A fresh `GoogleGenAI({ apiKey })` per call rather than a module-level
 * client - unlike the platform key (one process-lifetime credential), a
 * student's key is only known per-request, so there's nothing durable to
 * hold onto between calls, and constructing the client is cheap (no
 * network round trip until `generateContent` itself).
 *
 * Model: `gemini-flash-lite-latest`, matching the sibling
 * mindcraft-content-engine repo's own 2026-08-23 finding
 * (`book_ingestion.py`'s `_gemini_complete`) that `gemini-2.5-flash` is
 * gone for new users - NOT the `gemini-2.5-flash` some other handlers in
 * THIS repo (agent-check-in.ts and others) still use, which may itself be
 * stale; found while wiring this, not fixed here - a separate follow-up,
 * out of scope for a BYOK change.
 */
import { GoogleGenAI } from '@google/genai'

export async function studentGeminiComplete(apiKey: string, prompt: string, maxOutputTokens: number): Promise<string> {
  const genai = new GoogleGenAI({ apiKey })
  const msg = await genai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens },
  })
  return msg.text ?? ''
}
