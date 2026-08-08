import { listItems, saveItem, deleteItem, listEvents, saveEvents, clearEvents, listMail, saveMail, saveMailMany, deleteMail } from './db.js';
import {
  COURSES,
  classifyFile,
  extractTextSnippet,
  formatDisplayDate,
} from './classify.js';
import {
  compareSemesterIds,
  currentSemester,
  itemSemester,
  semesterFromDate,
} from './semester.js';
import { daysUntil, parseIcs } from './ics.js';
import { createCardEl, nextSlot, sizeCanvas } from './canvas.js';
import { createRecorder } from './record.js';
import {
  buildLiveWeekIcs,
  buildSampleInbox,
  draftReplyFor,
  draftToCardFields,
  mailToCardFields,
} from './mail.js';
import { layoutByCourse, runCleanupScan } from './cleanup.js';
import { createSurfaces } from './surfaces.js?v=r8a';
import { createStickies } from './stickies.js';
import { createDeskPan } from './pan.js?v=r8a';
import { createZoomPack } from './zoomPack.js?v=r8a';
import { createGate } from './gate.js';
import { createPaperDesk } from './float.js?v=r8a';
import {
  createTranscriptSurface,
  boopSummaryLines,
  boopExtractDue,
} from './transcript.js?v=r8a';
import { createOwlLinks } from './connect.js?v=r8a';
import { createUploadSurface, spawnDashNotes } from './upload.js?v=r8a';
import { createHomeHub, HOME_ART } from './home.js?v=r8a';
import { createWidgetFactory } from './widgets.js?v=r8a';
import { createJournalFocus } from './journal.js?v=r8a';
import { createFieldBookCook } from './fieldbook.js?v=r8a';
import { createSatellites } from './satellites.js?v=r8a';
import { createActBookOverlay } from './actBook.js?v=r8a';
import { openConnectGuide } from './connectGuide.js?v=r8a';
import { createBootHub } from './bootHub.js?v=r8a';
import { createBookStudio, getBook } from './createBook.js?v=r8a';
import { createTutorMap } from './tutorMap.js?v=r8a';
import { createWorkflowMarket } from './workflowMarket.js?v=r8a';
import { createHubCall } from './hubCall.js?v=r8a';
import { loadConnectState, isConnected } from './connectLinks.js';

const ORB_SRC = {
  record: 'img/orbs/record.png',
  drop: 'img/orbs/drop.png',
  mail: 'img/orbs/mail.png',
  binder: 'img/orbs/binder.png',
  cleanup: 'img/orbs/drop.png',
  calendar: 'img/orbs/calendar.png',
  graph: 'img/orbs/binder.png',
  mascot: 'img/orbs/mascot.png',
};

const TOOL_META = {
  mail: { kicker: 'School mail', title: 'Mail', pane: 'hiveMail', orb: 'mail' },
  binder: { kicker: 'Filed work', title: 'Notes', pane: 'hiveBinder', orb: 'binder' },
  cleanup: { kicker: 'Desk review', title: 'Organize', pane: 'hiveCleanup', orb: 'drop' },
  calendar: { kicker: 'Due dates', title: 'Calendar', pane: 'hiveCalendar', orb: 'calendar' },
  graph: { kicker: 'This term', title: 'Courses', pane: 'hiveGraph', orb: 'binder' },
};

const els = {
  appShell: document.getElementById('appShell'),
  workspace: document.getElementById('workspace'),
  stage: document.getElementById('stage'),
  toolView: document.getElementById('toolView'),
  toolKicker: document.getElementById('toolKicker'),
  toolTitle: document.getElementById('toolTitle'),
  toolDone: document.getElementById('toolDone'),
  canvas: document.getElementById('canvas'),
  canvasScroll: document.getElementById('canvasScroll'),
  semesterSelect: document.getElementById('semesterSelect'),
  fileInput: document.getElementById('fileInput'),
  toolDesk: document.getElementById('toolDesk'),
  toolDrop: document.getElementById('toolDrop'),
  toolRecord: document.getElementById('toolRecord'),
  toolMail: document.getElementById('toolMail'),
  toolCalendar: document.getElementById('toolCalendar'),
  toolBinder: document.getElementById('toolBinder'),
  toolCleanup: document.getElementById('toolCleanup'),
  toolGraph: document.getElementById('toolGraph'),
  recordPlay: document.getElementById('recordPlay'),
  recordLabel: document.getElementById('recordLabel'),
  railHint: document.getElementById('railHint'),
  liveBar: document.getElementById('liveBar'),
  liveText: document.getElementById('liveText'),
  inspector: document.getElementById('inspector'),
  inspectorTitle: document.getElementById('inspectorTitle'),
  inspectorBody: document.getElementById('inspectorBody'),
  inspectorClose: document.getElementById('inspectorClose'),
  binderSearch: document.getElementById('binderSearch'),
  binderHiveList: document.getElementById('binderHiveList'),
  cleanupList: document.getElementById('cleanupList'),
  cleanupApply: document.getElementById('cleanupApply'),
  cleanupRescan: document.getElementById('cleanupRescan'),
  graphView: document.getElementById('graphView'),
  icsInput: document.getElementById('icsInput'),
  icsLoadBtn: document.getElementById('icsLoadBtn'),
  icsSampleBtn: document.getElementById('icsSampleBtn'),
  icsClearBtn: document.getElementById('icsClearBtn'),
  mailList: document.getElementById('mailList'),
  mailLoadSample: document.getElementById('mailLoadSample'),
  mailInboxPane: document.getElementById('mailInboxPane'),
  mailComposePane: document.getElementById('mailComposePane'),
  draftTo: document.getElementById('draftTo'),
  draftSubject: document.getElementById('draftSubject'),
  draftBody: document.getElementById('draftBody'),
  draftCourse: document.getElementById('draftCourse'),
  draftSaveBtn: document.getElementById('draftSaveBtn'),
  draftClearBtn: document.getElementById('draftClearBtn'),
  unitCaseBtn: document.getElementById('unitCaseBtn'),
  toast: document.getElementById('toast'),
  hud: document.getElementById('hud'),
  briefingTitle: document.getElementById('briefingTitle'),
  briefingSummary: document.getElementById('briefingSummary'),
  briefingClock: document.getElementById('briefingClock'),
  priorityList: document.getElementById('priorityList'),
  mailPrioritySummary: document.getElementById('mailPrioritySummary'),
  cue: document.getElementById('cue'),
  cueText: document.getElementById('cueText'),
  hub: document.getElementById('hub'),
  mascot: document.getElementById('mascot'),
  toolNotes: document.getElementById('toolNotes'),
  toolGoogle: document.getElementById('toolGoogle'),
  toolSpotify: document.getElementById('toolSpotify'),
  toolFieldBook: document.getElementById('toolFieldBook'),
  hubTutorMap: document.getElementById('hubTutorMap'),
  workflowMarket: document.getElementById('workflowMarket'),
  sheetOrb: document.getElementById('sheetOrb'),
  liveMini: document.getElementById('liveMini'),
  brandHome: document.getElementById('brandHome'),
  hubHome: document.getElementById('hubHome'),
  brandLogo: document.getElementById('brandLogo'),
  noteLines: document.getElementById('noteLines'),
  noteInput: document.getElementById('noteInput'),
  deskViewport: document.getElementById('deskViewport'),
  deskPlane: document.getElementById('deskPlane'),
  owlSheet: document.getElementById('owlSheet'),
  owlHint: document.getElementById('owlHint'),
  owlPrompt: document.getElementById('owlPrompt'),
  linkLayer: document.getElementById('linkLayer'),
  gate: document.getElementById('gate'),
  deskShell: document.getElementById('deskShell'),
  cookStage: document.getElementById('cookStage'),
  bootStage: document.getElementById('bootStage'),
  hubStage: document.getElementById('hubStage'),
  studioStage: document.getElementById('studioStage'),
  journalPage: document.getElementById('journalPage'),
  authBlock: document.getElementById('authBlock'),
  gateHint: document.getElementById('gateHint'),
};

/** @type {string} */
let activeMode = 'desk';
/** @type {ReturnType<typeof runCleanupScan>|null} */
let cleanupScan = null;

/** @type {any[]} */
let cards = [];
let itemsCache = [];
let eventsCache = [];
let mailCache = [];
let activeSemesterId = currentSemester().id;
let selectedId = null;
let recording = false;
let finishingTranscript = false;
/** @type {{ reset: () => void } | null} */
let deskPan = null;
/** @type {ReturnType<typeof createZoomPack> | null} */
let zoomPack = null;
/** @type {ReturnType<typeof createPaperDesk> | null} */
let paperDesk = null;
/** @type {ReturnType<typeof createTranscriptSurface> | null} */
let transcript = null;
/** @type {ReturnType<typeof createOwlLinks> | null} */
let owlLinks = null;
/** @type {ReturnType<typeof createUploadSurface> | null} */
let uploadSurface = null;
/** @type {ReturnType<typeof createHomeHub> | null} */
let homeHub = null;
/** @type {ReturnType<typeof createJournalFocus> | null} */
let journalFocus = null;
/** @type {ReturnType<typeof createFieldBookCook> | null} */
let fieldBook = null;
/** @type {ReturnType<typeof createSatellites> | null} */
let satellites = null;
/** @type {ReturnType<typeof createActBookOverlay> | null} */
let actBook = null;
/** @type {ReturnType<typeof createBootHub> | null} */
let bootHub = null;
/** @type {ReturnType<typeof createBookStudio> | null} */
let bookStudio = null;
/** @type {ReturnType<typeof createWidgetFactory> | null} */
let widgets = null;
/** @type {ReturnType<typeof createTutorMap> | null} */
let tutorMap = null;
/** @type {ReturnType<typeof createWorkflowMarket> | null} */
let workflowMarket = null;
/** @type {ReturnType<typeof createHubCall> | null} */
let hubCall = null;
/** @type {string | null} */
let bookBlobUrl = null;
let entered = false;
let instanceOpen = false;
/** Active instance · rail tools are shared chrome that act on this */
/** @type {{ id?: string, name?: string, kind?: string, label?: string } | null} */
let activeInstance = null;

function paintRailInstance(inst) {
  const el = document.querySelector('[data-rail-instance]');
  if (!el) return;
  const name = inst?.name || inst?.label || 'workspace';
  el.textContent = name;
  el.title = `Active instance · ${name}`;
  if (els.deskShell) {
    els.deskShell.dataset.instance = inst?.id || '';
    els.deskShell.dataset.instanceKind = inst?.kind || 'desk';
  }
}
function refreshHomeHub() {
  homeHub?.refresh();
  owlLinks?.redraw();
}

function openActPractice() {
  // ACT package · diagnosis first (same path as hub Open instance)
  ensureDeskSurfaces();
  prepareDeskShell();
  els.deskShell?.classList.remove('is-act-locked');
  // Hide home calendar/pages under the bleed · do not pre-open calendar
  const cal = els.deskPlane?.querySelector('[data-sheet="calendar"], [data-surface-pane="calendar"]');
  if (cal) cal.hidden = true;
  actBook?.open();
  showToast('ACT · starting from diagnosis');
}

function wireOwlToDesk() {
  if (!owlLinks?.ensureLink) return;
  // Two anchors · connect zone + main intel sheet
  const connect = els.deskPlane?.querySelector('[data-sheet="tonight"]');
  const intel = els.deskPlane?.querySelector('[data-sheet="intel"]');
  if (connect) owlLinks.ensureLink(connect);
  if (intel) owlLinks.ensureLink(intel);
  owlLinks.redraw();
  syncSatellites();
}

function syncSatellites() {
  const state = loadConnectState();
  const ids = ['moodle', 'gmail', 'gcal'].filter((id) => isConnected(id, state));
  satellites?.sync(ids);
  satellites?.place();
}

function seatOwl() {
  const owl = els.owlSheet;
  if (!owl) return;
  owl.style.left = HOME_ART.owl.left;
  owl.style.top = HOME_ART.owl.top;
  owl.classList.remove('owl-fly-in');
  owl.classList.add('is-perched');
  wireOwlToDesk();
}

function layoutDeskHome(_note) {
  // Drop legacy on-deck / scrap clutter from prior layouts
  els.deskPlane?.querySelectorAll('[data-sheet="ondeck"], .note-scrap').forEach((el) => el.remove());
  deskPan?.fitHome?.();
  homeHub?.ensure();
  homeHub?.composeArt({ reseat: true });
  // Page 6 · calendar lives on the home grid
  const cal = surfaces.seat?.('calendar', HOME_ART.calendar, { force: true });
  if (cal) cal.dataset.userMoved = '';
  seatOwl();
  paperDesk?.save?.();
  syncSatellites();
  setSurfacePressed(null);
  requestAnimationFrame(() => {
    deskPan?.fitHome?.();
    owlLinks?.redraw();
  });
}

function setSurfacePressed(mode) {
  document.querySelectorAll('.desk-index [data-surface]').forEach((btn) => {
    const on = Boolean(mode) && btn.dataset.surface === mode;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function focusToolSheet(mode) {
  const pane = surfaces.getPane?.(mode) || els.deskPlane?.querySelector(`[data-sheet="${mode}"]`);
  if (!pane || pane.hidden) return false;
  pane.classList.remove('is-min', 'page-away');
  pane.dataset.minimized = 'false';
  const minBtn = pane.querySelector('[data-sheet-act="min"]');
  if (minBtn) {
    minBtn.textContent = '−';
    minBtn.title = 'Minimize';
  }
  surfaces.flashFocus?.(pane);
  deskPan?.focusEl?.(pane, { soft: true });
  setSurfacePressed(mode);
  activeMode = mode;
  return true;
}

async function applyConnectMark(id) {
  // Load real sample data so the link actually works. Keep desk calm (satellites, no popup spam).
  if (id === 'gmail') {
    if (!mailCache.length) await loadSampleInbox();
  } else if (id === 'gcal') {
    const upcoming = eventsCache.filter((e) => daysUntil(e.date) >= -1 && daysUntil(e.date) <= 14);
    if (!upcoming.length) {
      await clearEvents();
      eventsCache = [];
      cards = cards.filter((c) => c.type !== 'due');
      const ics = buildLiveWeekIcs();
      if (els.icsInput) els.icsInput.value = ics;
      await ingestIcs(ics);
    }
  } else if (id === 'moodle') {
    showToast('Moodle linked · upload course files to Binder');
  }
  if (journalFocus?.isOpen?.()) journalFocus.exit();
  refreshHomeHub();
  syncSatellites();
  showToast(`${id} linked`);
}

function ensureDeskSurfaces() {
  if (!els.deskPlane) return;
  if (!paperDesk) {
    paperDesk = createPaperDesk({ root: els.deskPlane });
    paperDesk.wire();
  }
  if (!widgets) {
    widgets = createWidgetFactory({
      plane: els.deskPlane,
      attachSheet: (el) => paperDesk?.attach(el),
      showToast,
      onFocus: (el) => {
        surfaces.flashFocus?.(el);
        deskPan?.focusEl?.(el, { soft: true });
      },
      onCruiseTag: ({ tag, text }) => {
        if (!tag || !text) return;
        // Soft handoff into instance surfaces
        if (tag === 'memo' && els.noteInput) {
          try {
            const cur = els.noteInput.value || '';
            els.noteInput.value = cur ? `${cur} · ${text}` : text;
          } catch { /* ignore */ }
        }
        if (tag === 'intel') {
          try {
            const raw = JSON.parse(localStorage.getItem('deskOs.intelLines') || '[]');
            const list = Array.isArray(raw) ? raw : [];
            list.unshift({ id: `cruise_${Date.now()}`, source: 'cruise', text });
            localStorage.setItem('deskOs.intelLines', JSON.stringify(list.slice(0, 12)));
            homeHub?.refresh?.();
          } catch { /* ignore */ }
        }
      },
    });
  }
  if (!transcript) {
    transcript = createTranscriptSurface({
      plane: els.deskPlane,
      attachSheet: (el) => paperDesk?.attach(el),
      onBoop: handleBoop,
    });
  }
  if (!uploadSurface) {
    uploadSurface = createUploadSurface({
      plane: els.deskPlane,
      attachSheet: (el) => {
        paperDesk?.attach(el);
        owlLinks?.redraw();
      },
      onConvert: ({ title, body, el, meta }) => {
        const lines = [
          title,
          meta?.courseName ? `Course · ${meta.courseName}` : null,
          body && body !== title ? String(body).slice(0, 72) : null,
        ].filter(Boolean);
        const notes = spawnDashNotes({
          plane: els.deskPlane,
          attachSheet: (n) => {
            paperDesk?.attach(n);
            owlLinks?.redraw();
          },
          title: title.slice(0, 28) || 'notes',
          lines,
        });
        if (notes) owlLinks?.linkSheet(notes);
        el.hidden = true;
        el.dispatchEvent(new CustomEvent('sheet:closed', { bubbles: true }));
        showToast('Owl filed it as notes');
        refreshHomeHub();
      },
    });
  }
  if (!owlLinks && els.owlSheet && els.linkLayer) {
    owlLinks = createOwlLinks({
      plane: els.deskPlane,
      owl: els.owlSheet,
      svg: els.linkLayer,
      hint: els.owlHint,
      prompt: els.owlPrompt,
      onLink: () => showToast('Connected'),
    });
  }
  if (!journalFocus) {
    journalFocus = createJournalFocus({ plane: els.deskPlane });
  }
  if (!satellites && els.owlSheet) {
    satellites = createSatellites({
      plane: els.deskPlane,
      owl: els.owlSheet,
      onOpen: (id) => {
        if (id === 'gmail') openTool('mail');
        else if (id === 'gcal') openTool('calendar');
        else if (id === 'moodle') {
          homeHub?.focus('binder');
          showToast('Moodle files → Binder');
        }
      },
    });
  }
  if (!actBook && els.deskShell) {
    actBook = createActBookOverlay({
      shell: els.deskShell,
      onClose: () => {
        if (activeInstance?.kind === 'act') {
          goHome();
          return;
        }
        showToast('Back to desk');
      },
    });
  }
  if (!homeHub) {
    homeHub = createHomeHub({
      plane: els.deskPlane,
      journal: journalFocus,
      attachSheet: (el) => {
        paperDesk?.attach(el);
        journalFocus?.wireSheet(el);
        owlLinks?.redraw();
      },
      getState: () => ({
        events: eventsCache,
        mail: mailCache,
        items: itemsCache,
      }),
      onConnectSync: ({ connected }) => {
        satellites?.sync(connected);
        satellites?.place();
      },
      onAction: (action) => {
        if (action === 'upload') els.fileInput?.click();
        else if (action === 'mail') openTool('mail');
        else if (action === 'calendar') openTool('calendar');
        else if (action === 'act' || action === 'act-full' || action === 'act-book') openActPractice();
        else if (action === 'intel:add') refreshHomeHub();
        else if (action?.startsWith('connect:')) {
          const id = action.slice('connect:'.length);
          openConnectGuide({
            plane: els.deskPlane,
            attachSheet: (el) => {
              paperDesk?.attach(el);
              journalFocus?.wireSheet(el);
            },
            journal: journalFocus,
            id,
            onMarked: (cid) => { void applyConnectMark(cid); },
          });
        }
      },
    });
  }
  if (!fieldBook) {
    fieldBook = createFieldBookCook({
      stage: els.cookStage,
      navBtn: els.toolFieldBook,
      onCooked: () => {
        showToast('ACT FieldBook is on the menu');
      },
      onDone: (note) => {
        revealDeskAfterCook(note);
      },
    });
    fieldBook.wire();
  }
}

function revealDeskAfterCook(note) {
  els.cookStage?.classList.add('hidden');
  if (els.cookStage) els.cookStage.hidden = true;
  els.deskShell?.classList.remove('hidden');
  els.appShell.dataset.mode = 'desk';
  els.appShell.dataset.surface = 'desk';
  document.title = 'MindCraft · Desk';
  ensureDeskSurfaces();
  seedHomeDesk().then(() => {
    fieldBook?.syncNav();
    layoutDeskHome(note || fieldBook?.getNote());
    showToast('Your desk is ready');
  });
}

async function seedHomeDesk() {
  // Mail / calendar fill when student marks Connect · not forced on entry
  mailCache = await listMail();
  eventsCache = await listEvents();
  itemsCache = await listItems();
  renderMailList();
  homeHub?.ensure();
  refreshHomeHub();
  wireOwlToDesk();
}

function ensureBookStudio() {
  if (bookStudio || !els.studioStage) return bookStudio;
  bookStudio = createBookStudio({
    root: els.studioStage,
    onBack: () => {
      bookStudio?.hide();
      bootHub?.showHub();
      els.appShell.dataset.mode = 'hub';
      document.title = 'MindCraft · Dashboard';
    },
    onCooked: (inst) => {
      bootHub?.appendInstance(inst);
      bookStudio?.hide();
      bootHub?.showHub();
      els.appShell.dataset.mode = 'hub';
      document.title = 'MindCraft · Dashboard';
      showToast(`${inst.name} added to Dashboard`);
    },
  });
  return bookStudio;
}

function ensureBootHub() {
  if (bootHub || !els.bootStage || !els.hubStage) return bootHub;
  bootHub = createBootHub({
    boot: els.bootStage,
    hub: els.hubStage,
    onOpenInstance: (inst) => openInstance(inst),
    onCreateInstance: () => {
      bootHub?.hideAll();
      ensureBookStudio()?.show();
      document.body.classList.add('is-hub-chrome');
      els.appShell.dataset.mode = 'studio';
      document.title = 'MindCraft · Cook a Field Book';
    },
    onSignOut: () => signOutToGate(),
  });
  return bootHub;
}

function bookSrcFor(inst) {
  if (!inst?.bookId) return null;
  const book = getBook(inst.bookId);
  if (!book?.html) return null;
  if (bookBlobUrl) {
    try { URL.revokeObjectURL(bookBlobUrl); } catch { /* ignore */ }
  }
  bookBlobUrl = URL.createObjectURL(new Blob([book.html], { type: 'text/html' }));
  return bookBlobUrl;
}

/** Gate → boot → instance hub */
async function enterFromAuth(_method) {
  if (entered && instanceOpen) return;
  entered = true;
  try {
    sessionStorage.setItem('deskOs.entered', '1');
  } catch { /* ignore */ }

  els.gate?.classList.add('hidden');
  els.cookStage?.classList.add('hidden');
  if (els.cookStage) els.cookStage.hidden = true;
  els.deskShell?.classList.add('hidden');
  els.appShell.dataset.mode = 'boot';
  els.appShell.dataset.surface = 'boot';
  document.title = 'MindCraft · Starting';
  document.body.classList.add('is-hub-chrome');

  ensureBootHub();
  await bootHub?.runAfterAuth({
    name: 'Akshat Koirala',
    email: 'akoirala@macalester.edu',
  });
  els.appShell.dataset.mode = 'hub';
  els.appShell.dataset.surface = 'hub';
  document.title = 'MindCraft · Dashboard';
}

function prepareDeskShell() {
  ensureDeskSurfaces();
  if (!deskPan) {
    deskPan = createDeskPan({
      viewport: els.deskViewport,
      plane: els.deskPlane,
      onPan: () => {
        owlLinks?.redraw?.();
        owlLinks?.placePrompt?.();
      },
    });
  }
  if (!zoomPack && els.deskViewport && els.deskPlane) {
    zoomPack = createZoomPack({
      viewport: els.deskViewport,
      plane: els.deskPlane,
      onSpaceZoom: (factor, clientX, clientY) => {
        deskPan?.zoomSpaceAt?.(factor, clientX, clientY);
      },
    });
    window.__deskZoom = zoomPack;
  }
  els.deskShell?.classList.remove('hidden');
  els.deskShell?.classList.add('has-wallpaper');
}

function setDeskHomeVisible(show) {
  const plane = els.deskPlane;
  if (!plane) return;
  plane.querySelectorAll(
    '[data-sheet="tonight"], [data-sheet="intel"], [data-sheet="binder"], [data-sheet="actbook"], [data-sheet="notes"], [data-sheet="inbox"], .owl-logo',
  ).forEach((el) => {
    el.hidden = !show;
  });
  plane.querySelectorAll('[data-sheet="act-instance"]').forEach((el) => {
    el.hidden = show;
  });
}

/** Open instance · desk connectors OR ACT panel in pannable space */
function openInstance(inst) {
  instanceOpen = true;
  activeInstance = inst || { id: 'desk_main', name: 'field-desk', kind: 'desk' };
  bootHub?.hideAll();
  bookStudio?.hide();
  document.body.classList.remove('is-hub-chrome');
  els.cookStage?.classList.add('hidden');
  if (els.cookStage) els.cookStage.hidden = true;

  prepareDeskShell();
  // Shared left rail stays mounted for every instance
  els.deskShell?.classList.remove('is-act-locked');
  paintRailInstance(activeInstance);
  els.appShell.dataset.mode = 'desk';
  els.appShell.dataset.surface = 'desk';
  document.title = `MindCraft · ${inst?.name || 'Desk'}`;

  if (inst?.kind === 'act') {
    setDeskHomeVisible(false);
    // Cooked books keep custom HTML · catalog ACT opens diagnosis
    const customSrc = bookSrcFor(inst);
    actBook?.open(customSrc || undefined);
    showToast(customSrc ? 'ACT Field Book · custom book' : 'ACT Field Book · diagnosis');
    return;
  }

  // Field Desk · connectors + intel dash · 3× pannable / zoomable space
  actBook?.closePlane?.();
  setDeskHomeVisible(true);
  deskPan?.fitHome?.();
  showToast('Field Desk · pan & pinch-zoom the space');
  requestAnimationFrame(async () => {
    await seedHomeDesk();
    fieldBook?.syncNav();
    layoutDeskHome(fieldBook?.getNote());
  });
}

function signOutToGate() {
  instanceOpen = false;
  activeInstance = null;
  paintRailInstance(null);
  entered = false;
  try {
    sessionStorage.removeItem('deskOs.entered');
  } catch { /* ignore */ }
  bootHub?.hideAll();
  bookStudio?.hide();
  els.deskShell?.classList.add('hidden');
  els.deskShell?.classList.remove('has-wallpaper', 'is-act-locked');
  els.cookStage?.classList.add('hidden');
  if (els.cookStage) els.cookStage.hidden = true;
  els.gate?.classList.remove('hidden');
  document.body.classList.remove('is-hub-chrome');
  els.appShell.dataset.mode = 'gate';
  els.appShell.dataset.surface = 'gate';
  document.title = 'MindCraft · The World of Wonders';
}

/** MindCraft home · Dashboard from desk, studio, or ACT */
function goHome() {
  instanceOpen = false;
  activeInstance = null;
  paintRailInstance(null);
  actBook?.closePlane?.();
  bookStudio?.hide();
  els.deskShell?.classList.add('hidden');
  els.deskShell?.classList.remove('has-wallpaper', 'is-act-locked', 'is-act-bleed');
  els.cookStage?.classList.add('hidden');
  if (els.cookStage) els.cookStage.hidden = true;
  document.body.classList.add('is-hub-chrome');
  ensureBootHub();
  bootHub?.showHub();
  els.appShell.dataset.mode = 'hub';
  els.appShell.dataset.surface = 'hub';
  document.title = 'MindCraft · Dashboard';
}

function enterDesk(method) {
  // Legacy entry points (record etc.) open instance directly if already past hub
  if (!instanceOpen) {
    void enterFromAuth(method);
    return;
  }
  openInstance({ id: 'desk_main', name: 'field-desk' });
}

function spawnSummarySheet(bullets) {
  if (!els.deskPlane) return;
  ensureDeskSurfaces();
  const notes = spawnDashNotes({
    plane: els.deskPlane,
    attachSheet: (el) => paperDesk?.attach(el),
    title: 'from class',
    lines: bullets,
  });
  if (notes) owlLinks?.linkSheet(notes);
}

function handleBoop(kind, ctx) {
  if (kind === 'summary') {
    const bullets = boopSummaryLines(ctx.lines);
    spawnSummarySheet(bullets);
    showToast('Summary page opened');
    return;
  }
  if (kind === 'dues') {
    const due = boopExtractDue(ctx.text);
    showToast(due || 'No due date heard yet');
    return;
  }
  if (kind === 'mission') {
    showToast('Mission join lands in L1 · concept path');
  }
}

const recorder = createRecorder({
  onPartial: (text) => {
    if (els.liveText) els.liveText.textContent = text || 'Listening…';
    transcript?.setInterim(text || '');
  },
  onLine: (line) => {
    transcript?.pushFinal(line);
  },
  onFinal: async (text) => {
    await finishTranscript(text);
  },
  onError: (msg) => {
    if (msg === 'not-allowed') showToast('Mic blocked. Using demo lecture.');
    else showToast(`Mic issue: ${msg}`);
  },
});

function uid(prefix = 'card') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function whenLabel(iso) {
  const d = daysUntil(iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d <= 7) return `In ${d}d`;
  return formatDisplayDate(iso);
}

function refreshDynamicLabels() {
  for (const card of cards) {
    if (card.date) {
      card.dateLabel = formatDisplayDate(card.date);
      if (card.type === 'due') card.whenLabel = whenLabel(card.date);
    }
  }
}

function priorityScore(card) {
  let score = 0;
  if (card.type === 'due') {
    const d = daysUntil(card.date);
    if (d <= 0) score += 100;
    else if (d === 1) score += 90;
    else if (d <= 3) score += 70;
    else if (d <= 7) score += 50;
    else score += 30;
  } else if (card.type === 'mail') score += 45;
  else if (card.type === 'draft') score += 35;
  else if (card.type === 'transcript') score += 25;
  else if (card.type === 'file') score += 15;
  return score;
}

function buildPriorityQueue(visible) {
  return [...visible]
    .filter((c) => c.type !== 'processing')
    .sort((a, b) => {
      const ds = priorityScore(b) - priorityScore(a);
      if (ds) return ds;
      return String(a.date || '').localeCompare(String(b.date || ''));
    })
    .slice(0, 4);
}

function updateBriefing() {
  const visible = cards.filter((c) => !c.semesterId || c.semesterId === activeSemesterId);
  const queue = buildPriorityQueue(visible);
  const top = queue[0];
  if (!els.cue || !els.cueText) return;
  if (!top) {
    els.cue.hidden = true;
    els.cue.dataset.focusCard = '';
    return;
  }
  const urgent = top.type === 'due' && daysUntil(top.date) <= 1;
  const line = top.type === 'due'
    ? `${top.title} · ${whenLabel(top.date)}`
    : top.title;
  els.cue.hidden = false;
  els.cue.classList.toggle('urgent', urgent);
  els.cue.dataset.focusCard = top.id;
  els.cueText.textContent = line;
}

function updateHud() {
  updateBriefing();
  if (entered) refreshHomeHub();
}

function updateRailHint() {
  if (els.railHint) els.railHint.textContent = '';
}

function ensureCanvasRoom() {
  const vp = {
    w: els.canvasScroll.clientWidth || 1200,
    h: els.canvasScroll.clientHeight || 800,
  };
  sizeCanvas(els.canvas, cards, vp);
}

function persistLayout() {
  try {
    localStorage.setItem(
      'deskOs.layout',
      JSON.stringify(cards.map((c) => ({ id: c.id, x: c.x, y: c.y }))),
    );
  } catch { /* ignore */ }
}

function loadLayoutMap() {
  try {
    const raw = JSON.parse(localStorage.getItem('deskOs.layout') || '[]');
    return Object.fromEntries(raw.map((r) => [r.id, r]));
  } catch {
    return {};
  }
}

function renderCanvas() {
  refreshDynamicLabels();
  const layout = loadLayoutMap();
  const visible = cards.filter((c) => !c.semesterId || c.semesterId === activeSemesterId);
  els.canvas.innerHTML = '';
  ensureCanvasRoom();

  if (!visible.length) {
    els.canvas.innerHTML = '';
    updateHud();
    updateRailHint();
    return;
  }

  for (const card of visible) {
    if (layout[card.id] && Number.isFinite(layout[card.id].x)) {
      card.x = layout[card.id].x;
      card.y = layout[card.id].y;
    }
    card.selected = card.id === selectedId;
    const el = createCardEl(card, {
      onSelect: (id) => selectCard(id),
      onMove: () => ensureCanvasRoom(),
      onDragEnd: () => {
        ensureCanvasRoom();
        persistLayout();
      },
    });
    els.canvas.appendChild(el);
  }
  ensureCanvasRoom();
  updateHud();
  updateRailHint();
}

function selectCard(id) {
  selectedId = id;
  renderCanvas();
  const card = cards.find((c) => c.id === id);
  if (!card) {
    els.inspector.classList.add('hidden');
    return;
  }
  openInspector(card);
}

function openInspector(card) {
  els.inspector.classList.remove('hidden');
  els.inspectorTitle.textContent = card.type;
  if (card.type === 'file' || card.type === 'transcript') {
    els.inspectorBody.innerHTML = `
      <div class="field"><label>Title</label><input id="insTitle" value="${escapeHtml(card.title)}" /></div>
      <div class="field"><label>Course</label>
        <select id="insCourse">${COURSES.map((c) => `<option value="${c.id}" ${c.id === card.courseId ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Unit</label><input id="insUnit" value="${escapeHtml(card.unit || '')}" /></div>
      <div class="field"><label>Date</label><input id="insDate" type="date" value="${escapeHtml(card.date || '')}" /></div>
      ${card.snippet ? `<p class="hint">${escapeHtml(card.snippet)}</p>` : ''}
      <div class="actions">
        <button class="btn lime" id="insSave" type="button">Save</button>
        <button class="btn ghost" id="insDelete" type="button">Remove</button>
      </div>
    `;
    document.getElementById('insSave').onclick = () => saveInspector(card.id);
    document.getElementById('insDelete').onclick = () => removeCard(card.id);
  } else if (card.type === 'due') {
    els.inspectorBody.innerHTML = `
      <p class="hint">${escapeHtml(card.title)}</p>
      <p class="hint">${escapeHtml(card.courseName)} · ${escapeHtml(card.dateLabel)} · ${escapeHtml(card.semesterLabel)}</p>
      <div class="actions"><button class="btn ghost" id="insDelete" type="button">Remove from Desk</button></div>
    `;
    document.getElementById('insDelete').onclick = () => removeCard(card.id);
  } else if (card.type === 'mail' || card.type === 'draft') {
    els.inspectorBody.innerHTML = `
      <p class="hint"><b>${escapeHtml(card.from || '')}</b></p>
      <p class="hint" style="white-space:pre-wrap;margin-top:10px;">${escapeHtml(card.body || card.snippet || '')}</p>
      <div class="actions">
        ${card.type === 'mail' ? '<button class="btn lime" id="insReply" type="button">Write reply</button>' : ''}
        <button class="btn ghost" id="insDelete" type="button">Remove</button>
      </div>
    `;
    const reply = document.getElementById('insReply');
    if (reply) reply.onclick = () => startReplyFromCard(card);
    document.getElementById('insDelete').onclick = () => removeCard(card.id);
  } else {
    els.inspectorBody.innerHTML = `<p class="hint">${escapeHtml(card.title)}</p>`;
  }
}

async function saveInspector(id) {
  const card = cards.find((c) => c.id === id);
  if (!card) return;
  const title = document.getElementById('insTitle').value.trim();
  const courseId = document.getElementById('insCourse').value;
  const unit = document.getElementById('insUnit').value.trim();
  const date = document.getElementById('insDate').value;
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];
  const sem = semesterFromDate(date);
  Object.assign(card, {
    title,
    courseId: course.id,
    courseName: course.name,
    unit,
    date,
    dateLabel: formatDisplayDate(date),
    semesterId: sem.id,
    semesterLabel: sem.label,
  });
  if (card.itemId) {
    const item = itemsCache.find((i) => i.id === card.itemId);
    if (item) {
      Object.assign(item, {
        title, courseId: course.id, courseName: course.name, unit, date,
        semesterId: sem.id, semesterLabel: sem.label, overridden: true,
      });
      await saveItem(item, null);
    }
  }
  activeSemesterId = sem.id;
  renderSemesterSelect();
  renderCanvas();
  showToast('Updated');
}

async function removeCard(id) {
  const card = cards.find((c) => c.id === id);
  cards = cards.filter((c) => c.id !== id);
  if (card?.itemId) {
    await deleteItem(card.itemId);
    itemsCache = await listItems();
  }
  if (card?.mailKey) {
    await deleteMail(card.mailKey);
    mailCache = await listMail();
  }
  selectedId = null;
  els.inspector.classList.add('hidden');
  persistLayout();
  renderCanvas();
}

function addCard(card) {
  const slot = nextSlot(cards);
  const next = { x: slot.x, y: slot.y, ...card };
  cards.push(next);
  persistLayout();
  renderCanvas();
  return next;
}

async function ingestFile(file) {
  if (!file) return;
  showDesk({ keepFloats: true });
  ensureDeskSurfaces();

  try {
    const textSnippet = await extractTextSnippet(file);
    const proposal = await classifyFile({
      originalName: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified,
      textSnippet,
    });

    const item = {
      id: uid('doc'),
      originalName: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      title: proposal.title,
      courseId: proposal.courseId,
      courseName: proposal.courseName,
      unit: proposal.unit,
      date: proposal.date,
      kind: proposal.kind,
      semesterId: proposal.semesterId,
      semesterLabel: proposal.semesterLabel,
      confidence: proposal.confidence,
      source: proposal.source,
      filedAt: new Date().toISOString(),
    };
    await saveItem(item, file);
    itemsCache = await listItems();

    activeSemesterId = item.semesterId;
    renderSemesterSelect();
    const card = addCard({
      id: uid('file'),
      type: 'file',
      badge: proposal.kind || 'file',
      itemId: item.id,
      title: item.title,
      courseId: item.courseId,
      courseName: item.courseName,
      unit: item.unit,
      date: item.date,
      dateLabel: formatDisplayDate(item.date),
      semesterId: item.semesterId,
      semesterLabel: item.semesterLabel,
      originalName: item.originalName,
    });

    const preview = uploadSurface?.open(file, {
      title: item.title,
      courseName: item.courseName,
      snippet: textSnippet?.slice(0, 120) || item.title,
    });
    if (preview) owlLinks?.linkSheet(preview);

    selectCard(card.id);
    showToast('Upload open · convert with owl when ready');
  } catch (err) {
    console.error(err);
    // Still show a preview so the student can see what they picked
    ensureDeskSurfaces();
    uploadSurface?.open(file, { title: file.name, courseName: 'Unsorted' });
    showToast('Opened upload · classify failed');
  }
}

function setRecordUi(on) {
  els.toolRecord?.setAttribute('aria-pressed', on ? 'true' : 'false');
  const label = els.toolRecord?.querySelector('[data-label]');
  if (label) label.textContent = on ? 'Stop' : 'Record';
  else if (els.toolRecord && !els.toolRecord.querySelector('.nav-ico')) {
    els.toolRecord.textContent = on ? 'Stop' : 'Record';
  }
  if (els.recordLabel) els.recordLabel.textContent = on ? 'Stop' : 'Record';
  // Legacy capsule stays hidden · ivory page is the surface
  if (els.liveBar) els.liveBar.classList.add('hidden');
}

async function finishTranscript(text) {
  if (finishingTranscript) return;
  const body = (text || transcript?.getText() || '').trim();
  recording = false;
  setRecordUi(false);
  const done = transcript?.complete(body);
  if (!body) {
    showToast('No speech captured');
    return;
  }
  finishingTranscript = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const proposal = await classifyFile({
      originalName: `class_recording_${today}.txt`,
      mime: 'text/plain',
      size: body.length,
      lastModified: Date.now(),
      textSnippet: body,
    });

    const file = new File([body], `class_${today}.txt`, { type: 'text/plain' });
    const item = {
      id: uid('doc'),
      originalName: file.name,
      mime: 'text/plain',
      size: body.length,
      title: proposal.title.includes('Untitled') ? 'Class transcript' : proposal.title,
      courseId: proposal.courseId,
      courseName: proposal.courseName,
      unit: proposal.unit,
      date: proposal.date || today,
      kind: 'notes',
      semesterId: proposal.semesterId || semesterFromDate(today).id,
      semesterLabel: proposal.semesterLabel || semesterFromDate(today).label,
      confidence: proposal.confidence,
      source: 'transcript',
      conceptId: null,
      filedAt: new Date().toISOString(),
    };
    await saveItem(item, file);
    itemsCache = await listItems();
    activeSemesterId = item.semesterId;
    renderSemesterSelect();

    // Quiet canvas card optional · page on desk is the primary artifact
    addCard({
      id: uid('tr'),
      type: 'transcript',
      badge: 'Transcript',
      itemId: item.id,
      title: item.title,
      courseId: item.courseId,
      courseName: item.courseName,
      unit: item.unit,
      date: item.date,
      dateLabel: formatDisplayDate(item.date),
      semesterId: item.semesterId,
      semesterLabel: item.semesterLabel,
      snippet: body.slice(0, 220),
      durationLabel: 'just recorded',
    });
    showToast(`Filed · ${item.courseName}. Boop when ready.`);
    done?.el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    showToast('Could not file transcript');
  } finally {
    finishingTranscript = false;
  }
}

function startRecordNow() {
  if (recording) {
    recording = false;
    recorder.stop();
    setRecordUi(false);
    return;
  }
  if (journalFocus?.isOpen?.()) journalFocus.exit();
  ensureDeskSurfaces();
  const page = transcript?.open();
  if (page) {
    page.classList.remove('page-away', 'is-min');
    page.hidden = false;
    // Instant on-canvas seat · no expandRoom lag
    page.style.left = '22%';
    page.style.top = '10%';
    page.style.width = '50%';
    page.style.height = '62%';
    page.style.transform = 'none';
    page.style.zIndex = '36';
    surfaces.flashFocus?.(page);
    deskPan?.focusEl?.(page, { soft: true });
  }
  recording = true;
  setRecordUi(true);
  if (els.liveText) els.liveText.textContent = 'Listening…';
  recorder.start({ preferDemo: true });
}

function toggleRecord() {
  // Never re-run the 3s boot when already on a desk instance
  if (!instanceOpen) {
    void enterFromAuth('record').then(() => {
      openInstance({ id: 'desk_main', name: 'field-desk', kind: 'desk' });
      startRecordNow();
    });
    return;
  }
  startRecordNow();
}

function syncDueCards() {
  cards = cards.filter((c) => c.type !== 'due');
  const layoutSeed = cards.length;
  eventsCache
    .filter((e) => e.semesterId === activeSemesterId)
    .filter((e) => daysUntil(e.date) >= -1)
    .forEach((e, i) => {
      const col = (layoutSeed + i) % 3;
      const row = Math.floor((layoutSeed + i) / 3);
      cards.push({
        id: `due_${e.id}`,
        type: 'due',
        badge: 'Due',
        title: e.title,
        courseId: e.courseId,
        courseName: e.courseName,
        date: e.date,
        dateLabel: formatDisplayDate(e.date),
        whenLabel: whenLabel(e.date),
        semesterId: e.semesterId,
        semesterLabel: e.semesterLabel,
        x: 40 + col * 300,
        y: 40 + row * 190,
      });
    });
}

function syncFileCardsFromDb() {
  const existingItemIds = new Set(cards.filter((c) => c.itemId).map((c) => c.itemId));
  for (const item of itemsCache) {
    if (existingItemIds.has(item.id)) continue;
    const sem = itemSemester(item);
    const slot = nextSlot(cards);
    cards.push({
      id: uid('file'),
      type: item.source === 'transcript' ? 'transcript' : 'file',
      badge: item.source === 'transcript' ? 'Transcript' : (item.kind || 'file'),
      itemId: item.id,
      title: item.title,
      courseId: item.courseId,
      courseName: item.courseName,
      unit: item.unit,
      date: item.date,
      dateLabel: formatDisplayDate(item.date),
      semesterId: sem.id,
      semesterLabel: sem.label,
      originalName: item.originalName,
      snippet: item.source === 'transcript' ? '' : '',
      x: slot.x,
      y: slot.y,
    });
  }
}

function syncMailCardsFromDb() {
  const existing = new Set(cards.filter((c) => c.mailKey).map((c) => c.mailKey));
  for (const m of mailCache) {
    if (existing.has(m.id)) continue;
    const slot = nextSlot(cards);
    if (m.kind === 'draft') {
      cards.push({
        id: uid('draft'),
        ...draftToCardFields(m, m.date),
        mailKey: m.id,
        x: slot.x,
        y: slot.y,
      });
    } else {
      cards.push({
        id: uid('mail'),
        ...mailToCardFields(m),
        mailKey: m.id,
        x: slot.x,
        y: slot.y,
      });
    }
  }
}

function setRailActive(mode) {
  document.querySelectorAll('.orb[data-mode], .tool[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

const surfaces = createSurfaces({
  appShell: els.appShell,
  brandLogo: els.brandLogo,
  showToast,
  plane: els.deskPlane,
  attachSheet: (el) => paperDesk?.attach(el),
  onOpenSheet: (el, name) => {
    if (journalFocus?.isOpen?.()) journalFocus.exit();
    // Stay on the one-page home grid · focus + highlight in place
    deskPan?.fitHome?.();
    requestAnimationFrame(() => deskPan?.focusEl(el, { soft: true }));
    if (name) setSurfacePressed(name === 'google' ? 'google' : name);
  },
  onDropFile: (f) => {
    ingestFile(f);
  },
  onTagScanFile: ({ name, file, tag, demo }) => {
    ensureDeskSurfaces();
    if (file) void ingestFile(file);
    if (tag === 'memo') {
      stickies?.add?.(String(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
    if (tag === 'intel') {
      try {
        const key = 'deskOs.intelLines';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        const next = Array.isArray(prev) ? prev : [];
        next.unshift({ id: `scan_${Date.now()}`, source: 'scan', text: name });
        localStorage.setItem(key, JSON.stringify(next.slice(0, 12)));
      } catch { /* ignore */ }
      homeHub?.refresh?.();
    }
    showToast(
      demo
        ? `Tagged “${name}” → ${tag}`
        : `Added “${name}” → ${tag}`,
    );
    if (tag === 'repository' || tag === 'act-fieldbook') {
      homeHub?.refresh?.();
    }
  },
  getEvents: () => eventsCache,
  daysUntil,
  formatDisplayDate,
});

const stickies = createStickies({
  linesEl: document.getElementById('noteLines'),
  inputEl: document.getElementById('noteInput'),
});

function showDesk({ keepFloats = false } = {}) {
  activeMode = 'desk';
  els.appShell.dataset.mode = 'desk';
  els.appShell.dataset.surface = 'desk';
  if (!keepFloats) surfaces.closeToDesk();
  else surfaces.setBrand?.('mindcraft');
  els.stage?.classList.remove('hidden');
  if (els.toolView) {
    els.toolView.classList.add('hidden');
    els.toolView.hidden = true;
  }
  setRailActive('desk');
  updateRailHint();
  updateHud();
  requestAnimationFrame(() => {
    ensureCanvasRoom();
    const visible = cards.filter((c) => !c.semesterId || c.semesterId === activeSemesterId);
    if (!visible.length) {
      els.canvasScroll?.scrollTo({ left: 0, top: 0 });
      return;
    }
    const minX = Math.min(...visible.map((c) => Number(c.x) || 0));
    const minY = Math.min(...visible.map((c) => Number(c.y) || 0));
    els.canvasScroll?.scrollTo({
      left: Math.max(0, minX - 48),
      top: Math.max(0, minY - 48),
    });
  });
}

function openTool(mode) {
  if (mode === 'drop' || mode === 'spotify') {
    if (mode === 'drop') els.fileInput?.click();
    return;
  }
  if (mode === 'mail' || mode === 'calendar' || mode === 'google') {
    // Already on desk · jump back to that page and highlight
    if (focusToolSheet(mode)) {
      if (mode === 'mail') {
        renderMailList();
        setMailTab('inbox');
      }
      if (mode === 'calendar') surfaces.renderCalendar();
      updateRailHint();
      return;
    }
    activeMode = mode;
    if (mode === 'calendar') {
      surfaces.seat?.('calendar', HOME_ART.calendar, { force: true });
      focusToolSheet('calendar');
    } else {
      surfaces.open(mode);
    }
    setSurfacePressed(mode);
    els.inspector.classList.add('hidden');
    selectedId = null;
    if (mode === 'mail') {
      renderMailList();
      setMailTab('inbox');
    }
    if (mode === 'calendar') surfaces.renderCalendar();
    updateRailHint();
    return;
  }

  const meta = TOOL_META[mode];
  if (!meta) return;
  activeMode = mode;
  els.appShell.dataset.mode = mode;
  els.appShell.dataset.surface = 'desk';
  els.stage?.classList.remove('hidden');
  setRailActive(mode);
  els.inspector.classList.add('hidden');
  selectedId = null;
  if (mode === 'binder') renderBinderHive(els.binderSearch?.value || '');
  if (mode === 'cleanup') runCleanupUi();
  if (mode === 'graph') renderGraph();
  updateRailHint();
}

function openTutorMap(opts = {}) {
  // Stay on dashboard · scroll/focus the in-page map (not a new tab)
  goHome?.();
  window.setTimeout(() => tutorMap?.open(opts), 40);
}

function routeHelp(q) {
  const s = String(q || '').toLowerCase().trim();
  if (!s) return;
  if (/tutor|nearby|map/.test(s)) openTutorMap({ query: s.replace(/tutor|nearby|map|find|a|the/gi, ' ').trim() });
  else if (/workflow|market|trade|buy/.test(s)) {
    goHome?.();
    window.setTimeout(() => {
      document.getElementById('workflowMarket')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }
  else if (/mail|email|inbox|reply|gmail/.test(s)) openTool('mail');
  else if (/cal|due|schedule|ics/.test(s)) openTool('calendar');
  else if (/google|search|scan/.test(s)) openTool('google');
  else if (/repo|repository|file|filed|archive/.test(s)) {
    els.toolFieldBook?.click();
  } else if (/act|fieldbook|field book|practice/.test(s)) {
    openActPractice();
  } else if (/note|sticky|jot|memo/.test(s)) {
    showDesk();
    els.noteInput?.focus();
  } else if (/bind/.test(s)) openTool('binder');
  else if (/organ|clean|tidy/.test(s)) openTool('cleanup');
  else if (/course|graph/.test(s)) openTool('graph');
  else if (/record|lecture|class|transcri/.test(s)) {
    showDesk();
    els.toolRecord?.click();
  } else if (/drop|upload|pdf|photo/.test(s)) {
    els.fileInput?.click();
  } else {
    showToast(`Heard you · “${s.slice(0, 48)}” (wiring soon)`);
  }
}

function toggleTool(mode) {
  // Second click still focuses the page (does not bury it)
  openTool(mode);
}

function setMailTab(whichtab) {
  document.querySelectorAll('.mail-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.mailTab === whichtab);
  });
  els.mailInboxPane.classList.toggle('hidden', whichtab !== 'inbox');
  els.mailComposePane.classList.toggle('hidden', whichtab !== 'compose');
}

function updateMailPriority(inbox) {
  if (!els.mailPrioritySummary) return;
  if (!inbox.length) {
    els.mailPrioritySummary.textContent = 'Nothing waiting.';
    return;
  }
  const ranked = [...inbox].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const dueish = ranked.find((m) => /due|quiz|friday|monday/i.test(`${m.subject} ${m.preview || ''}`)) || ranked[0];
  els.mailPrioritySummary.textContent = dueish.subject;
}

function renderMailList() {
  const inbox = mailCache.filter((m) => m.kind !== 'draft');
  updateMailPriority(inbox);
  if (!inbox.length) {
    els.mailList.innerHTML = `<li style="cursor:default"><div class="subj">Empty</div></li>`;
    return;
  }
  els.mailList.innerHTML = inbox.map((m) => {
    const who = String(m.from || '').replace(/<[^>]+>/g, '').trim();
    return `
    <li data-mail-id="${escapeHtml(m.id)}">
      <div class="from">${escapeHtml(who)}</div>
      <div class="subj">${escapeHtml(m.subject)}</div>
      <div class="prev">${escapeHtml(m.preview || '')}</div>
      <div class="mail-actions">
        <button class="btn lime" type="button" data-pin="${escapeHtml(m.id)}">To Desk</button>
        <button class="btn ghost" type="button" data-reply="${escapeHtml(m.id)}">Reply</button>
      </div>
    </li>`;
  }).join('');
}

async function loadSampleInbox() {
  const entries = buildSampleInbox().map((m) => ({ ...m, kind: 'inbox' }));
  await saveMailMany(entries);
  mailCache = await listMail();
  renderMailList();
  showToast('School inbox loaded');
}

async function pinMailToCanvas(mailId) {
  const mail = mailCache.find((m) => m.id === mailId) || buildSampleInbox().find((m) => m.id === mailId);
  if (!mail) return;
  const entry = { ...mail, kind: 'inbox' };
  await saveMail(entry);
  mailCache = await listMail();
  if (cards.some((c) => c.mailKey === entry.id)) {
    showToast('Already on Desk');
    const existing = cards.find((c) => c.mailKey === entry.id);
    if (existing) {
      activeSemesterId = existing.semesterId;
      renderSemesterSelect();
      showDesk();
      selectCard(existing.id);
    }
    return;
  }
  const fields = mailToCardFields(entry);
  activeSemesterId = fields.semesterId;
  renderSemesterSelect();
  const card = addCard({ id: uid('mail'), ...fields, mailKey: entry.id });
  showDesk();
  selectCard(card.id);
  showToast('Added to Desk');
}

function fillDraftForm(draft) {
  els.draftTo.value = draft.to || '';
  els.draftSubject.value = draft.subject || '';
  els.draftBody.value = draft.body || '';
  els.draftCourse.value = draft.courseId || 'unsorted';
  setMailTab('compose');
}

function startReplyFromCard(card) {
  const mail = mailCache.find((m) => m.id === card.mailKey) || buildSampleInbox().find((m) => m.id === card.mailKey);
  if (!mail) return;
  openTool('mail');
  fillDraftForm(draftReplyFor(mail));
}

async function saveDraftToCanvas() {
  const draft = {
    id: uid('draft'),
    kind: 'draft',
    to: els.draftTo.value.trim(),
    subject: els.draftSubject.value.trim() || 'Untitled draft',
    body: els.draftBody.value.trim(),
    courseId: els.draftCourse.value,
    courseName: (COURSES.find((c) => c.id === els.draftCourse.value) || COURSES[0]).name,
    date: new Date().toISOString().slice(0, 10),
    from: els.draftTo.value.trim(),
    preview: els.draftBody.value.trim().slice(0, 120),
  };
  if (!draft.to || !draft.body) {
    showToast('Add a to + body');
    return;
  }
  await saveMail(draft);
  mailCache = await listMail();
  const fields = draftToCardFields(draft, draft.date);
  activeSemesterId = fields.semesterId;
  renderSemesterSelect();
  const card = addCard({ id: uid('draft'), ...fields, mailKey: draft.id });
  showDesk();
  selectCard(card.id);
  showToast('Draft saved to Desk');
}

function knownSemesters() {
  const map = new Map();
  const cur = currentSemester();
  map.set(cur.id, cur.label);
  for (const item of itemsCache) {
    const s = itemSemester(item);
    map.set(s.id, s.label);
  }
  for (const ev of eventsCache) map.set(ev.semesterId, ev.semesterLabel);
  for (const m of mailCache) {
    const s = semesterFromDate(m.date);
    map.set(s.id, s.label);
  }
  for (const c of cards) if (c.semesterId) map.set(c.semesterId, c.semesterLabel);
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => compareSemesterIds(a.id, b.id));
}

function renderSemesterSelect() {
  const semis = knownSemesters();
  if (!semis.some((s) => s.id === activeSemesterId)) {
    activeSemesterId = semis[0]?.id || currentSemester().id;
  }
  els.semesterSelect.innerHTML = semis.map((s) => (
    `<option value="${s.id}" ${s.id === activeSemesterId ? 'selected' : ''}>${s.label}</option>`
  )).join('');
}

async function ingestIcs(text) {
  const parsed = parseIcs(text);
  if (!parsed.length) {
    showToast('No events found');
    return;
  }
  await saveEvents(parsed);
  eventsCache = await listEvents();
  const soon = eventsCache.find((e) => daysUntil(e.date) >= 0) || eventsCache[0];
  if (soon) activeSemesterId = soon.semesterId;
  renderSemesterSelect();
  syncDueCards();
  renderCanvas();
  if (els.appShell?.dataset.surface === 'calendar') surfaces.renderCalendar();
  else showDesk();
  showToast(`${parsed.length} due dates on Desk`);
}

async function runUnitCase() {
  showToast('Demo: mail, calendar, a file, then class recording');
  showDesk();
  await loadSampleInbox();
  await pinMailToCanvas('mail_chem_lab');
  await sleep(350);
  openTool('mail');
  const reply = draftReplyFor(buildSampleInbox()[0]);
  fillDraftForm(reply);
  await saveDraftToCanvas();
  await sleep(400);
  await clearEvents();
  eventsCache = [];
  cards = cards.filter((c) => c.type !== 'due');
  const ics = buildLiveWeekIcs();
  els.icsInput.value = ics;
  await ingestIcs(ics);
  await sleep(400);
  const pdfRes = await fetch('samples/chem_packet.pdf');
  const pdf = new File([await pdfRes.blob()], 'chem_packet.pdf', { type: 'application/pdf' });
  await ingestFile(pdf);
  await sleep(500);
  showDesk();
  recording = true;
  setRecordUi(true);
  recorder.start({ preferDemo: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function typeLabel(card) {
  const raw = String(card.badge || card.type || '');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function focusCardOnDesk(id) {
  showDesk();
  selectCard(id);
  requestAnimationFrame(() => {
    const el = els.canvas.querySelector(`[data-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });
}

function renderBinderHive(query = '') {
  const q = query.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (c.semesterId && c.semesterId !== activeSemesterId) return false;
    if (c.type === 'processing') return false;
    if (!q) return true;
    const hay = `${c.title} ${c.courseName || ''} ${c.unit || ''} ${c.originalName || ''}`.toLowerCase();
    return hay.includes(q);
  });
  if (!visible.length) {
    els.binderHiveList.innerHTML = `<p class="lead">Nothing filed this term yet. Drop a PDF or record class from the Desk.</p>`;
    return;
  }
  const byCourse = new Map();
  for (const c of visible) {
    const key = c.courseName || 'Unsorted';
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(c);
  }
  els.binderHiveList.innerHTML = [...byCourse.entries()].map(([course, list]) => `
    <div class="binder-course">
      <h3>${escapeHtml(course)}</h3>
      <ul>
        ${list.map((c) => `
          <li data-focus-card="${escapeHtml(c.id)}">
            <b>${escapeHtml(c.title)}</b>
            <span>${escapeHtml(typeLabel(c))} · ${escapeHtml(c.unit || c.dateLabel || '')}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

function runCleanupUi() {
  cleanupScan = runCleanupScan(cards, activeSemesterId);
  if (!cleanupScan.total) {
    els.cleanupList.innerHTML = `<p class="lead">Your Desk is empty for this term. Drop a file or add mail first.</p>`;
    return;
  }
  els.cleanupList.innerHTML = cleanupScan.items.map((item) => `
    <label class="cleanup-item ${item.keepDefault ? '' : 'low'}">
      <input type="checkbox" data-cleanup-id="${escapeHtml(item.id)}" ${item.keepDefault ? 'checked' : ''} />
      <div>
        <div class="title">${escapeHtml(item.title)}<span class="score">${Math.round(item.relevance * 100)}%</span></div>
        <div class="meta">${escapeHtml(item.courseName || 'Unsorted')} · ${escapeHtml(item.type)}${item.reasons?.length ? ` · ${escapeHtml(item.reasons.join(', '))}` : ''}</div>
        <div class="summary">${escapeHtml(item.summary)}</div>
      </div>
    </label>
  `).join('');
}

async function applyCleanup() {
  const checks = [...els.cleanupList.querySelectorAll('input[data-cleanup-id]')];
  if (!checks.length) {
    showToast('Nothing to organize');
    return;
  }
  const keep = new Set(checks.filter((el) => el.checked).map((el) => el.dataset.cleanupId));
  const remove = cards.filter((c) => (!c.semesterId || c.semesterId === activeSemesterId) && !keep.has(c.id) && c.type !== 'processing');
  for (const card of remove) {
    if (card.itemId) await deleteItem(card.itemId);
    if (card.mailKey) await deleteMail(card.mailKey);
  }
  cards = cards.filter((c) => keep.has(c.id) || (c.semesterId && c.semesterId !== activeSemesterId) || c.type === 'processing');
  itemsCache = await listItems();
  mailCache = await listMail();
  const kept = cards.filter((c) => !c.semesterId || c.semesterId === activeSemesterId);
  layoutByCourse(kept, COURSES.map((c) => c.id));
  persistLayout();
  selectedId = null;
  els.inspector.classList.add('hidden');
  renderCanvas();
  showDesk();
  showToast(`Kept ${keep.size} · organized by course`);
}

function renderGraph() {
  const visible = cards.filter((c) => (!c.semesterId || c.semesterId === activeSemesterId) && c.type !== 'processing');
  if (!visible.length) {
    els.graphView.innerHTML = `<p class="lead">No course items yet. Add mail, drop files, or load due dates.</p>`;
    return;
  }
  const byCourse = new Map();
  for (const c of visible) {
    const key = c.courseId || 'unsorted';
    const label = c.courseName || 'Unsorted';
    if (!byCourse.has(key)) byCourse.set(key, { label, items: [] });
    byCourse.get(key).items.push(c);
  }
  els.graphView.innerHTML = [...byCourse.values()].map((node) => `
    <div class="graph-node">
      <h4>${escapeHtml(node.label)}</h4>
      <ul>
        ${node.items.map((c) => `
          <li data-focus-card="${escapeHtml(c.id)}">${escapeHtml(typeLabel(c))} · ${escapeHtml(c.title)}</li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

function wire() {
  els.draftCourse.innerHTML = COURSES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');

  surfaces.wire();
  createGate({
    gate: els.gate,
    page: els.journalPage,
    authBlock: els.authBlock,
    hint: els.gateHint,
    onEnter: (method) => { void enterFromAuth(method); },
  });
  ensureBootHub();
  hubCall = createHubCall({
    hub: els.hubStage,
    getFocusInstance: () => {
      const list = (() => {
        try {
          const raw = JSON.parse(localStorage.getItem('deskOs.instances') || '[]');
          return Array.isArray(raw) ? raw : [];
        } catch { return []; }
      })();
      const focus = localStorage.getItem('deskOs.goalFocus') || list[0]?.id;
      return list.find((x) => x.id === focus) || list[0] || null;
    },
    onComplete: () => {
      bootHub?.renderHub?.();
    },
    onToast: (msg) => showToast(msg),
  });
  els.toolDesk?.addEventListener('click', showDesk);
  els.brandHome?.addEventListener('click', () => goHome());
  els.hubHome?.addEventListener('click', () => goHome());
  els.toolDrop?.addEventListener('click', () => els.fileInput?.click());
  els.toolGoogle?.addEventListener('click', () => openTool('google'));

  tutorMap = createTutorMap({
    root: els.hubTutorMap,
    onToast: (msg) => showToast(msg),
  });
  workflowMarket = createWorkflowMarket({
    root: els.workflowMarket,
    onToast: (msg) => showToast(msg),
  });

  const addBtn = document.getElementById('toolAdd');
  addBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    ensureDeskSurfaces();
    const tray = widgets?.openAddTray();
    const open = Boolean(tray && !tray.hidden);
    addBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    addBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const deskAsk = document.getElementById('deskAsk');
  const deskAskInput = document.getElementById('deskAskInput');
  deskAsk?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = deskAskInput?.value?.trim() || '';
    if (!q) return;
    routeHelp(q);
    if (deskAskInput) deskAskInput.value = '';
  });
  document.getElementById('deskAskPlus')?.addEventListener('click', () => {
    addBtn?.click();
  });
  document.getElementById('deskAskMic')?.addEventListener('click', () => {
    showToast('Voice ask · coming soon');
  });
  document.getElementById('deskAskMode')?.addEventListener('click', () => {
    showToast('Focus · High');
  });

  // Owl Ask bar · same routing as bottom Ask
  document.getElementById('owlPromptForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('owlPromptInput'));
    const q = input?.value?.trim() || '';
    if (!q) return;
    routeHelp(q);
    if (input) input.value = '';
    owlLinks?.closePrompt?.();
  });

  els.liveMini?.addEventListener('click', () => {
    if (!els.liveBar || els.liveBar.classList.contains('hidden')) return;
    const squeezed = els.liveBar.dataset.squeezed === 'true';
    els.liveBar.dataset.squeezed = squeezed ? 'false' : 'true';
  });
  els.mascot?.addEventListener('click', showDesk);
  els.toolFieldBook?.addEventListener('click', () => {
    // Shared rail · binder works from any instance
    ensureDeskSurfaces();
    if (journalFocus?.isOpen?.()) journalFocus.exit();
    actBook?.closePlane?.();
    els.deskShell?.classList.remove('is-act-locked', 'is-act-bleed');
    homeHub?.ensure();
    const binder = els.deskPlane?.querySelector('[data-sheet="binder"]');
    if (binder) binder.hidden = false;
    homeHub?.focus('binder');
    showToast(activeInstance?.name
      ? `Repository · ${activeInstance.name}`
      : 'Repository');
  });
  els.fileInput.addEventListener('change', () => {
    const f = els.fileInput.files?.[0];
    if (f) ingestFile(f);
    els.fileInput.value = '';
  });

  const stage = els.canvasScroll;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) => {
    stage.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); });
  });
  stage.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) ingestFile(f);
  });

  els.toolRecord?.addEventListener('click', () => {
    toggleRecord();
  });
  els.toolMail?.addEventListener('click', () => toggleTool('mail'));
  els.toolCalendar?.addEventListener('click', () => toggleTool('calendar'));
  els.toolBinder?.addEventListener('click', () => toggleTool('binder'));
  els.toolCleanup?.addEventListener('click', () => toggleTool('cleanup'));
  els.toolGraph?.addEventListener('click', () => toggleTool('graph'));
  els.toolDone?.addEventListener('click', showDesk);

  els.binderSearch?.addEventListener('input', () => renderBinderHive(els.binderSearch.value));
  els.binderHiveList?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-focus-card]');
    if (row) focusCardOnDesk(row.dataset.focusCard);
  });
  els.graphView?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-focus-card]');
    if (row) focusCardOnDesk(row.dataset.focusCard);
  });
  els.cue?.addEventListener('click', () => {
    const id = els.cue.dataset.focusCard;
    if (id) focusCardOnDesk(id);
  });

  els.cleanupApply?.addEventListener('click', () => applyCleanup());
  els.cleanupRescan?.addEventListener('click', () => {
    runCleanupUi();
    showToast('Scanned again');
  });

  els.inspectorClose.addEventListener('click', () => {
    els.inspector.classList.add('hidden');
    selectedId = null;
    renderCanvas();
  });
  els.icsLoadBtn.addEventListener('click', () => ingestIcs(els.icsInput.value));
  els.icsSampleBtn?.addEventListener('click', async () => {
    await clearEvents();
    eventsCache = [];
    cards = cards.filter((c) => c.type !== 'due');
    const text = buildLiveWeekIcs();
    if (els.icsInput) els.icsInput.value = text;
    await ingestIcs(text);
    surfaces.renderCalendar();
  });
  els.icsClearBtn?.addEventListener('click', async () => {
    await clearEvents();
    eventsCache = [];
    cards = cards.filter((c) => c.type !== 'due');
    renderSemesterSelect();
    renderCanvas();
    surfaces.renderCalendar();
    showToast('Due dates cleared');
  });

  document.querySelectorAll('.mail-tab').forEach((tab) => {
    tab.addEventListener('click', () => setMailTab(tab.dataset.mailTab));
  });
  els.mailLoadSample.addEventListener('click', loadSampleInbox);
  els.mailList.addEventListener('click', async (e) => {
    const pin = e.target.closest('[data-pin]');
    const reply = e.target.closest('[data-reply]');
    if (pin) {
      e.stopPropagation();
      await pinMailToCanvas(pin.dataset.pin);
      return;
    }
    if (reply) {
      e.stopPropagation();
      const mail = mailCache.find((m) => m.id === reply.dataset.reply) || buildSampleInbox().find((m) => m.id === reply.dataset.reply);
      if (mail) fillDraftForm(draftReplyFor(mail));
    }
  });
  els.draftSaveBtn.addEventListener('click', saveDraftToCanvas);
  els.draftClearBtn.addEventListener('click', () => {
    els.draftTo.value = '';
    els.draftSubject.value = '';
    els.draftBody.value = '';
  });

  els.semesterSelect.addEventListener('change', () => {
    activeSemesterId = els.semesterSelect.value;
    syncDueCards();
    renderCanvas();
    els.inspector.classList.add('hidden');
    if (activeMode === 'binder') renderBinderHive(els.binderSearch.value);
    if (activeMode === 'cleanup') runCleanupUi();
    if (activeMode === 'graph') renderGraph();
  });
  els.unitCaseBtn.addEventListener('click', runUnitCase);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!instanceOpen) {
      if (activeMode === 'desk') {
        ensureCanvasRoom();
        updateHud();
      }
      return;
    }
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      // Re-fit the 100% plane, reseat home sheets, keep links straight
      deskPan?.fitHome?.();
      deskPan?.relayout?.();
      homeHub?.composeArt({ reseat: true });
      surfaces.seat?.('calendar', HOME_ART.calendar, { force: true });
      seatOwl();
      owlLinks?.redraw();
      ensureCanvasRoom();
      updateHud();
    }, 80);
  });
  setInterval(() => {
    if (activeMode !== 'desk') return;
    refreshDynamicLabels();
    updateHud();
    updateRailHint();
    document.querySelectorAll('.canvas-card.type-due').forEach((el) => {
      const card = cards.find((c) => c.id === el.dataset.id);
      if (!card) return;
      const when = el.querySelector('.whisper.when, .when');
      if (when) when.textContent = card.whenLabel || card.dateLabel || '';
    });
  }, 30000);

  if (els.railHint) els.railHint.textContent = '';
}

async function boot() {
  wire();
  itemsCache = await listItems();
  eventsCache = await listEvents();
  mailCache = await listMail();
  cards = [];
  const cur = currentSemester().id;
  activeSemesterId = cur;
  renderSemesterSelect();
  renderMailList();
  renderCanvas();

  // Always land on the journal entry; skip orb soup
  els.gate?.classList.remove('hidden');
  els.deskShell?.classList.add('hidden');
  els.appShell.dataset.mode = 'gate';

}

boot();
