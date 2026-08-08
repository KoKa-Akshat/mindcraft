/**
 * Modular cook pipeline · extract → tag → generate
 * Studio + seed loaders call this; do not rewrite as a monolith.
 */

import { extractSources } from './extract.js';
import { tagSources, subjectMeta } from './tag.js';
import { generateBook } from './generate.js';

export { extractSources, tagSources, generateBook, subjectMeta };

/**
 * @param {{
 *   sources: object[],
 *   subject: { id: string, label?: string },
 *   title?: string,
 *   extractTextFn?: (fileLike: object) => Promise<string>,
 *   onStage?: (label: string) => void,
 * }} opts
 */
export async function runBookPipeline(opts) {
  const subject = opts.subject || { id: 'custom', label: 'Custom' };
  const onStage = opts.onStage || (() => {});

  onStage('Extracting tagged sources…');
  const extracted = await extractSources(opts.sources || [], opts.extractTextFn);

  onStage('Tagging concepts + interaction intent…');
  await wait(180);
  const tagged = tagSources(extracted, subject);

  onStage('Generating chapters + interactive pages…');
  await wait(180);
  const book = generateBook({
    tagged,
    subject,
    title: opts.title || `${subject.label || 'Field'} Book`,
  });

  onStage('Binding Field Book instance…');
  await wait(120);

  const meta = subjectMeta(subject.id);
  const inst = {
    id: book.id,
    kind: meta.instanceKind,
    bookId: book.id,
    name: slugify(book.title),
    label: book.title,
    badge: meta.badge,
    createdAt: book.cookedAt,
    status: 'ready',
    execUsed: 0,
    execCap: 1000,
  };

  return { book, inst, stages: ['extract', 'tag', 'generate', 'bind'] };
}

function slugify(s) {
  return String(s || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'book';
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
