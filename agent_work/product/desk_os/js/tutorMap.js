/** In-dash tutor map · same pattern as marketing Leaflet map */

const TUTORS = [
  {
    id: 'akshat',
    name: 'Akshat Koirala',
    initials: 'AK',
    color: '#2f4a38',
    bio: 'ACT, algebra, precalc, calculus. Clear first steps when the graph feels foggy.',
    region: 'Macalester · St Paul, MN',
    lat: 44.9379,
    lng: -93.1706,
    tags: ['math', 'act', 'college', 'nearby'],
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
    tags: ['math', 'college'],
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
    tags: ['math', 'college', 'act'],
  },
];

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
  const chips = [...root.querySelectorAll('[data-tm-chip]')];

  /** @type {any} */
  let map = null;
  /** @type {Record<string, any>} */
  const markers = {};
  let origin = null;
  let filter = 'all';
  let ready = false;

  function pinIcon(t) {
    const L = window.L;
    const html = `<div class="tm-pin" style="background:${t.color}"></div><span class="tm-pin-label">${t.name.split(' ')[0]}</span>`;
    return L.divIcon({
      className: 'tm-div-icon',
      html: `<div style="position:relative;width:28px;height:28px">${html}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  function filtered() {
    return TUTORS.filter((t) => filter === 'all' || t.tags.includes(filter));
  }

  function rank() {
    const pool = filtered();
    return pool
      .map((t) => ({ ...t, mi: origin ? haversineMi(origin, t) : 0 }))
      .sort((a, b) => a.mi - b.mi);
  }

  function paintList(label) {
    const ranked = rank();
    if (nearLabel) {
      nearLabel.textContent = label
        ? `near ${label}`
        : `${ranked.length} tutor${ranked.length === 1 ? '' : 's'}`;
    }
    if (!listEl) return;
    listEl.innerHTML = ranked
      .map((t, i) => {
        const near = origin ? t.mi < 250 : i === 0;
        return `
        <article class="tm-card ${near ? 'is-near' : ''}" data-id="${t.id}">
          <div class="tm-card-top">
            <div class="tm-avatar" style="background:${t.color}">${t.initials}</div>
            <div>
              <h4>${t.name}</h4>
              <div class="tm-meta">${t.region}</div>
              <p>${t.bio}</p>
              <span class="tm-dist">${origin ? `${i === 0 ? 'Closest · ' : ''}${fmtMi(t.mi)}` : 'Online over Meet'}</span>
            </div>
          </div>
          <button type="button" class="tm-book" data-book="${t.id}">Book free session</button>
        </article>`;
      })
      .join('') || `<p class="tm-empty">No tutors in this filter.</p>`;

    listEl.querySelectorAll('.tm-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-book]')) return;
        focus(card.dataset.id);
      });
    });
    listEl.querySelectorAll('[data-book]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = TUTORS.find((x) => x.id === btn.getAttribute('data-book'));
        onToast?.(t ? `Booking · ${t.name}` : 'Booking soon');
      });
    });
  }

  function ensureMap() {
    if (ready || !mapEl || !window.L) return false;
    const L = window.L;
    map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '&copy; OSM &copy; CARTO',
    }).addTo(map);
    TUTORS.forEach((t) => {
      markers[t.id] = L.marker([t.lat, t.lng], { icon: pinIcon(t) })
        .addTo(map)
        .bindPopup(
          `<div class="tm-pop"><strong>${t.name}</strong><br><span>${t.region}</span><p>${t.bio}</p></div>`,
        );
      markers[t.id].on('click', () => paintList());
    });
    map.fitBounds(L.latLngBounds(TUTORS.map((t) => [t.lat, t.lng])).pad(0.35));
    ready = true;
    return true;
  }

  function focus(id) {
    ensureMap();
    const t = TUTORS.find((x) => x.id === id);
    if (!t || !markers[t.id] || !map) return;
    map.flyTo([t.lat, t.lng], 11, { duration: 0.7 });
    markers[t.id].openPopup();
    listEl?.querySelectorAll('.tm-card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.id === id);
    });
  }

  function open(opts = {}) {
    root.hidden = false;
    root.classList.remove('hidden', 'is-collapsed');
    ensureMap();
    window.setTimeout(() => map?.invalidateSize(), 80);
    if (opts.filter) {
      filter = opts.filter;
      chips.forEach((c) => c.classList.toggle('is-active', c.dataset.tmChip === filter));
    }
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
    /* stays on dash · just collapse profile emphasis */
    root.classList.add('is-collapsed');
  }

  function runSearch(raw) {
    const q = String(raw || '').trim().toLowerCase();
    if (!q) {
      origin = null;
      paintList();
      if (map && window.L) {
        map.fitBounds(window.L.latLngBounds(TUTORS.map((t) => [t.lat, t.lng])).pad(0.35));
      }
      return;
    }
    const hit = Object.keys(PRESETS).find((k) => q.includes(k) || k.includes(q));
    if (hit) {
      const [lat, lng] = PRESETS[hit];
      origin = { lat, lng };
      paintList(hit);
      map?.flyTo([lat, lng], 10, { duration: 0.9 });
      const nearest = rank()[0];
      if (nearest) focus(nearest.id);
      return;
    }
    const byName = TUTORS.find(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q)),
    );
    if (byName) {
      origin = { lat: byName.lat, lng: byName.lng };
      paintList(byName.name.split(' ')[0]);
      focus(byName.id);
      return;
    }
    onToast?.('Try St Paul, Macalester, or a tutor name');
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(input?.value);
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filter = chip.dataset.tmChip || 'all';
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));
      paintList();
    });
  });

  // Lazy init when section enters view
  if (typeof IntersectionObserver !== 'undefined' && mapEl) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          ensureMap();
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
    paintList();
  }

  return { open, close, focus, destroy() {} };
}
