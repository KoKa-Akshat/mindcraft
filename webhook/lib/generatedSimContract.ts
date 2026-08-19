/**
 * lib/generatedSimContract.ts
 *
 * The request/response contract between the generate-sim webhook handler
 * and the (not-yet-deployed) mindcraft-content-engine generation service —
 * pure functions and types only, no firebase import, so this module can be
 * compiled and exercised in a local harness without live credentials.
 *
 * The service side of this contract does not exist yet. Its shape is
 * grounded in the real, tested pipeline in the sibling
 * mindcraft-content-engine repo (src/mindcraft_content_engine/
 * batch_generate.py's BatchResult + simulation_generator.py's
 * GeneratedMicroSim + visual_quality_gate.py's QualityGateResult), not
 * invented here. When that pipeline gets deployed as its own service (same
 * shape as mindcraft-ml on Hugging Face Spaces — see
 * LIVE_GATED_GENERATION_TEST_SPEC.md), it must expose:
 *
 *   POST {CONTENT_ENGINE_URL}/generate      header X-Service-Key
 *     body     { "topic": string, "topic_slug": string }
 *     response { "job_id": string }
 *
 *   GET {CONTENT_ENGINE_URL}/jobs/{job_id}  header X-Service-Key
 *     response ServiceJobPayload (below)
 *
 * Generation is genuinely async (15-60+ seconds per attempt: generate ->
 * headless-Chromium render -> structural rubric -> vision gate, each its
 * own real round trip) — which is why this is a job the client polls, not
 * a single blocking HTTP call.
 */

/** What the generation service reports for one job. `result` is present
 * only when status is "passed", meaning BatchResult.final_pass — the
 * structural rubric AND the visual/pedagogical vision gate both cleared.
 * A partial pass (rubric ok, gate not run or failed) is never "passed";
 * the student must never see an unverified result. */
export interface ServiceJobPayload {
  status?: string // queued | running | passed | no_good_result | error
  phase?: string // fit_check | generating | rendering | scoring | vision_gate
  topic?: string
  result?: {
    title?: string
    description?: string
    learning_objectives?: string[]
    html?: string
    js?: string
    concept_id?: string
    concept_label?: string
    rubric_percentage?: number
    quality_gate_score?: number
  }
  /** no_good_result: the honest why — a fit-check decline
   * (BatchResult.skipped_reason, e.g. "too broad an umbrella"), a rubric
   * fail, or the vision gate's visual/pedagogical notes. Expected roughly
   * half to nine-tenths of attempts depending on domain (real measured
   * yield: 1/10 to 6/10) — a normal outcome, not an error. */
  reason?: string
  /** Optional adjacent angle worth one automatic retry — e.g. a fit-check
   * that declined "photosynthesis" as too broad can suggest
   * "photosynthesis light reactions". Client retries at most once. */
  suggested_retry_topic?: string
  detail?: string // error only
}

/** The client-facing verified result — one self-contained html string
 * (js already inlined), never separate files the client has to assemble. */
export interface GeneratedSimResult {
  title: string
  description: string
  html: string
  conceptId: string
  conceptLabel: string
  learningObjectives: string[]
  rubricPercentage: number | null
  qualityGateScore: number | null
  topic: string
  topicSlug: string
}

export type NormalizedJobStatus =
  | { status: 'running'; phase: string }
  | { status: 'passed'; result: GeneratedSimResult }
  | { status: 'no_good_result'; reason: string; suggestedRetryTopic: string | null }
  | { status: 'error'; detail: string }

/**
 * MUST match ml/mindcraft_graph/loaders/lesson_tagger.py's slugify and the
 * iOS LessonSlug.slugify exactly (ASCII-only [^a-z0-9]+ -> "_", strip,
 * "untitled" fallback) — the library cache is keyed on this, and a
 * divergent slug would silently miss cache hits for topics the iOS side
 * considers identical. Same ASCII-only caveat documented on the Swift
 * copy: a Unicode-aware lowercase-letters class would keep "é"/"ñ" and
 * diverge for any non-ASCII topic.
 */
export function slugifyTopic(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'untitled'
}

/**
 * Inlines the generated sketch's js into its html so the client gets ONE
 * self-contained document — the same problem MicroSimRecord.
 * selfContainedHTML already solves on-device for the bundled McCreary
 * sims, solved server-side here instead so the stored library copy is
 * directly renderable. Only relative script tags are replaced; absolute
 * URLs (the p5.js CDN tag the generation prompt requires) are left alone.
 */
export function inlineGeneratedJs(html: string, js: string): string {
  if (!js) return html
  const relativeScriptTag = /<script\s+src="(?!https?:\/\/)[^"]+"\s*>\s*<\/script>/
  if (relativeScriptTag.test(html)) {
    return html.replace(relativeScriptTag, `<script>\n${js}\n</script>`)
  }
  // A generated html that forgot the script tag still gets the js —
  // appended before </body> (or at the end) rather than silently dropped.
  if (html.includes('</body>')) {
    return html.replace('</body>', `<script>\n${js}\n</script></body>`)
  }
  return `${html}\n<script>\n${js}\n</script>`
}

function clip(value: unknown, max: number): string {
  // NUL bytes stripped defensively (Firestore rejects them in strings);
  // built via fromCharCode because a literal escape kept getting mangled
  // into a real NUL byte in this file's own source.
  return String(value ?? '').split(String.fromCharCode(0)).join('').slice(0, max)
}

/**
 * Maps a raw service job payload into the client-facing shape. Strict
 * about the pass path: a "passed" payload missing its html is downgraded
 * to an error rather than handed to the client as a verified result with
 * nothing to render — never show a partial result.
 */
export function normalizeJobPayload(raw: ServiceJobPayload, requestTopic: string): NormalizedJobStatus {
  const status = String(raw?.status ?? '')
  if (status === 'queued' || status === 'running') {
    return { status: 'running', phase: clip(raw.phase, 40) || 'running' }
  }
  if (status === 'no_good_result') {
    const suggested = clip(raw.suggested_retry_topic, 200)
    return {
      status: 'no_good_result',
      reason: clip(raw.reason, 600),
      suggestedRetryTopic: suggested || null,
    }
  }
  if (status === 'passed') {
    const result = raw.result
    const html = String(result?.html ?? '')
    if (!result || !html) {
      return { status: 'error', detail: 'service reported passed without renderable html' }
    }
    const topic = clip(raw.topic, 200) || clip(requestTopic, 200)
    return {
      status: 'passed',
      result: {
        title: clip(result.title, 200) || topic,
        description: clip(result.description, 1200),
        html: inlineGeneratedJs(html, String(result.js ?? '')),
        conceptId: clip(result.concept_id, 200) || slugifyTopic(topic),
        conceptLabel: clip(result.concept_label, 200) || topic,
        learningObjectives: Array.isArray(result.learning_objectives)
          ? result.learning_objectives.map((o) => clip(o, 300)).filter(Boolean).slice(0, 8)
          : [],
        rubricPercentage: typeof result.rubric_percentage === 'number' ? result.rubric_percentage : null,
        qualityGateScore: typeof result.quality_gate_score === 'number' ? result.quality_gate_score : null,
        topic,
        topicSlug: slugifyTopic(topic),
      },
    }
  }
  return { status: 'error', detail: clip(raw?.detail, 400) || `unrecognized service status: ${clip(status, 60)}` }
}
