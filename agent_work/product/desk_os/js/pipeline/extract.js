/**
 * Pipeline stage 1 · Extract
 * Pull text / signals from tagged ingest sources (files, notes, seeds).
 */

/**
 * @typedef {{ id: string, name: string, kind: string, prompt?: string, text?: string }} SourceIn
 * @typedef {SourceIn & { text: string, chars: number }} ExtractedSource
 */

/**
 * @param {SourceIn} source
 * @param {(fileLike: { name: string, type?: string, text?: () => Promise<string> }) => Promise<string>} [extractTextFn]
 */
export async function extractOne(source, extractTextFn) {
  if (source.text && String(source.text).trim()) {
    const text = String(source.text).slice(0, 8000);
    return { ...source, text, chars: text.length };
  }
  if (source.kind === 'note' || source.kind === 'seed') {
    const text = String(source.prompt || source.name || '').slice(0, 8000);
    return { ...source, text, chars: text.length };
  }
  if (typeof extractTextFn === 'function' && source.file) {
    try {
      const text = String(await extractTextFn(source.file) || '').slice(0, 8000);
      return { ...source, text, chars: text.length };
    } catch {
      /* fall through */
    }
  }
  const fallback = [
    source.prompt || '',
    `Source: ${source.name || 'untitled'}`,
  ].filter(Boolean).join('\n').slice(0, 8000);
  return { ...source, text: fallback, chars: fallback.length };
}

/**
 * @param {SourceIn[]} sources
 * @param {(fileLike: object) => Promise<string>} [extractTextFn]
 * @returns {Promise<ExtractedSource[]>}
 */
export async function extractSources(sources, extractTextFn) {
  const out = [];
  for (const s of sources || []) {
    // sequential · keeps optional file readers predictable in the browser
    // eslint-disable-next-line no-await-in-loop
    out.push(await extractOne(s, extractTextFn));
  }
  return out;
}
