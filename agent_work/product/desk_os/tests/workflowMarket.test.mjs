import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js/workflowMarket.js'), 'utf8');

// Count workflow object ids in the catalog
const ids = [...src.matchAll(/id:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
const workflowIds = ids.filter((id) => !['featured', 'study', 'school', 'act', 'tutors', 'all'].includes(id));
// Dedup while keeping order
const unique = [...new Set(workflowIds)];

assert.ok(unique.length <= 3, `expected ≤3 workflows, got ${unique.length}: ${unique.join(', ')}`);
assert.ok(src.includes('slice(0, 3)'), 'paint must cap at one row of three');
assert.ok(src.includes('data-wf-search') || src.includes('[data-wf-search]'), 'search wiring present');

const css = readFileSync(join(root, 'styles.css'), 'utf8');
assert.ok(
  /hub-market-grid[\s\S]*?grid-template-columns:\s*repeat\(3/.test(css),
  'market grid stays 3 columns',
);

console.log('workflowMarket.test.mjs · ok');
