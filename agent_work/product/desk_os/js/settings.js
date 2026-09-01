/**
 * settings.js · the hub's Settings button: lets a student paste their own
 * LLM API key (OpenAI, Groq, Anthropic, or any OpenAI-compatible endpoint)
 * as a fallback when MindCraft's own platform key is down or capped
 * (2026-09-01 ask, after resume-agent's platform Anthropic and Groq calls
 * were both found failing in production).
 *
 * Stored in localStorage only, never Firestore, and never sent anywhere
 * except directly in the request body of the one or two endpoints that
 * accept it. users/{uid} is broadly readable by any signed-in user in this
 * app (see firestore.rules, no ownership check on read), so a real secret
 * like an API key must never be written there. This mirrors the existing
 * studentGeminiKey pattern (webhook/lib/studentGemini.ts, generate-resume-pdf.ts):
 * per-request, never persisted server side.
 */

const STORAGE_KEY = 'deskOs.byok';

// Where to get a free key for each provider, shown next to the picker so a
// student is one click from a real key instead of hunting for it. Every one
// of these has a genuinely permanent free tier, no credit card, source:
// github.com/mnfst/awesome-free-llm-apis (checked 2026-09-01). Cohere and a
// few others on that list are excluded here on purpose, their free key is
// explicitly non-commercial-use-only in its own terms, not a fit for a
// product asking students to route requests through it.
const PROVIDER_KEY_LINKS = {
  openai: 'https://platform.openai.com/api-keys',
  groq: 'https://console.groq.com/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  openrouter: 'https://openrouter.ai/keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
};

/** Reads the saved key config, or null if none is saved. Safe to call from
 *  any panel that wants to try a student key as a fallback. */
export function readByokConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.apiKey || !parsed?.provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {{ button: HTMLElement | null, onToast?: (msg: string) => void }} opts
 */
export function createSettings({ button, onToast }) {
  let panel = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.className = 'friends-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Settings');
    panel.innerHTML = `
      <div class="friends-card">
        <div class="friends-head">
          <div>
            <p class="friends-kicker">Settings</p>
            <h2 class="friends-title">Your own API key</h2>
          </div>
          <button type="button" class="friends-x" data-settings-close aria-label="Close">&times;</button>
        </div>
        <p class="friends-soft">Resume Helper's Jesse chat tries MindCraft's own key first. If that is down or capped, it falls back to a key you paste here, for this browser only. Nothing is stored on our servers.</p>
        <form class="friends-add settings-form" data-settings-form>
          <select data-settings-provider>
            <option value="">No key, use MindCraft's own</option>
            <option value="gemini">Google Gemini, free</option>
            <option value="groq">Groq, free</option>
            <option value="openrouter">OpenRouter, free models</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom, OpenAI-compatible</option>
          </select>
          <a class="settings-keylink" data-settings-keylink href="#" target="_blank" rel="noopener" hidden>Get a free key from this provider &#8599;</a>
          <input data-settings-key type="password" placeholder="API key" autocomplete="off" />
          <input data-settings-model type="text" placeholder="Model, optional, provider default otherwise" autocomplete="off" hidden />
          <input data-settings-baseurl type="text" placeholder="Base URL, e.g. https://api.example.com/v1/chat/completions" autocomplete="off" hidden />
          <button type="submit">Save</button>
        </form>
        <p class="friends-soft" data-settings-status></p>
      </div>
    `;
    document.body.appendChild(panel);

    const form = panel.querySelector('[data-settings-form]');
    const providerSel = panel.querySelector('[data-settings-provider]');
    const keyLink = panel.querySelector('[data-settings-keylink]');
    const keyInput = panel.querySelector('[data-settings-key]');
    const modelInput = panel.querySelector('[data-settings-model]');
    const baseUrlInput = panel.querySelector('[data-settings-baseurl]');
    const statusEl = panel.querySelector('[data-settings-status]');

    function syncFields() {
      modelInput.hidden = !providerSel.value;
      baseUrlInput.hidden = providerSel.value !== 'custom';
      const link = PROVIDER_KEY_LINKS[providerSel.value];
      keyLink.hidden = !link;
      if (link) keyLink.href = link;
    }
    providerSel.addEventListener('change', syncFields);

    const existing = readByokConfig();
    if (existing) {
      providerSel.value = existing.provider || '';
      modelInput.value = existing.model || '';
      baseUrlInput.value = existing.baseUrl || '';
      statusEl.textContent = `Saved: a ${existing.provider} key is in use.`;
    }
    syncFields();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const provider = providerSel.value;
      const apiKey = keyInput.value.trim();
      if (!provider || !apiKey) {
        localStorage.removeItem(STORAGE_KEY);
        statusEl.textContent = "Cleared. Using MindCraft's own key.";
        onToast?.('Cleared your key');
        return;
      }
      if (provider === 'custom' && !baseUrlInput.value.trim()) {
        statusEl.textContent = 'Custom needs a base URL.';
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        provider,
        apiKey,
        model: modelInput.value.trim() || undefined,
        baseUrl: provider === 'custom' ? baseUrlInput.value.trim() : undefined,
      }));
      keyInput.value = '';
      statusEl.textContent = `Saved: a ${provider} key is in use.`;
      onToast?.('Key saved for this browser');
    });

    panel.querySelector('[data-settings-close]')?.addEventListener('click', close);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) close();
    });
    return panel;
  }

  function open() {
    ensurePanel();
    panel.hidden = false;
    panel.classList.add('is-open');
  }
  function close() {
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('is-open');
  }

  button?.addEventListener('click', () => {
    if (panel && !panel.hidden) close();
    else open();
  });

  return { open, close };
}
