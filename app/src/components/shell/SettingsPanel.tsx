/**
 * components/shell/SettingsPanel.tsx
 *
 * The first real in-app Settings surface. Until now the only place a
 * student could set their own API key was the legacy static Desk OS hub
 * (agent_work/product/desk_os/js/settings.js) — same localStorage key
 * ('deskOs.byok', see lib/byokSettings.ts), so a key saved here is read the
 * exact same way by every BYOK call site already in this app (learnTutor.ts,
 * resumeAgent.ts, homework.ts, generatedBooks.ts, ...). Sign out lives here
 * too now, off the top-level rail.
 */
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { readByokConfig, writeByokConfig, clearByokConfig, type ByokConfig } from '../../lib/byokSettings'
import { CARD, TEXT_PRIMARY, TEXT_SOFT, TEXT_FAINT, FONT_STACK, ACCENT_FOREST } from '../../pages/learn/shared'
import { LogOut } from 'lucide-react'

const PROVIDER_KEY_LINKS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys',
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
}

const inputStyle = {
  padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(140,178,150,0.25)',
  background: 'rgba(205,220,208,0.05)', color: TEXT_PRIMARY, fontSize: 14, fontFamily: FONT_STACK, outline: 'none',
} as const

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const existing = readByokConfig()
  const [provider, setProvider] = useState<ByokConfig['provider'] | ''>(existing?.provider ?? '')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(existing?.model ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '')
  const [status, setStatus] = useState(existing ? `Saved: a ${existing.provider} key is in use.` : '')
  const [signingOut, setSigningOut] = useState(false)

  function save() {
    if (!provider || !apiKey.trim()) {
      clearByokConfig()
      setStatus("Cleared. Using MindCraft's own key.")
      return
    }
    if (provider === 'custom' && !baseUrl.trim()) {
      setStatus('Custom needs a base URL.')
      return
    }
    writeByokConfig({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
      baseUrl: provider === 'custom' ? baseUrl.trim() : undefined,
    })
    setApiKey('')
    setStatus(`Saved: a ${provider} key is in use.`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try { await signOut(auth) } catch { /* ignore */ }
    navigate('/login')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(3,8,5,0.5)' }} />
      <div style={{ ...CARD, width: 400, maxWidth: '92%', height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column', padding: '28px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: TEXT_FAINT }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_FAINT, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        <h2 style={{ margin: '2px 0 8px', fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY }}>Your own API key</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: TEXT_SOFT }}>
          Jesse tries MindCraft's own key first. If that's down or capped, it falls back to a key you paste here, for this browser only. Nothing is stored on our servers.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as ByokConfig['provider'] | '')}
            style={inputStyle}
          >
            <option value="">No key, use MindCraft's own</option>
            <option value="gemini">Google Gemini, free</option>
            <option value="groq">Groq, free</option>
            <option value="openrouter">OpenRouter, free models</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom, OpenAI-compatible</option>
          </select>
          {provider && PROVIDER_KEY_LINKS[provider] && (
            <a href={PROVIDER_KEY_LINKS[provider]} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#5fa578' }}>
              Get a free key from this provider ↗
            </a>
          )}
          {provider && (
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="API key"
              autoComplete="off"
              style={inputStyle}
            />
          )}
          {provider && (
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="Model, optional, provider default otherwise"
              autoComplete="off"
              style={inputStyle}
            />
          )}
          {provider === 'custom' && (
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Base URL, e.g. https://api.example.com/v1/chat/completions"
              autoComplete="off"
              style={inputStyle}
            />
          )}
          <button
            type="button"
            onClick={save}
            style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: ACCENT_FOREST, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Save
          </button>
          {status && <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT }}>{status}</p>}
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 12,
            border: '1px solid rgba(255,123,123,0.3)', background: 'rgba(255,123,123,0.08)',
            color: '#FF9B9B', fontWeight: 600, fontSize: 13, cursor: signingOut ? 'default' : 'pointer',
          }}
        >
          <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
