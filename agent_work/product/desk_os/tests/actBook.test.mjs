import assert from 'node:assert/strict';
import {
  actAppUrl,
  actCoverUrl,
  actDiagnosticUrl,
  isLocalHost,
  LIVE_DIAGNOSTIC,
  LIVE_COVER,
  BOOT_DIAGRAM_DELAY_MS,
  BOOT_HUB_DELAY_MS,
} from '../js/actBook.js';

assert.equal(isLocalHost('localhost'), true);
assert.equal(isLocalHost('127.0.0.1'), true);
assert.equal(isLocalHost('mindcraft-93858.web.app'), false);

assert.equal(
  actDiagnosticUrl({ hostname: 'localhost' }),
  'http://localhost:5173/try/diagnostic',
);
assert.equal(actDiagnosticUrl({ hostname: 'mindcraft-93858.web.app' }), LIVE_DIAGNOSTIC);

assert.equal(
  actCoverUrl({ hostname: 'localhost' }),
  'http://localhost:5173/try/dashboard',
);
assert.equal(actCoverUrl({ hostname: 'example.com' }), LIVE_COVER);

assert.equal(actAppUrl({ hostname: 'localhost' }), actDiagnosticUrl({ hostname: 'localhost' }));
assert.notEqual(actAppUrl({ hostname: 'localhost' }), actCoverUrl({ hostname: 'localhost' }));

assert.ok(BOOT_DIAGRAM_DELAY_MS >= 500);
assert.ok(BOOT_HUB_DELAY_MS >= BOOT_DIAGRAM_DELAY_MS + 500);

console.log('actBook.test.mjs · ok');
