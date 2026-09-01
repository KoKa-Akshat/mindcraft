/**
 * friends.js · the hub's "Call" button: friend list + real calendar invites.
 *
 * Backed by the SAME Firestore shape the iOS app already ships
 * (FriendsStore.swift): users/{uid}/friends/{friendId} with
 * { name, email, addedAt }, an owner-only personal contact list (see the
 * matching firestore.rules block), deliberately NOT a mutual friend-request
 * graph. Reusing that exact schema means a student's friends are the same
 * list on iOS and web.
 *
 * The "Call" action per friend opens a prefilled Google Calendar event
 * template (calendar.google.com/calendar/render?action=TEMPLATE) in a new
 * tab with the friend pre-added as a guest. When the student saves it in
 * their own Google account, Google sends the friend a REAL calendar invite.
 * That is the same zero-OAuth, plain-URL pattern this codebase already
 * prefers (see TutorDashboard's googleMeetUrl comment: no Google OAuth or
 * Calendar API involved), and unlike the iOS EventKit path it genuinely
 * invites the other person in one flow.
 */

import { ensureFire } from './fire.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Floating local time, YYYYMMDDTHHMMSS, which Google Calendar reads in the
 *  student's own calendar timezone. */
function gcalStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** Next quarter-hour at least 15 minutes out, plus a 45 minute block. */
function defaultWindow() {
  const start = new Date(Date.now() + 15 * 60 * 1000);
  start.setSeconds(0, 0);
  const q = 15 - (start.getMinutes() % 15);
  if (q > 0 && q < 15) start.setMinutes(start.getMinutes() + q);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  return { start, end };
}

export function buildInviteUrl({ myName, friendName, friendEmail }) {
  const { start, end } = defaultWindow();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `MindCraft study session · ${myName || 'Me'} + ${friendName}`,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
    details: [
      'Study session on MindCraft. We will share screens and work together.',
      `Join at ${window.location.origin}/learn`,
      'Sent from the MindCraft desk.',
    ].join('\n'),
    location: 'MindCraft',
  });
  if (friendEmail) params.set('add', friendEmail);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * @param {{
 *   button: HTMLElement | null,
 *   getUserName?: () => string,
 *   onToast?: (msg: string) => void,
 * }} opts
 */
export function createFriends({ button, getUserName, onToast }) {
  if (!button) return { open() {}, close() {}, destroy() {} };

  let panel = null;
  let listEl = null;
  let form = null;
  let noteEl = null;
  let unsub = null;
  let fire = null;
  let friends = [];
  let started = false;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.className = 'friends-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Call a friend');
    panel.innerHTML = `
      <div class="friends-card">
        <div class="friends-head">
          <div>
            <p class="friends-kicker">study together</p>
            <h3 class="friends-title">Call a friend</h3>
          </div>
          <button type="button" class="friends-x" data-friends-close aria-label="Close">−</button>
        </div>
        <p class="friends-soft">Pick a friend and we prefill a Google Calendar invite. Save it and they get a real invite to share screens and do MindCraft together.</p>
        <p class="friends-note" data-friends-note hidden></p>
        <form class="friends-add" data-friends-add autocomplete="off">
          <input data-friends-name type="text" maxlength="60" placeholder="Friend's name" aria-label="Friend's name" />
          <input data-friends-email type="email" maxlength="120" placeholder="Email (for the invite)" aria-label="Friend's email" />
          <button type="submit">Add</button>
        </form>
        <div class="friends-list" data-friends-list></div>
      </div>
    `;
    document.body.appendChild(panel);
    listEl = panel.querySelector('[data-friends-list]');
    form = panel.querySelector('[data-friends-add]');
    noteEl = panel.querySelector('[data-friends-note]');
    panel.querySelector('[data-friends-close]')?.addEventListener('click', close);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) close();
    });
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void addFriend();
    });
    return panel;
  }

  function paintList() {
    if (!listEl) return;
    if (!fire?.user) {
      listEl.innerHTML = '';
      return;
    }
    listEl.innerHTML = friends.map((f) => `
      <div class="friends-row" data-fid="${esc(f.id)}">
        <span class="friends-avatar">${esc((f.name[0] || '?').toUpperCase())}</span>
        <span class="friends-who">
          <strong>${esc(f.name)}</strong>
          <em>${esc(f.email || 'no email yet')}</em>
        </span>
        <button type="button" class="friends-call" data-call="${esc(f.id)}">Call</button>
        <button type="button" class="friends-remove" data-remove="${esc(f.id)}" aria-label="Remove ${esc(f.name)}">×</button>
      </div>
    `).join('') || '<p class="friends-empty">No friends yet. Add one above, they stay synced with your iOS list.</p>';

    listEl.querySelectorAll('[data-call]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = friends.find((x) => x.id === btn.getAttribute('data-call'));
        if (!f) return;
        if (!f.email) {
          onToast?.('Add an email for this friend so the invite can reach them');
          return;
        }
        const url = buildInviteUrl({
          myName: getUserName?.() || '',
          friendName: f.name,
          friendEmail: f.email,
        });
        window.open(url, '_blank', 'noopener');
        onToast?.(`Invite drafted for ${f.name}. Save it in Google Calendar to send`);
      });
    });
    listEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void removeFriend(btn.getAttribute('data-remove'));
      });
    });
  }

  function setNote(msg) {
    if (!noteEl) return;
    noteEl.hidden = !msg;
    noteEl.textContent = msg || '';
  }

  async function addFriend() {
    const nameInput = panel?.querySelector('[data-friends-name]');
    const emailInput = panel?.querySelector('[data-friends-email]');
    const name = nameInput?.value?.trim() || '';
    const email = emailInput?.value?.trim() || '';
    if (!name) {
      onToast?.('Give your friend a name first');
      return;
    }
    if (!fire?.user) {
      onToast?.('Sign in to build your friend list');
      return;
    }
    try {
      const { db, fx, user } = fire;
      await fx.addDoc(fx.collection(db, 'users', user.uid, 'friends'), {
        name,
        email,
        addedAt: fx.serverTimestamp(),
      });
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      onToast?.(`${name} added`);
    } catch {
      onToast?.('Could not save. Try again');
    }
  }

  async function removeFriend(id) {
    if (!fire?.user || !id) return;
    try {
      const { db, fx, user } = fire;
      await fx.deleteDoc(fx.doc(db, 'users', user.uid, 'friends', id));
    } catch {
      onToast?.('Could not remove. Try again');
    }
  }

  function startData() {
    if (started) return;
    started = true;
    void (async () => {
      fire = await ensureFire();
      if (!fire) {
        setNote('Offline demo: the friend list needs the network.');
        paintList();
        return;
      }
      if (!fire.user) {
        setNote('Sign in on MindCraft to build your friend list.');
        paintList();
        return;
      }
      setNote('');
      const { db, fx, user } = fire;
      unsub = fx.onSnapshot(
        fx.collection(db, 'users', user.uid, 'friends'),
        (snap) => {
          friends = snap.docs
            .map((d) => {
              const data = d.data() || {};
              return {
                id: d.id,
                name: typeof data.name === 'string' ? data.name : '',
                email: typeof data.email === 'string' ? data.email : '',
              };
            })
            .filter((f) => f.name)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          paintList();
        },
        () => {
          setNote('Could not load your friends right now.');
        },
      );
    })();
  }

  function open() {
    ensurePanel();
    panel.hidden = false;
    panel.classList.add('is-open');
    startData();
    paintList();
    window.setTimeout(() => panel?.querySelector('[data-friends-name]')?.focus(), 60);
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('is-open');
  }

  button.addEventListener('click', () => {
    if (panel && !panel.hidden) close();
    else open();
  });

  return {
    open,
    close,
    destroy() {
      try { unsub?.(); } catch { /* ignore */ }
      close();
    },
  };
}
