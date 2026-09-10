/**
 * api/tts.ts — own top-level function (not routed through app-actions.ts).
 * Kokoro TTS pulls in a ~96MB model + onnxruntime-node; keeping it isolated
 * means it never bloats the CRUD-style actions that share app-actions.ts,
 * and it can get its own generous maxDuration for a cold-start model
 * download (see vercel.json). Same pattern already established for
 * story-module.ts / jarvis.ts / generate-questions.ts.
 *
 * Real logic lives in lib/handlers/tts.ts (its own doc comment has the
 * voice choices and the "why Kokoro" reasoning).
 */
export { default } from '../lib/handlers/tts'
