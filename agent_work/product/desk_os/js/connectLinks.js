/** Desk connect links · Moodle / Gmail / GCal · local status that survives refresh */

const KEY = 'deskOs.connect';

export const CONNECTORS = [
  {
    id: 'moodle',
    title: 'Connect Moodle',
    kind: 'moodle',
    meta: 'Courses · files · due dates',
    steps: [
      'In Moodle, open a course → More → Export → Calendar.',
      'Download the .ics feed or copy the feed URL.',
      'Back here: Calendar → Load sample week (demo) or paste your ICS later.',
      'Uploads from Moodle PDFs go straight into Binder by course.',
    ],
  },
  {
    id: 'gmail',
    title: 'Connect Gmail',
    kind: 'gmail',
    meta: 'School mail · dues in Tonight',
    steps: [
      'School Google often blocks OAuth. We stay local on purpose.',
      'Open Mail on the desk → Sample to load a live school inbox.',
      'Pin anything with a due date; it ranks into your plan.',
      'Compose stays on the desk. Nothing leaves your browser.',
    ],
  },
  {
    id: 'gcal',
    title: 'Connect Google Calendar',
    kind: 'gcal',
    meta: 'ICS · this week on the desk',
    steps: [
      'Google Calendar → Settings → Import & export → Export.',
      'Or use Calendar on the desk → Load sample week for a live demo.',
      'Dues land as dated cards you can clear anytime.',
      'Refresh the desk anytime. Connected status sticks.',
    ],
  },
];

export function loadConnectState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function markConnected(id) {
  const state = loadConnectState();
  state[id] = { at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignore */ }
  return state;
}

export function isConnected(id, state = loadConnectState()) {
  return Boolean(state?.[id]?.at);
}

/** Tonight queue = connect rows · status refreshes from localStorage */
export function buildConnectQueue() {
  const state = loadConnectState();
  return CONNECTORS.map((c, i) => {
    const on = isConnected(c.id, state);
    return {
      id: c.id,
      kind: on ? 'linked' : 'connect',
      title: on ? `${c.title.replace(/^Connect /, '')} · linked` : c.title,
      meta: on ? `Connected · ${new Date(state[c.id].at).toLocaleDateString()}` : c.meta,
      score: on ? 10 - i : 100 - i,
      action: `connect:${c.id}`,
      connected: on,
    };
  });
}

export function getConnector(id) {
  return CONNECTORS.find((c) => c.id === id) || null;
}
