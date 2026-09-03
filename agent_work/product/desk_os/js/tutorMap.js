/**
 * In-dash Tutors and Events map (Leaflet + CARTO tiles, same look as before).
 *
 * 2026-08-31 rebuild: the old version was a static prototype, a hardcoded
 * TUTORS array with fake filter chips (All / Nearby / Math / ACT / College).
 * Now it is two real tabs backed by the real backend via fire.js:
 *
 *   Tutors · the same users-where-role==tutor query FindTutor.tsx ships,
 *     plotting each tutor's real location/locationAddress (with the same
 *     studio-default fallback FindTutor uses when a tutor has not pinned
 *     themselves yet). The old hardcoded array survives only as DEMO_TUTORS,
 *     shown when nobody is signed in (the /try/desk marketing demo) or the
 *     SDK cannot load.
 *
 *   Events · live onSnapshot on the tutorEvents collection: location-pinned,
 *     time-bound happenings (office hours, a study meetup) that update on
 *     every signed-in user's map the moment one is posted. Until the
 *     tutorEvents rules block is deployed, the listener fails closed and the
 *     tab says so honestly instead of pretending to be empty.
 *
 * Any signed-in user (not just tutors, generalized 2026-09-02, see
 * firestore.rules' tutorEvents block) gets a "+ Add event" button on the
 * Events tab. Clicking it arms pin-placement on the real map to the left
 * (the next click there drops/moves a marker) and reveals a small inline
 * form (title, date, start/end, notes) right here; posting writes straight
 * to tutorEvents with hostId/hostName, the same doc shape and collection
 * TutorEventsPanel.tsx's own create flow uses, so an event shows up
 * identically regardless of which surface made it.
 */

import { ensureFire } from './fire.js';

/** Demo-only data for the unauthenticated marketing demo. Never shown to a
 *  real signed-in student. */
const DEMO_TUTORS = [
  {
    id: 'akshat',
    name: 'Akshat Koirala',
    initials: 'AK',
    color: '#2f4a38',
    bio: 'ACT, algebra, precalc, calculus. Clear first steps when the graph feels foggy.',
    region: 'Macalester · St Paul, MN',
    lat: 44.9379,
    lng: -93.1706,
    demo: true,
  },
  {
    id: 'blake',
    name: 'Blake Kell',
    initials: 'BK',
    color: '#c47a28',
    bio: 'Macalester builder. Calm focus for students who need less noise.',
    region: 'Myrtle Beach, SC',
    lat: 33.6891,
    lng: -78.8867,
    demo: true,
  },
  {
    id: 'abhigya',
    name: 'Abhigya Koirala',
    initials: 'AK',
    color: '#5a4a8c',
    bio: 'Incoming applied math PhD · UNC. Hard ideas, no watering down.',
    region: 'UNC Chapel Hill, NC',
    lat: 35.9049,
    lng: -79.0469,
    demo: true,
  },
];

/** Same default FindTutor.tsx uses for tutors with no pinned location yet. */
const STUDIO_LOCATION = { lat: 44.9379, lng: -93.1706 };
const DEFAULT_BIO = 'Patient ACT, algebra, precalc, calculus, and stats help for students who need the first step to finally make sense.';

const PIN_COLORS = ['#2f4a38', '#c47a28', '#5a4a8c', '#8a5a3a', '#3d6b4f', '#7a3a52'];
const EVENT_COLOR = '#8a5a3a';

const PRESETS = {
  'st paul': [44.9537, -93.09],
  'saint paul': [44.9537, -93.09],
  minneapolis: [44.9778, -93.265],
  'twin cities': [44.96, -93.2],
  macalester: [44.9379, -93.1706],
  minnesota: [44.95, -93.1],
  mn: [44.95, -93.1],
  'chapel hill': [35.9132, -79.0558],
  unc: [35.9049, -79.0469],
  'myrtle beach': [33.6891, -78.8867],
};

function haversineMi(a, b) {
  const R = 3958.8;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function fmtMi(mi) {
  if (mi < 0.2) return 'right here';
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  if (mi < 900) return `${Math.round(mi)} mi`;
  return 'online';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function colorFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PIN_COLORS[h % PIN_COLORS.length];
}

/** "Sun Sep 7 · 3:00 to 4:30 PM" */
function fmtWhen(startAt, endAt) {
  try {
    const s = new Date(startAt);
    const e = new Date(endAt);
    const day = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const t = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${day} · ${t(s)} to ${t(e)}`;
  } catch {
    return '';
  }
}

/**
 * @param {{
 *   root: HTMLElement,
 *   onToast?: (msg: string) => void,
 * }} opts
 */
export function createTutorMap({ root, onToast }) {
  if (!root) return { open() {}, close() {}, destroy() {}, focus() {} };

  const mapEl = root.querySelector('[data-tm-map]');
  const listEl = root.querySelector('[data-tm-list]');
  const form = root.querySelector('[data-tm-search]');
  const input = root.querySelector('[data-tm-query]');
  const nearLabel = root.querySelector('[data-tm-near]');
  const headLabel = root.querySelector('[data-tm-head-label]');
  const tabs = [...root.querySelectorAll('[data-tm-tab]')];
  const createBtn = root.querySelector('[data-tm-create]');
  const eventForm = root.querySelector('[data-tm-event-form]');
  const efLocation = root.querySelector('[data-tm-ef-location]');
  const efLocationStatus = root.querySelector('[data-tm-ef-location-status]');
  const mapPane = root.querySelector('.hub-tutor-pane.map');
  const efTitle = root.querySelector('[data-tm-ef-title]');
  const efDate = root.querySelector('[data-tm-ef-date]');
  const efStart = root.querySelector('[data-tm-ef-start]');
  const efEnd = root.querySelector('[data-tm-ef-end]');
  const efNotes = root.querySelector('[data-tm-ef-notes]');
  const efCancel = root.querySelector('[data-tm-ef-cancel]');
  const efPost = root.querySelector('[data-tm-ef-post]');

  /** @type {any} */
  let map = null;
  /** @type {any} Leaflet layerGroup holding the active tab's markers */
  let markerLayer = null;
  /** @type {Record<string, any>} */
  let markers = {};
  let origin = null;
  let originLabel = '';
  let tab = 'tutors';
  let ready = false;
  let started = false;
  /** @type {any} The signed-in Firebase user, once known; null means either
   *  still loading or genuinely signed out, checked before ever posting. */
  let fireUser = null;
  /** @type {any} */
  let fireDb = null;
  /** @type {any} */
  let fireFx = null;
  let placingEvent = false;
  /** @type {any} Leaflet marker for the event being placed, removed on
   *  cancel/post. */
  let pendingMarker = null;
  /** @type {{lat:number,lng:number}|null} */
  let pendingLatLng = null;

  /** @type {Array<object>} */
  let tutors = DEMO_TUTORS;
  let tutorsAreDemo = true;
  /** @type {Array<object>} */
  let events = [];
  /** 'loading' | 'live' | 'signed-out' | 'blocked' */
  let eventsState = 'loading';
  let unsubEvents = null;

  function pinIcon(item) {
    const L = window.L;
    const label = tab === 'events'
      ? String(item.title || '').split(/\s+/)[0]
      : String(item.name || '').split(/\s+/)[0];
    const html = `<div class="tm-pin" style="background:${item.color}"></div><span class="tm-pin-label">${esc(label)}</span>`;
    return L.divIcon({
      className: 'tm-div-icon',
      html: `<div style="position:relative;width:28px;height:28px">${html}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  function activeItems() {
    return tab === 'events' ? events : tutors;
  }

  function ranked() {
    return activeItems()
      .map((t) => ({ ...t, mi: origin ? haversineMi(origin, t) : 0 }))
      .sort((a, b) => {
        if (tab === 'events' && !origin) return (a.startAt || 0) - (b.startAt || 0);
        return a.mi - b.mi;
      });
  }

  function tutorCard(t, i) {
    const near = origin ? t.mi < 250 : i === 0;
    return `
      <article class="tm-card ${near ? 'is-near' : ''}" data-id="${esc(t.id)}">
        <div class="tm-card-top">
          <div class="tm-avatar" style="background:${t.color}">${esc(t.initials)}</div>
          <div>
            <h4>${esc(t.name)}</h4>
            <div class="tm-meta">${esc(t.region)}</div>
            <p>${esc(t.bio)}</p>
            <span class="tm-dist">${origin ? `${i === 0 ? 'Closest · ' : ''}${fmtMi(t.mi)}` : 'Online over Meet'}</span>
          </div>
        </div>
        <button type="button" class="tm-book" data-book="${esc(t.id)}">Book free session</button>
      </article>`;
  }

  function eventCard(ev, i) {
    const near = origin ? ev.mi < 250 : i === 0;
    return `
      <article class="tm-card ${near ? 'is-near' : ''}" data-id="${esc(ev.id)}">
        <div class="tm-card-top">
          <div class="tm-avatar" style="background:${ev.color}">${esc(initialsOf(ev.tutorName))}</div>
          <div>
            <h4>${esc(ev.title)}</h4>
            <div class="tm-meta">${esc(fmtWhen(ev.startAt, ev.endAt))}</div>
            <p>${esc(ev.locationLabel || '')}${ev.notes ? ` · ${esc(ev.notes)}` : ''}</p>
            <span class="tm-dist">${esc(ev.tutorName || 'MindCraft tutor')}${origin ? ` · ${fmtMi(ev.mi)}` : ''}</span>
          </div>
        </div>
      </article>`;
  }

  function emptyLine() {
    if (tab === 'tutors') return 'No tutors to show yet.';
    if (eventsState === 'signed-out') return 'Sign in to see live events near you.';
    if (eventsState === 'blocked') return 'Events are not switched on for this environment yet. Check back soon.';
    if (eventsState === 'loading') return 'Checking for events…';
    return 'No upcoming events yet. Post one with + Add event above.';
  }

  function paintList() {
    const rows = ranked();
    if (headLabel) headLabel.textContent = tab === 'events' ? 'Upcoming events' : 'Available tutors';
    if (nearLabel) {
      if (originLabel) {
        nearLabel.textContent = `near ${originLabel}`;
      } else if (tab === 'events') {
        nearLabel.textContent = eventsState === 'live'
          ? `${rows.length} upcoming`
          : 'live from tutors';
      } else {
        nearLabel.textContent = `${rows.length} tutor${rows.length === 1 ? '' : 's'}${tutorsAreDemo ? ' · demo' : ''}`;
      }
    }
    // Any signed-in user now, not just tutors (2026-09-02 generalization).
    if (createBtn) createBtn.hidden = !(tab === 'events' && fireUser);
    if (!listEl) return;
    listEl.innerHTML = rows
      .map((item, i) => (tab === 'events' ? eventCard(item, i) : tutorCard(item, i)))
      .join('') || `<p class="tm-empty">${esc(emptyLine())}</p>`;

    listEl.querySelectorAll('.tm-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-book]')) return;
        focus(card.dataset.id);
      });
    });
    listEl.querySelectorAll('[data-book]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = tutors.find((x) => x.id === btn.getAttribute('data-book'));
        if (t && !t.demo) {
          window.location.href = '/find-a-tutor';
          return;
        }
        onToast?.(t ? `Booking · ${t.name} (demo)` : 'Booking soon');
      });
    });
  }

  function paintMarkers() {
    if (!map || !window.L) return;
    const L = window.L;
    markerLayer?.remove();
    markerLayer = L.layerGroup().addTo(map);
    markers = {};
    const items = activeItems();
    items.forEach((item) => {
      const pop = tab === 'events'
        ? `<div class="tm-pop"><strong>${esc(item.title)}</strong><br><span>${esc(fmtWhen(item.startAt, item.endAt))}</span><p>${esc(item.locationLabel || '')}</p></div>`
        : `<div class="tm-pop"><strong>${esc(item.name)}</strong><br><span>${esc(item.region)}</span><p>${esc(item.bio)}</p></div>`;
      markers[item.id] = L.marker([item.lat, item.lng], { icon: pinIcon(item) })
        .addTo(markerLayer)
        .bindPopup(pop);
    });
    if (items.length && !origin) {
      map.fitBounds(L.latLngBounds(items.map((t) => [t.lat, t.lng])).pad(0.35));
    }
  }

  function ensureMap() {
    if (ready || !mapEl || !window.L) return false;
    const L = window.L;
    map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    // Standard OSM tiles. The CARTO basemap this prototype launched with now
    // stamps "API KEY REQUIRED" across every tile (CARTO gated their free
    // basemaps), which looked broken on a panel that is now real product.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    // Pin placement for a new event, only live while the + Add event form
    // is open (placingEvent). A plain map click never fires this while
    // browsing tutors/events normally, existing marker popups are a
    // separate Leaflet layer and unaffected.
    map.on('click', (e) => {
      if (!placingEvent) return;
      placePendingMarker(e.latlng.lat, e.latlng.lng);
    });
    ready = true;
    paintMarkers();
    return true;
  }

  function placePendingMarker(lat, lng) {
    const L = window.L;
    pendingLatLng = { lat, lng };
    if (pendingMarker) {
      pendingMarker.setLatLng([lat, lng]);
    } else {
      pendingMarker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
          className: 'tm-div-icon',
          html: '<div style="position:relative;width:28px;height:28px"><div class="tm-pin tm-pin-pending"></div></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        }),
      }).addTo(map);
      pendingMarker.on('dragend', () => {
        const p = pendingMarker.getLatLng();
        pendingLatLng = { lat: p.lat, lng: p.lng };
      });
    }
    if (efLocationStatus) efLocationStatus.textContent = 'Pinned - drag it on the map to adjust';
    if (efLocation) efLocation.classList.add('is-set');
    updatePostEnabled();
  }

  function clearPendingMarker() {
    pendingMarker?.remove();
    pendingMarker = null;
    pendingLatLng = null;
  }

  function updatePostEnabled() {
    if (efPost) efPost.disabled = !(pendingLatLng && efTitle?.value.trim());
  }

  function todayIso() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function openEventForm() {
    placingEvent = true;
    if (createBtn) createBtn.classList.add('is-active');
    if (eventForm) eventForm.hidden = false;
    if (efLocationStatus) efLocationStatus.textContent = 'Tap to pin it on the map';
    if (efLocation) efLocation.classList.remove('is-set');
    if (efTitle) efTitle.value = '';
    if (efDate) efDate.value = todayIso();
    if (efStart) efStart.value = '16:00';
    if (efEnd) efEnd.value = '17:00';
    if (efNotes) efNotes.value = '';
    updatePostEnabled();
  }

  function closeEventForm() {
    placingEvent = false;
    if (createBtn) createBtn.classList.remove('is-active');
    if (eventForm) eventForm.hidden = true;
    clearPendingMarker();
  }

  async function postEvent() {
    if (!fireUser || !fireDb || !fireFx || !pendingLatLng) return;
    const title = (efTitle?.value || '').trim();
    if (!title) { onToast?.('Give the event a title first'); return; }
    const date = efDate?.value || todayIso();
    const startAt = new Date(`${date}T${efStart?.value || '00:00'}`).getTime();
    const endAt = new Date(`${date}T${efEnd?.value || '00:00'}`).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) { onToast?.('Pick a real date and time'); return; }
    if (endAt <= startAt) { onToast?.('The end time has to be after the start'); return; }
    if (endAt < Date.now()) { onToast?.('That time is already in the past'); return; }
    if (endAt - startAt > 86400000) { onToast?.('Events can run for at most 24 hours'); return; }
    if (efPost) efPost.disabled = true;
    try {
      const name = fireUser.displayName || (fireUser.email ? fireUser.email.split('@')[0] : '') || 'A MindCraft user';
      await fireFx.addDoc(fireFx.collection(fireDb, 'tutorEvents'), {
        hostId: fireUser.uid,
        hostName: name,
        title,
        notes: (efNotes?.value || '').trim(),
        locationLabel: `${pendingLatLng.lat.toFixed(4)}, ${pendingLatLng.lng.toFixed(4)}`,
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        startAt,
        endAt,
        createdAt: fireFx.serverTimestamp(),
      });
      onToast?.('Event is live on the map');
      closeEventForm();
    } catch {
      onToast?.('Could not save the event, try again.');
      if (efPost) efPost.disabled = false;
    }
  }

  function focus(id) {
    ensureMap();
    const item = activeItems().find((x) => x.id === id);
    if (!item || !markers[item.id] || !map) return;
    map.flyTo([item.lat, item.lng], 11, { duration: 0.7 });
    markers[item.id].openPopup();
    listEl?.querySelectorAll('.tm-card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.id === id);
    });
  }

  /** One-shot load of the real tutor roster, same query FindTutor.tsx runs. */
  async function loadRealTutors(fire) {
    const { db, fx } = fire;
    const snap = await fx.getDocs(
      fx.query(fx.collection(db, 'users'), fx.where('role', '==', 'tutor')),
    );
    const rows = [];
    for (const d of snap.docs) {
      const data = d.data() || {};
      const name = typeof data.displayName === 'string' ? data.displayName.trim() : '';
      if (!name) continue; // placeholder tutor docs stay hidden, same as FindTutor
      const hasRealLocation =
        data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number';
      const loc = hasRealLocation ? data.location : STUDIO_LOCATION;
      rows.push({
        id: d.id,
        name,
        initials: initialsOf(name),
        color: colorFor(d.id),
        bio: typeof data.bio === 'string' && data.bio ? data.bio : DEFAULT_BIO,
        region: data.locationAddress || data.regionLabel || 'MindCraft studio · St Paul, MN',
        lat: loc.lat,
        lng: loc.lng,
        hasRealLocation,
        meetUrl: typeof data.googleMeetUrl === 'string' ? data.googleMeetUrl : '',
      });
    }
    if (rows.length) {
      tutors = rows;
      tutorsAreDemo = false;
    }
  }

  /** Live listener on tutorEvents. Fails closed and says so until the rules
   *  block on this branch is deployed. */
  function watchEvents(fire) {
    const { db, fx } = fire;
    try {
      unsubEvents = fx.onSnapshot(
        fx.collection(db, 'tutorEvents'),
        (snap) => {
          const now = Date.now();
          events = snap.docs
            .map((d) => {
              const data = d.data() || {};
              return {
                id: d.id,
                title: String(data.title || 'Tutor event'),
                notes: typeof data.notes === 'string' ? data.notes : '',
                tutorName: typeof data.tutorName === 'string' ? data.tutorName : '',
                locationLabel: typeof data.locationLabel === 'string' ? data.locationLabel : '',
                lat: Number(data.lat),
                lng: Number(data.lng),
                startAt: Number(data.startAt) || 0,
                endAt: Number(data.endAt) || 0,
                color: EVENT_COLOR,
              };
            })
            .filter((ev) => Number.isFinite(ev.lat) && Number.isFinite(ev.lng) && ev.endAt >= now)
            .sort((a, b) => a.startAt - b.startAt);
          eventsState = 'live';
          if (tab === 'events') {
            paintList();
            paintMarkers();
          }
        },
        () => {
          // Permission denied: the tutorEvents rules block is not deployed
          // in this environment yet. Honest state, not a fake empty list.
          eventsState = 'blocked';
          events = [];
          if (tab === 'events') paintList();
        },
      );
    } catch {
      eventsState = 'blocked';
    }
  }

  /** Kick off real data once, in the background; repaint as it lands. */
  function startData() {
    if (started) return;
    started = true;
    void (async () => {
      const fire = await ensureFire();
      if (!fire || !fire.user) {
        eventsState = 'signed-out';
        if (tab === 'events') paintList();
        return; // demo tutors stay
      }
      fireUser = fire.user;
      fireDb = fire.db;
      fireFx = fire.fx;
      watchEvents(fire);
      try {
        await loadRealTutors(fire);
      } catch { /* demo tutors stay */ }
      paintList();
      paintMarkers();
    })();
  }

  function setTab(next) {
    tab = next === 'events' ? 'events' : 'tutors';
    tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.tmTab === tab));
    origin = null;
    originLabel = '';
    if (input) input.value = '';
    if (tab !== 'events') closeEventForm();
    paintList();
    paintMarkers();
  }

  function open(opts = {}) {
    root.hidden = false;
    root.classList.remove('hidden', 'is-collapsed');
    ensureMap();
    startData();
    window.setTimeout(() => map?.invalidateSize(), 80);
    if (opts.tab) setTab(opts.tab);
    if (typeof opts.query === 'string' && opts.query && input) {
      input.value = opts.query;
      runSearch(opts.query);
    } else {
      paintList();
    }
    if (opts.focusId) focus(opts.focusId);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function close() {
    root.classList.add('is-collapsed');
    closeEventForm();
  }

  function runSearch(raw) {
    const q = String(raw || '').trim().toLowerCase();
    if (!q) {
      origin = null;
      originLabel = '';
      paintList();
      paintMarkers();
      return;
    }
    const hit = Object.keys(PRESETS).find((k) => q.includes(k) || k.includes(q));
    if (hit) {
      const [lat, lng] = PRESETS[hit];
      origin = { lat, lng };
      originLabel = hit;
      paintList();
      map?.flyTo([lat, lng], 10, { duration: 0.9 });
      const nearest = ranked()[0];
      if (nearest) focus(nearest.id);
      return;
    }
    const pool = activeItems();
    const byName = pool.find((item) => {
      const hay = tab === 'events'
        ? `${item.title} ${item.tutorName} ${item.locationLabel}`.toLowerCase()
        : `${item.name} ${item.region}`.toLowerCase();
      return hay.includes(q);
    });
    if (byName) {
      origin = { lat: byName.lat, lng: byName.lng };
      originLabel = tab === 'events'
        ? String(byName.title).split(/\s+/)[0]
        : String(byName.name).split(/\s+/)[0];
      paintList();
      focus(byName.id);
      return;
    }
    onToast?.('Try a city like St Paul, or a tutor name');
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(input?.value);
  });

  // The Location row in the event form draws the eye to the real map
  // (still the only thing that actually places a pin, live the whole time
  // the form is open) rather than placing one itself — a brief highlight
  // pulse on the map pane, not new placement logic.
  efLocation?.addEventListener('click', () => {
    if (!mapPane) return;
    mapPane.classList.add('is-highlighted');
    mapPane.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    window.setTimeout(() => mapPane.classList.remove('is-highlighted'), 1200);
  });

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tmTab));
  });

  createBtn?.addEventListener('click', () => {
    if (placingEvent) closeEventForm();
    else {
      ensureMap();
      openEventForm();
    }
  });
  efCancel?.addEventListener('click', () => closeEventForm());
  efPost?.addEventListener('click', () => void postEvent());
  efTitle?.addEventListener('input', () => updatePostEnabled());

  // Lazy init when section enters view
  if (typeof IntersectionObserver !== 'undefined' && mapEl) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          ensureMap();
          startData();
          window.setTimeout(() => map?.invalidateSize(), 60);
          paintList();
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(root);
  } else {
    ensureMap();
    startData();
    paintList();
  }

  return {
    open,
    close,
    focus,
    destroy() {
      try { unsubEvents?.(); } catch { /* ignore */ }
    },
  };
}
