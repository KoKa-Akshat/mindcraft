/** Boot → instance hub → open desk / ACT · n8n-shaped flow */

import { BOOT_DIAGRAM_DELAY_MS, BOOT_HUB_DELAY_MS } from './actBook.js';
import { getRole } from './onboarding.js';

const INST_KEY = 'deskOs.instances';
const USER_KEY = 'deskOs.user';

export { BOOT_DIAGRAM_DELAY_MS, BOOT_HUB_DELAY_MS };

const DEFAULTS = [
  {
    id: 'desk_main',
    kind: 'desk',
    name: 'field-desk',
    label: 'Field Desk',
    badge: 'Desk',
    status: 'running',
    execUsed: 12,
    execCap: 1000,
  },
  {
    id: 'act_main',
    kind: 'act',
    name: 'act-fieldbook',
    label: 'ACT Field Book',
    badge: 'ACT',
    seed: 'act',
    status: 'running',
    execUsed: 0,
    execCap: 1000,
  },
  {
    id: 'piano_main',
    kind: 'piano',
    name: 'piano-book',
    label: 'Piano Field Book',
    badge: 'Piano',
    seed: 'piano',
    status: 'running',
    execUsed: 0,
    execCap: 1000,
  },
];

function loadInstances() {
  try {
    const raw = JSON.parse(localStorage.getItem(INST_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveInstances(list) {
  try {
    localStorage.setItem(INST_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveUser(u) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch { /* ignore */ }
}

function ensureCatalog() {
  const list = loadInstances();
  const byId = new Map(list.map((x) => [x.id, x]));
  let changed = false;
  for (const d of DEFAULTS) {
    if (!byId.has(d.id)) {
      list.push({ ...d, createdAt: new Date().toISOString() });
      changed = true;
    } else {
      const cur = byId.get(d.id);
      if (!cur.kind) {
        Object.assign(cur, { kind: d.kind, badge: d.badge, label: d.label });
        changed = true;
      }
      // Catalog rename · act-prep → act-fieldbook · keep seed pointers fresh
      if (cur.name !== d.name || cur.label !== d.label || cur.badge !== d.badge || cur.kind !== d.kind) {
        cur.name = d.name;
        cur.label = d.label;
        cur.badge = d.badge;
        cur.kind = d.kind;
        changed = true;
      }
      if (d.seed && cur.seed !== d.seed) {
        cur.seed = d.seed;
        changed = true;
      }
      if (cur.execCap == null) {
        cur.execUsed = d.execUsed;
        cur.execCap = d.execCap;
        changed = true;
      }
      if (cur.blurb) {
        delete cur.blurb;
        changed = true;
      }
    }
  }
  if (changed) saveInstances(list);
  return list;
}

/**
 * @param {{
 *   boot: HTMLElement,
 *   hub: HTMLElement,
 *   onOpenInstance: (inst: object) => void,
 *   onCreateInstance?: () => void,
 *   onSignOut: () => void,
 * }} opts
 */
const GOALS_KEY = 'deskOs.instanceGoals';
const GOAL_FOCUS_KEY = 'deskOs.goalFocus';

const GOALS_BY_KIND = {
  desk: [
    { id: 'tasks_today', label: 'Tasks for today' },
    { id: 'connect_tools', label: 'Connect school tools' },
    { id: 'mastery_topic', label: 'Mastery on a topic' },
    { id: 'file_notes', label: 'File class notes' },
  ],
  act: [
    { id: 'mastery_lesson', label: 'Mastery to a lesson' },
    { id: 'practice_set', label: 'Finish a practice set' },
    { id: 'score_target', label: 'Hit a score target' },
    { id: 'review_mistakes', label: 'Review mistakes' },
  ],
  piano: [
    { id: 'hand_position', label: 'Steady hand position' },
    { id: 'five_finger', label: 'Clean five-finger run' },
    { id: 'learn_motif', label: 'Learn a short motif' },
    { id: 'daily_reps', label: 'Daily practice reps' },
  ],
  book: [
    { id: 'finish_chapter', label: 'Finish a chapter' },
    { id: 'mastery_topic', label: 'Mastery on a topic' },
    { id: 'review_notes', label: 'Review notes' },
  ],
};

function greetWord() {
  const h = new Date().getHours();
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  return 'good evening';
}

function loadGoals() {
  try {
    const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveGoals(map) {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/**
 * Honest mastery estimate for the focused instance.
 * Only a number when we have recorded evidence (check-in / practice).
 * Otherwise null → UI shows a dash.
 */
function masteryForInstance(inst) {
  if (!inst) return { pct: null, sure: false };
  const direct = Number(inst.masteryPct);
  if (Number.isFinite(direct) && direct >= 0) {
    const pct = Math.max(0, Math.min(100, Math.round(direct)));
    return { pct, sure: true };
  }
  try {
    const raw = JSON.parse(localStorage.getItem('deskOs.mastery') || 'null');
    if (
      raw &&
      raw.instanceId === inst.id &&
      raw.sure === true &&
      Number.isFinite(Number(raw.pct))
    ) {
      return { pct: Math.max(0, Math.min(100, Math.round(Number(raw.pct)))), sure: true };
    }
  } catch { /* ignore */ }
  return { pct: null, sure: false };
}

function goalOptionsFor(inst) {
  const kind = inst?.kind || 'desk';
  return GOALS_BY_KIND[kind] || GOALS_BY_KIND.desk;
}

export function createBootHub({ boot, hub, onOpenInstance, onCreateInstance, onSignOut, onResumeOpen, onMapOpen, onHomeOpen }) {
  const bootTitle = boot?.querySelector('[data-boot-title]');
  const bootDots = boot?.querySelector('[data-boot-dots]');
  const hubName = hub?.querySelector('[data-hub-name]');
  const hubEmail = hub?.querySelector('[data-hub-email]');
  const hubFirst = hub?.querySelector('[data-hub-first]');
  const hubGreetWord = hub?.querySelector('[data-hub-greet-word]');
  const hubDate = hub?.querySelector('[data-hub-date]');
  const goalInstance = hub?.querySelector('[data-hub-goal-instance]');
  const goalType = hub?.querySelector('[data-hub-goal-type]');
  const goalEcho = hub?.querySelector('[data-hub-goal-echo]');
  const hubMasteryPct = hub?.querySelector('[data-hub-mastery-pct]');
  const graphVeil = hub?.querySelector('[data-hub-graph-veil]');
  const graphFrame = hub?.querySelector('[data-hub-graph-frame]');
  const heroSearchForm = hub?.querySelector('[data-hub-hero-search]');
  const heroSearchInput = hub?.querySelector('[data-hub-hero-search-input]');
  const heroSearchResult = hub?.querySelector('[data-hub-hero-search-result]');
  const heroSearchResultText = hub?.querySelector('[data-hub-hero-search-result-text]');
  const heroSearchGo = hub?.querySelector('[data-hub-hero-search-go]');
  const jesseNavs = [...(hub?.querySelectorAll('[data-hub-jesse-nav]') || [])];
  const resumeNavs = [...(hub?.querySelectorAll('[data-hub-resume-nav]') || [])];
  const tutorTiles = hub?.querySelector('[data-hub-tutor-tiles]');
  const tabBtns = [...(hub?.querySelectorAll('[data-hub-tab]') || [])];
  const panels = [...(hub?.querySelectorAll('[data-hub-panel]') || [])];
  const tab2Row = hub?.querySelector('[data-hub-tabs2]');
  const heroCard = hub?.querySelector('[data-hub-workspace]');
  const tab2Btns = [...(hub?.querySelectorAll('[data-hub-tab2]') || [])];
  let activeDashboardTab = 'home';

  function selectDashboardTab(tab) {
    activeDashboardTab = ['home', 'resume', 'tutors'].includes(tab) ? tab : 'home';
    tab2Btns.forEach((button) => {
      const selected = button.dataset.hubTab2 === activeDashboardTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    paintRoleSurfaces();
  }

  // No hardcoded fallback identity here (this used to default to the
  // founder's own name/email, meaning every real student saw
  // "Akshat Koirala" / his email on their own hub whenever setUser() ran
  // with no profile, e.g. renderHub()'s bare setUser() call, or the local
  // demo onboarding path before a real profile was ever known). Falls back
  // to whatever was last persisted (loadUser()), and only to a neutral
  // placeholder if nothing has ever been saved.
  function setUser(profile = {}) {
    const user = {
      name: 'Student',
      email: '',
      ...loadUser(),
      ...profile,
    };
    saveUser(user);
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    if (hubFirst) hubFirst.textContent = String(user.name || 'there').split(/\s+/)[0];
    if (hubGreetWord) hubGreetWord.textContent = greetWord();
    if (hubDate) {
      hubDate.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date());
    }
    paintRoleSurfaces();
    return user;
  }

  /**
   * Tutors have no hatchling (2026-08-31 ask): a tutor's hub swaps Jesse
   * for the three tutor-tool tiles (Calendly, Meet, Location), which
   * deep-link to the real /tutor dashboard where those boxes already live.
   * Students keep Jesse exactly as before.
   */
  function paintRoleSurfaces() {
    const tutor = (getRole() || 'student') === 'tutor';
    if (tab2Row) tab2Row.hidden = tutor;
    if (heroCard) heroCard.hidden = tutor || activeDashboardTab !== 'home';
    if (tutorTiles) tutorTiles.hidden = !tutor;
  }

  function selectedInstance(list) {
    const id = goalInstance?.value || localStorage.getItem(GOAL_FOCUS_KEY) || list[0]?.id;
    return list.find((x) => x.id === id) || list[0] || null;
  }

  function paintGoalControls(list) {
    if (!goalInstance || !goalType) return;
    const goals = loadGoals();
    const focusId = localStorage.getItem(GOAL_FOCUS_KEY) || list[0]?.id || '';
    goalInstance.innerHTML = list.map((inst) => `
      <option value="${inst.id}" ${inst.id === focusId ? 'selected' : ''}>${inst.name}</option>
    `).join('');
    const inst = selectedInstance(list);
    const opts = goalOptionsFor(inst);
    const saved = inst ? goals[inst.id]?.type : '';
    const pick = opts.some((o) => o.id === saved) ? saved : opts[0]?.id;
    goalType.innerHTML = opts.map((o) => `
      <option value="${o.id}" ${o.id === pick ? 'selected' : ''}>${o.label}</option>
    `).join('');
    paintGoalEcho(inst, opts.find((o) => o.id === pick));
  }

  function paintGoalEcho(inst, goal) {
    if (!goalEcho) return;
    if (!inst || !goal) {
      goalEcho.textContent = 'Pick an instance, then a target for today.';
      return;
    }
    goalEcho.textContent = `${inst.name} → ${goal.label}`;
  }

  function persistGoal() {
    const list = ensureCatalog();
    const inst = selectedInstance(list);
    if (!inst || !goalType) return;
    const opts = goalOptionsFor(inst);
    const goal = opts.find((o) => o.id === goalType.value) || opts[0];
    const map = loadGoals();
    map[inst.id] = { type: goal.id, label: goal.label, at: new Date().toISOString() };
    saveGoals(map);
    try { localStorage.setItem(GOAL_FOCUS_KEY, inst.id); } catch { /* ignore */ }
    paintGoalEcho(inst, goal);
    paintMastery(list);
  }

  /** Honest estimate beside the cube · dash when we do not know */
  function paintMastery(list) {
    const inst = selectedInstance(list);
    const { pct, sure } = masteryForInstance(inst);
    if (hubMasteryPct) {
      if (sure && pct != null) {
        hubMasteryPct.textContent = `${pct}%`;
        hubMasteryPct.classList.remove('is-unknown');
      } else {
        hubMasteryPct.textContent = '--';
        hubMasteryPct.classList.add('is-unknown');
      }
    }
    try {
      localStorage.setItem('deskOs.mastery', JSON.stringify({
        instanceId: inst?.id || null,
        pct: sure ? pct : null,
        sure,
      }));
    } catch { /* ignore */ }
  }

  // Instance-card rendering (the old "Your instances" grid, `[data-hub-list]`)
  // was removed 2026-08-31. The instances concept is dropped from the hub,
  // not just hidden, and "Tutors nearby" now sits where it used to. The
  // catalog itself (ensureCatalog/list) stays: it still backs the Mastery
  // goal-instance picker (paintGoalControls) and mastery readout
  // (paintMastery) just above where the grid used to be. onOpenInstance and
  // onCreateInstance are unused now that their only trigger buttons
  // (`[data-open]` / `[data-create]`) are gone with the grid, kept as
  // no-op-safe params rather than changing createBootHub's call signature
  // in app.js, which is outside this audit's scope.
  function renderHub() {
    const list = ensureCatalog();
    const user = setUser();
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    paintGoalControls(list);
    paintMastery(list);
  }

  /** Append a cooked Field Book instance (like ACT) */
  function appendInstance(inst) {
    const list = ensureCatalog();
    if (list.some((x) => x.id === inst.id)) {
      renderHub();
      return list;
    }
    list.push(inst);
    saveInstances(list);
    renderHub();
    return list;
  }

  function showBoot() {
    if (!boot) return Promise.resolve();
    boot.hidden = false;
    boot.classList.remove('hidden');
    hub?.classList.add('hidden');
    if (hub) hub.hidden = true;
    if (bootTitle) bootTitle.textContent = 'Your workspace is starting up…';
    bootDots?.classList.add('is-pulse');
    const diagram = boot.querySelector('[data-boot-diagram]');
    diagram?.classList.remove('is-in');
    return new Promise((resolve) => {
      // Icons/arrows fade in after title
      window.setTimeout(() => {
        diagram?.classList.add('is-in');
      }, BOOT_DIAGRAM_DELAY_MS);
      // Short pause after diagram, then hub
      window.setTimeout(() => {
        bootDots?.classList.remove('is-pulse');
        resolve();
      }, BOOT_HUB_DELAY_MS);
    });
  }

  // No-animation path for a real signed-in student handed off from the
  // React app (2026-09-01 ask): the "workspace is starting up..." beat with
  // its icon-diagram fade exists to sell the local demo prototype some
  // theater, a real student who already clicked through two real preference
  // screens does not need another ~2s of manufactured boot time before
  // reaching content that is already loaded.
  function skipBoot() {
    if (!boot) return;
    boot.classList.add('hidden');
    boot.hidden = true;
    if (hub) { hub.hidden = true; hub.classList.add('hidden'); }
  }

  function showHub() {
    boot?.classList.add('hidden');
    if (boot) boot.hidden = true;
    if (!hub) return;
    hub.hidden = false;
    hub.classList.remove('hidden');
    renderHub();
    selectDashboardTab('home');
    onHomeOpen?.();
  }

  function hideAll() {
    boot?.classList.add('hidden');
    hub?.classList.add('hidden');
    if (boot) boot.hidden = true;
    if (hub) hub.hidden = true;
  }

  // The knowledge-map card is the only Workspace-tab affordance now
  // (2026-09-02: the "Open Learn" CTA, paper-stack, bookmark, raccoon, and
  // Jesse slip that used to surround it are gone) — a plain click-through
  // to /learn. Not role-branched: heroCard (this card's own container) is
  // hidden entirely for tutor accounts via paintRoleSurfaces(), so a tutor
  // never reaches this click in the first place; the old /tutor branch
  // here was already unreachable for that reason before this simplified.
  graphVeil?.addEventListener('click', () => {
    window.location.href = '/learn';
  });

  // Hero search (2026-09-03 ask): a real search over the same real
  // full-concept-graph.json the map card already renders (fetched once,
  // lazily, on first search — the graph iframe fetches its own copy
  // independently, this never touches or waits on that one). Matching here
  // is a light client-side label match, not the real ML semantic search
  // /learn uses (that needs an auth token + an embedding model this static
  // shell does not carry), so a miss here is never presented as "nothing
  // exists" — the fallback always offers the real search instead. A hit
  // posts the exact same {type:'highlight'} message Learn.tsx already sends
  // this same viewer (see full-graph-viewer.html's message listener), which
  // is what actually drives the fly-to-node camera animation.
  let graphNodesPromise = null;
  function loadGraphNodes() {
    if (!graphNodesPromise) {
      graphNodesPromise = fetch('/full-concept-graph.json')
        .then((r) => r.json())
        .then((data) => Array.isArray(data.nodes) ? data.nodes : [])
        .catch(() => []);
    }
    return graphNodesPromise;
  }

  function scoreNode(node, needle) {
    const name = String(node.name || '').toLowerCase();
    if (!name) return 0;
    if (name === needle) return 4;
    if (name.startsWith(needle)) return 3;
    if (name.includes(needle)) return 2;
    const words = needle.split(/\s+/).filter(Boolean);
    if (words.length && words.every((w) => name.includes(w))) return 1;
    return 0;
  }

  async function findBestNode(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    const nodes = await loadGraphNodes();
    let best = null;
    let bestScore = 0;
    for (const node of nodes) {
      const score = scoreNode(node, needle);
      if (score > bestScore) { bestScore = score; best = node; }
    }
    return best;
  }

  function showHeroSearchResult(text, { empty = false } = {}) {
    if (!heroSearchResult || !heroSearchResultText) return;
    heroSearchResultText.textContent = text;
    heroSearchResult.classList.toggle('is-empty', empty);
    heroSearchResult.hidden = false;
  }

  heroSearchForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const query = (heroSearchInput?.value || '').trim();
    if (!query) return;
    showHeroSearchResult('Searching your knowledge map...');
    if (heroSearchGo) heroSearchGo.dataset.query = query;
    const node = await findBestNode(query);
    if (node) {
      graphFrame?.contentWindow?.postMessage({ type: 'highlight', nodeId: node.id, neighborIds: [] }, '*');
      showHeroSearchResult(`Found "${node.name}" on the map.`);
      if (heroSearchGo) heroSearchGo.textContent = `Open ${node.name} in Learn →`;
    } else {
      showHeroSearchResult(`Nothing obvious on the map for "${query}" yet, but Learn's real search is smarter than this quick match.`, { empty: true });
      if (heroSearchGo) heroSearchGo.textContent = 'Search in Learn →';
    }
  });

  heroSearchGo?.addEventListener('click', () => {
    const query = heroSearchGo.dataset.query || heroSearchInput?.value || '';
    window.location.href = `/learn?q=${encodeURIComponent(query)}`;
  });

  jesseNavs.forEach((nav) => {
    nav.addEventListener('click', () => {
      selectDashboardTab('tutors');
      onMapOpen?.();
    });
  });

  resumeNavs.forEach((nav) => {
    nav.addEventListener('click', () => {
      selectDashboardTab('resume');
      onResumeOpen?.();
    });
  });

  tab2Btns
    .filter((button) => button.dataset.hubTab2 === 'home')
    .forEach((button) => {
      button.addEventListener('click', () => {
        selectDashboardTab('home');
        onHomeOpen?.();
      });
    });

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.hubTab;
      // "Dashboard" is real cross-app navigation to Learn (React app's
      // /learn, the "ask anything -> resolve -> read -> check" experience:
      // real search, real chapters, real sims), not an in-page panel this
      // static shell can render. Desk OS is a separate static page from
      // the React app, so this has to be a full navigation, not a
      // client-side route change. (2026-09-01: was /knowledge-graph, the
      // concept-graph visualization; corrected to /learn, which is the
      // lessons-and-sims screen actually meant here.)
      if (tab === 'dashboard') {
        window.location.href = '/learn';
        return;
      }
      tabBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      panels.forEach((p) => {
        p.hidden = p.dataset.hubPanel !== tab;
      });
    });
  });

  hub?.querySelector('[data-hub-signout]')?.addEventListener('click', () => {
    onSignOut?.();
  });

  goalInstance?.addEventListener('change', () => {
    const list = ensureCatalog();
    try { localStorage.setItem(GOAL_FOCUS_KEY, goalInstance.value); } catch { /* ignore */ }
    paintGoalControls(list);
    paintMastery(list);
  });
  goalType?.addEventListener('change', () => persistGoal());

  async function runAfterAuth(profile, opts) {
    setUser(profile || {});
    if (opts?.skipBoot) {
      skipBoot();
    } else {
      await showBoot();
    }
    showHub();
  }

  return {
    runAfterAuth,
    showHub,
    showBoot,
    hideAll,
    renderHub,
    appendInstance,
    setUser,
  };
}
