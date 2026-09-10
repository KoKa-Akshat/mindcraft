/**
 * lib/llmChat.ts
 *
 * Shared LLM-chat plumbing for Jesse's stateless conversational handlers
 * (english-practice, resume-agent, archive-rag, book-agent, gmail-digest).
 * Every one of those handlers independently defined its own
 * callAnthropic/callGroq/parseModelJson/sanitizeReply — same try/catch-null
 * shape, same `{...}`-slice JSON extraction, same em-dash/exclamation-mark
 * stripping. This file is that shared shape, parameterized for the real
 * differences between callers (system prompt, model, max_tokens,
 * temperature) rather than flattening them away.
 *
 * Each handler still owns its own fallback composition
 * (`(await callAnthropic(...)) || (await callGroq(...))`) and its own
 * heuristic/offline fallback reply — only the two provider calls, the JSON
 * extraction, and the text sanitizer live here.
 */
import Anthropic from '@anthropic-ai/sdk'
import { studentGeminiComplete, studentGeminiVisionComplete } from './studentGemini'

export interface AnthropicChatOptions {
  model: string
  maxTokens: number
  system: string
}

/**
 * Calls Anthropic with a single user turn and a system prompt. Returns the
 * joined text of the response, or null if ANTHROPIC_API_KEY is unset or the
 * call fails for any reason (caller is expected to fall back to Groq or a
 * heuristic reply — never throws).
 */
export async function callAnthropic(user: string, options: AnthropicChatOptions): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: user }],
    })
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.Messages.TextBlock).text)
      .join('')
      .trim()
  } catch {
    return null
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL_DEFAULT = 'gemini-flash-lite-latest' // '-1.5-flash' is retired (404), '-latest' is a rolling alias, see researchAgent.ts's own note on this exact staleness trap

export interface GeminiChatOptions {
  model?: string
  maxTokens: number
  temperature?: number
  system: string
}

/**
 * Calls Gemini with the platform's own GEMINI_API_KEY (2026-09-02 addition):
 * a second platform-level fallback alongside callAnthropic, added after the
 * platform ANTHROPIC_API_KEY was found out of credits in production
 * (discover-internships.ts's real failure, confirmed via Vercel logs, not
 * assumed: "Your credit balance is too low to access the Anthropic API").
 * Same never-throws, null-on-any-failure contract as callAnthropic/callGroq.
 * Raw fetch to the Generative Language API rather than the @google/genai
 * SDK studentGemini.ts uses — matches the existing raw-fetch platform-key
 * pattern already proven in researchAgent.ts's summarizeSignals, not a
 * third different way to call Gemini in this repo.
 */
export async function callGemini(user: string, options: GeminiChatOptions): Promise<string | null> {
  if (!GEMINI_API_KEY) return null
  try {
    const model = options.model || GEMINI_MODEL_DEFAULT
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            maxOutputTokens: options.maxTokens,
            temperature: options.temperature ?? 0.3,
          },
          contents: [{ role: 'user', parts: [{ text: `${options.system}\n\n${user}` }] }],
        }),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? ''
    return text.trim() || null
  } catch {
    return null
  }
}

export interface GroqChatOptions {
  model: string
  maxTokens: number
  temperature: number
  system: string
}

/**
 * Calls Groq's OpenAI-compatible chat-completions endpoint with a single
 * user turn and a system prompt, requesting JSON-object output. Returns the
 * raw message content, or null if GROQ_API_KEY is unset, the HTTP call
 * fails, or the response isn't OK (caller falls back to a heuristic reply).
 */
export async function callGroq(user: string, options: GroqChatOptions): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

export interface ByokChatOptions {
  provider: 'openai' | 'groq' | 'gemini' | 'openrouter' | 'anthropic' | 'custom'
  apiKey: string
  model?: string
  baseUrl?: string
  maxTokens: number
  temperature?: number
  system: string
}

/**
 * Calls a STUDENT-supplied API key instead of a platform key, for a caller
 * that wants to try the student's own key as a fallback once its platform
 * calls (callAnthropic, callGroq) have already failed, 2026-09-01 addition
 * after resume-agent's platform Anthropic and Groq calls were both found
 * failing in production. Not a replacement for those, purely additive:
 * neither existing function is touched.
 *
 * openai, groq, openrouter, and custom all speak the same OpenAI-compatible
 * chat-completions wire format (see callGroq's own comment, its endpoint
 * already is one), so they share one fetch path here, only the base URL
 * and default model differ. anthropic gets its own SDK call with the
 * student's key in place of the platform's. gemini delegates to
 * studentGeminiComplete, the same helper generate-resume-pdf.ts's
 * studentGeminiKey path already uses, Gemini's wire format is not
 * OpenAI-compatible so it cannot share the fetch path above. Never throws,
 * returns null on any failure, same contract as callAnthropic/callGroq.
 */
export async function callByok(user: string, options: ByokChatOptions): Promise<string | null> {
  if (!options.apiKey) return null
  try {
    if (options.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: options.apiKey })
      const response = await client.messages.create({
        model: options.model || 'claude-haiku-4-5-20251001',
        max_tokens: options.maxTokens,
        system: options.system,
        messages: [{ role: 'user', content: user }],
      })
      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.Messages.TextBlock).text)
        .join('')
        .trim()
    }

    if (options.provider === 'gemini') {
      const text = await studentGeminiComplete(options.apiKey, `${options.system}\n\n${user}`, options.maxTokens)
      return text || null
    }

    const presets: Record<string, { baseUrl: string; model: string }> = {
      openai: { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
      // NOT llama-3.3-70b-versatile: Groq shut that model down 2026-08-16
      // (see english-practice.ts's own discovery of this), this is the
      // live, confirmed replacement.
      groq: { baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-oss-20b:free' },
    }
    const preset = presets[options.provider]
    const baseUrl = options.provider === 'custom' ? options.baseUrl : preset?.baseUrl
    const model = options.model || preset?.model
    if (!baseUrl || !model) return null

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

export interface ByokVisionOptions {
  provider: 'openai' | 'groq' | 'gemini' | 'openrouter' | 'anthropic' | 'custom'
  apiKey: string
  model?: string
  baseUrl?: string
  maxTokens: number
  system: string
  imageBase64: string
  /** e.g. 'image/png' */
  mimeType: string
}

/**
 * Same shape as callByok, plus one inline image. A student's own key is the
 * ONLY path for vision calls (parse-homework's 2026-09-01 rework): no
 * platform-key fallback here, so a provider/model must actually support
 * image input or this returns null and the caller reports it honestly.
 *
 * Per-provider default models are deliberately NOT the same as callByok's
 * text presets — groq's 'openai/gpt-oss-120b' and openrouter's
 * 'openai/gpt-oss-20b:free' are text-only reasoning models, no vision.
 * groq gets a real, currently-free vision model instead (Llama 4 Scout,
 * verified live 2026-09-01: console.groq.com/docs/model/meta-llama/
 * llama-4-scout-17b-16e-instruct). openrouter gets 'openrouter/free', a
 * router that auto-picks a free model and filters for the capability the
 * request actually needs (here, vision) rather than one hardcoded free
 * model name — the exact kind of hardcoded-name staleness that broke
 * parse-homework in the first place (see MODEL's own comment in
 * lib/handlers/parse-homework.ts), so this should not go stale the same way.
 */
export async function callByokVision(user: string, options: ByokVisionOptions): Promise<string | null> {
  if (!options.apiKey || !options.imageBase64) return null
  try {
    if (options.provider === 'gemini') {
      const text = await studentGeminiVisionComplete(
        options.apiKey,
        `${options.system}\n\n${user}`,
        options.imageBase64,
        options.mimeType,
        options.maxTokens,
      )
      return text || null
    }

    if (options.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: options.apiKey })
      const mediaType = options.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
      const response = await client.messages.create({
        model: options.model || 'claude-haiku-4-5-20251001',
        max_tokens: options.maxTokens,
        system: options.system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: options.imageBase64 } },
            { type: 'text', text: user },
          ],
        }],
      })
      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.Messages.TextBlock).text)
        .join('')
        .trim()
    }

    const presets: Record<string, { baseUrl: string; model: string }> = {
      openai: { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
      groq: { baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'openrouter/free' },
    }
    const preset = presets[options.provider]
    const baseUrl = options.provider === 'custom' ? options.baseUrl : preset?.baseUrl
    const model = options.model || preset?.model
    if (!baseUrl || !model) return null

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.system },
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              { type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.imageBase64}` } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

/**
 * Extracts and parses the first `{...}` slice found in a raw model
 * response. Returns null (never throws) if no braces are found or the
 * slice isn't valid JSON — callers treat null the same as "no model
 * response" and fall through to their own heuristic.
 */
export function parseModelJson<T = unknown>(raw: string): T | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/**
 * Jesse's voice-safe text cleanup: no em dashes, no exclamation marks,
 * collapsed whitespace, trimmed, capped to `maxLength` (default 420 — the
 * length every caller but gmail-digest used; gmail-digest calls this with
 * its own per-field lengths).
 */
export function sanitizeText(text: string, maxLength = 420): string {
  return text
    .replace(/—/g, '-')
    .replace(/[!]{1,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
