/**
 * simInvent.js · lets a student describe a custom sim in their own words
 * and have it AI-generated via the real /api/generate-sim pipeline, then
 * dropped into Sim Studio as a real chainable node (2026-09-04 ask: "give
 * ability to create sims within our scope so students can get creative").
 * Reuses generate-sim.ts exactly as it exists for the standard Learn topic
 * search: same authed start/poll job contract, same real quality gate, and
 * (as of tonight's content-engine prompt update) the same sim:ready /
 * sim:output / sim:input bridge every fresh generation now emits, so an
 * invented node is chainable to any other node with zero special-casing
 * here. Auth via fire.js, the same pattern resumeHelper.js's own
 * authenticated webhook calls already use.
 */
import { ensureFire } from './fire.js';

const WEBHOOK_BASE = 'https://mindcraft-webhook.vercel.app';
const POLL_MS = 4000;
const MAX_WAIT_MS = 150000;

async function authToken() {
  const fire = await ensureFire();
  if (!fire?.user) return null;
  try {
    return await fire.user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * @param {string} description
 * @param {(status: string) => void} [onStatus]
 * @returns {Promise<{ sim: { title: string, html: string } | null, reason?: string }>}
 */
export async function inventSim(description, onStatus = () => {}) {
  const topic = String(description || '').trim();
  if (!topic) return { sim: null, reason: 'Describe what you want to build first.' };

  const token = await authToken();
  if (!token) return { sim: null, reason: 'Sign in to invent a sim.' };

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  let jobId = '';
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/generate-sim`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.status === 'passed' && data?.result?.html) {
      return { sim: { title: data.result.title || topic, html: data.result.html } };
    }
    if (data?.status === 'running' && data?.jobId) {
      jobId = String(data.jobId);
    } else {
      return { sim: null, reason: data?.reason || data?.error || `Could not start (${res.status}).` };
    }
  } catch (e) {
    return { sim: null, reason: `Generation service unreachable: ${String(e).slice(0, 140)}` };
  }

  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    onStatus(`Still building (${Math.round((Date.now() - started) / 1000)}s)...`);
    try {
      const res = await fetch(`${WEBHOOK_BASE}/api/generate-sim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.status === 'running') continue;
      if (data?.status === 'passed' && data?.result?.html) {
        return { sim: { title: data.result.title || topic, html: data.result.html } };
      }
      if (data?.status === 'no_good_result') {
        return { sim: null, reason: data?.reason || 'Did not pass the quality check, so nothing was built.' };
      }
      return { sim: null, reason: data?.detail || data?.reason || 'Generation ended without a usable result.' };
    } catch (e) {
      return { sim: null, reason: `Lost contact: ${String(e).slice(0, 140)}` };
    }
  }
  return { sim: null, reason: 'Taking longer than expected. Nothing was lost, try again.' };
}

/** GET /api/list-generated-sims, filtered to sims that actually speak the
 * chainability bridge, only fresh generations since tonight's prompt
 * update do. An older library sim with no sim:ready would otherwise sit
 * dead on the board with no ports at all. */
export async function listChainableLibrarySims() {
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/list-generated-sims`);
    const data = await res.json().catch(() => ({}));
    const sims = Array.isArray(data?.sims) ? data.sims : [];
    return sims.filter((sim) => typeof sim?.html === 'string' && sim.html.includes('sim:ready'));
  } catch {
    return [];
  }
}
