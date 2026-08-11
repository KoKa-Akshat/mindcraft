/**
 * Prototype onboarding · Student vs Tutor (local demo only)
 */

const ROLE_KEY = 'deskOs.role';
const PROFILE_KEY = 'deskOs.user';

export function getRole() {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    if (r === 'tutor' || r === 'student') return r;
  } catch { /* ignore */ }
  return null;
}

export function setRole(role) {
  const r = role === 'tutor' ? 'tutor' : 'student';
  try {
    localStorage.setItem(ROLE_KEY, r);
    const user = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
    user.role = r;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  } catch { /* ignore */ }
  return r;
}

/**
 * @param {{
 *   host: HTMLElement,
 *   onDone: (role: 'student' | 'tutor') => void,
 * }} opts
 */
export function createOnboarding({ host, onDone }) {
  if (!host) return { show() {}, hide() {}, destroy() {} };

  let root = host.querySelector('[data-onboard]');
  if (!root) {
    root = document.createElement('section');
    root.className = 'onboard-stage';
    root.dataset.onboard = '';
    root.hidden = true;
    root.setAttribute('aria-label', 'Choose your role');
    root.innerHTML = `
      <header class="onboard-chrome">
        <p class="wordmark" aria-label="MindCraft">Mind<span>Craft</span></p>
      </header>
      <div class="onboard-card">
        <p class="onboard-kicker">Prototype onboarding</p>
        <h1 class="onboard-title">Who is joining the desk?</h1>
        <p class="onboard-soft">Same shell for Piano and ACT. Role only changes Call copy and tutor map emphasis. Local demo, no cloud.</p>
        <div class="onboard-roles">
          <button type="button" class="onboard-role" data-role="student">
            <strong>Student</strong>
            <span>Interactive books · mastery Call check-in</span>
          </button>
          <button type="button" class="onboard-role" data-role="tutor">
            <strong>Tutor</strong>
            <span>Guide a learner · Call becomes a session note</span>
          </button>
        </div>
      </div>
    `;
    host.appendChild(root);
  }

  function show() {
    root.hidden = false;
    root.classList.remove('hidden');
  }

  function hide() {
    root.hidden = true;
    root.classList.add('hidden');
  }

  root.querySelectorAll('[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = setRole(btn.getAttribute('data-role') || 'student');
      hide();
      onDone?.(role);
    });
  });

  return { show, hide, destroy() { hide(); } };
}
