import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSources } from '../js/pipeline/extract.js';
import { tagSources, subjectMeta, guessConcept } from '../js/pipeline/tag.js';
import { generateBook } from '../js/pipeline/generate.js';
import { runBookPipeline } from '../js/pipeline/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const pianoSeed = JSON.parse(readFileSync(join(here, '../data/pianoSeed.json'), 'utf8'));
const actSeed = JSON.parse(readFileSync(join(here, '../data/actSeed.json'), 'utf8'));

assert.equal(subjectMeta('piano').instanceKind, 'piano');
assert.equal(subjectMeta('act_math').instanceKind, 'act');
assert.equal(guessConcept('C major five-finger scale', subjectMeta('piano').concepts), 'five_finger');

const extracted = await extractSources([
  { id: '1', name: 'warmup.txt', kind: 'note', prompt: 'linear equations warm-up' },
]);
assert.ok(extracted[0].chars > 0);

const tagged = tagSources(extracted, { id: 'act_math', label: 'ACT Math' });
assert.equal(tagged[0].tags.interaction, 'mcq');

const pianoBook = generateBook({
  tagged: tagSources(
    await extractSources(pianoSeed.sources),
    { id: 'piano', label: 'Piano' },
  ),
  subject: { id: 'piano', label: 'Piano' },
  title: 'Piano test',
});
assert.ok(pianoBook.pages.some((p) => p.type === 'piano'));
assert.equal(pianoBook.instanceKind, 'piano');

const actBook = generateBook({
  tagged: tagSources(
    await extractSources(actSeed.sources),
    { id: 'act_math', label: 'ACT Math' },
  ),
  subject: { id: 'act_math', label: 'ACT Math' },
  title: 'ACT test',
});
assert.ok(actBook.pages.some((p) => p.type === 'mcq'));
assert.ok(actBook.pages.some((p) => p.action === 'open-diagnostic'));

const cooked = await runBookPipeline({
  sources: [{ id: 'n1', name: 'Note', kind: 'note', prompt: 'Twinkle motif practice' }],
  subject: { id: 'piano', label: 'Piano' },
  title: 'Cooked piano',
});
assert.equal(cooked.inst.kind, 'piano');
assert.ok(cooked.book.pages.length >= 3);

assert.ok(pianoSeed.pages.some((p) => p.type === 'piano'));
assert.ok(actSeed.pages.some((p) => p.type === 'mcq'));

console.log('pipeline.test.mjs · ok');
