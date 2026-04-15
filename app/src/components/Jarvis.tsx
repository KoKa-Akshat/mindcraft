/**
 * Jarvis.tsx — MindCraft AI assistant
 *
 * heroMode=true  → renders an inline orb with floating bubbles (goes in HeroBar right slot)
 * heroMode=false → renders the old fixed bottom-right trigger (fallback for other pages)
 *
 * Voice in:  Web Speech API SpeechRecognition
 * Voice out: Web Speech API SpeechSynthesis
 * Navigation: instant client-side routing
 * AI: Claude Haiku via mindcraft-webhook
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logEvent } from '../lib/logEvent'
import s from './Jarvis.module.css'

const JARVIS_URL = 'https://mindcraft-webhook.vercel.app/api/jarvis'

const GRAPH_CONCEPT_RE = /\b(?:study|graph|explore|show(?:\s+me)?|map|knowledge(?:\s+graph)?(?:\s+for)?|i\s+want\s+to\s+study|i\s+need\s+to\s+study)\s+([a-z0-9 ]+)/i

const NAV_ROUTES: { patterns: RegExp; route: (tid?: string | null) => string; label: string }[] = [
  { patterns: /\b(dashboard|home|main|overview)\b/i,                                              route: () => '/dashboard',           label: 'dashboard'        },
  { patterns: /\b(book|schedule|booking|new session)\b/i,                                         route: () => '/book',                label: 'booking page'     },
  { patterns: /\b(timer|pomodoro|technique|ultradian|flowtime|deep work|52|focus mode)\b/i,        route: () => '/study-timer',         label: 'Study Techniques' },
  { patterns: /\b(knowledge\s+graph|my\s+graph)\b/i,                                              route: () => '/knowledge-graph',     label: 'Knowledge Graph'  },
  { patterns: /\b(chat|message|inbox)\b/i,                                                        route: (tid) => tid ? `/chat/${tid}` : '/dashboard', label: 'messages' },
]

type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking'
interface Message { role: 'user' | 'jarvis'; text: string }

interface Props {
  userName?:       string | null
  tutorId?:        string | null
  userId?:         string | null   // for event logging
  context?:        string
  heroMode?:       boolean          // true = inline hero orb, false = fixed bottom-right
  wakeWordEnabled?: boolean         // listens for "jarvis" / "hey jarvis" hands-free
}

// Bubble positions: [angle-deg, orbit-radius-px, size-px, delay-s, duration-s]
const BUBBLES: [number, number, number, number, number][] = [
  [  0,  90, 10, 0.0, 8  ],
  [ 45,  75,  7, 0.6, 10 ],
  [ 90, 100,  5, 1.2, 7  ],
  [135,  80,  9, 0.3, 9  ],
  [180,  95,  6, 0.9, 11 ],
  [225,  72,  8, 1.5, 8  ],
  [270,  88,  5, 0.2, 12 ],
  [315,  78,  7, 1.1, 9  ],
  [ 22,  62,  4, 0.7, 6  ],
  [160,  68,  4, 1.8, 7  ],
  [200, 105,  6, 0.4, 13 ],
  [340,  85,  5, 1.3, 8  ],
]

function speak(text: string, onEnd?: () => void) {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.92; u.pitch = 0.78; u.volume = 1
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v => /daniel|alex|google uk english male|microsoft david/i.test(v.name))
    || voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('female'))
  if (preferred) u.voice = preferred
  if (onEnd) u.onend = onEnd
  window.speechSynthesis.speak(u)
}

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export default function Jarvis({ userName, tutorId, userId, context = '', heroMode = false, wakeWordEnabled = false }: Props) {
  const navigate = useNavigate()
  const [open, setOpen]         = useState(false)
  const [state, setState]       = useState<JarvisState>('idle')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'jarvis', text: `All systems online${userName ? `, ${userName.split(' ')[0]}` : ''}. How can I assist you today?` }
  ])
  const [input, setInput]         = useState('')
  const [wakeActive, setWakeActive] = useState(false)  // shows wake indicator
  const recogRef      = useRef<any>(null)
  const wakeRecogRef  = useRef<any>(null)
  const wakeLoopRef   = useRef<(() => void) | null>(null)
  const openRef       = useRef(false)
  const shouldActivateRef = useRef(false)
  const msgsRef  = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep a ref so wake loop can read current open state without stale closure
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  }, [])

  // ── Wake word detection loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!wakeWordEnabled || !SR) return
    let alive = true

    function runWake() {
      if (!alive || openRef.current) return
      try {
        const r = new SR()
        r.lang = 'en-US'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 5
        r.onresult = (e: any) => {
          const text = Array.from({ length: e.results.length }, (_: any, i: number) =>
            Array.from({ length: e.results[i].length }, (_: any, j: number) =>
              (e.results[i][j] as any).transcript as string
            ).join(' ')
          ).join(' ').toLowerCase()
          if (/\bjarvis\b|hey\s+jarvis|hi\s+jarvis|okay\s+jarvis/.test(text)) {
            setOpen(true)
            shouldActivateRef.current = true
            logEvent(userId, 'jarvis_wake', { trigger: 'voice', transcript: text.slice(0, 60) })
          }
        }
        r.onend  = () => { if (alive) setTimeout(runWake, 400) }
        r.onerror = () => { if (alive) setTimeout(runWake, 2500) }
        r.start()
        wakeRecogRef.current = r
        setWakeActive(true)
      } catch { if (alive) setTimeout(runWake, 3000) }
    }

    wakeLoopRef.current = runWake
    const tid = setTimeout(runWake, 800)
    return () => { alive = false; clearTimeout(tid); wakeRecogRef.current?.stop(); setWakeActive(false) }
  }, [wakeWordEnabled, userId])

  // Restart wake loop when panel closes
  useEffect(() => {
    if (!open && wakeWordEnabled && wakeLoopRef.current) {
      setTimeout(() => wakeLoopRef.current?.(), 600)
    }
    if (open) wakeRecogRef.current?.stop()
  }, [open, wakeWordEnabled])

  // Activate command listening after wake word triggers panel open
  useEffect(() => {
    if (open && shouldActivateRef.current) {
      shouldActivateRef.current = false
      setTimeout(() => startListening(), 250)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const detectNavigation = useCallback((msg: string): string | null => {
    // Check for "study X" / "graph X" — navigate to knowledge graph for that concept
    const graphMatch = msg.match(GRAPH_CONCEPT_RE)
    if (graphMatch) {
      const concept = graphMatch[1].trim()
      navigate(`/knowledge-graph/${encodeURIComponent(concept)}`)
      logEvent(userId, 'jarvis_navigate', { to: `/knowledge-graph/${concept}`, trigger: 'voice_command', msg: msg.slice(0, 80) })
      return `Knowledge Graph for ${concept}`
    }
    for (const entry of NAV_ROUTES) {
      if (entry.patterns.test(msg)) {
        navigate(entry.route(tutorId))
        logEvent(userId, 'jarvis_navigate', { to: entry.route(tutorId), label: entry.label, trigger: 'command', msg: msg.slice(0, 80) })
        return entry.label
      }
    }
    return null
  }, [navigate, tutorId, userId])

  const handleMessage = useCallback(async (text: string) => {
    if (!text.trim()) return
    setMessages(m => [...m, { role: 'user', text: text.trim() }])
    setState('thinking')
    const navLabel = detectNavigation(text)
    if (navLabel) {
      const reply = `Navigating to ${navLabel} now.`
      setMessages(m => [...m, { role: 'jarvis', text: reply }])
      setState('speaking')
      speak(reply, () => setState('idle'))
      return
    }
    try {
      const res  = await fetch(JARVIS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), context: `User: ${userName || 'unknown'}. ${context}` }),
      })
      const data = await res.json()
      const reply: string = data.reply || "I'm having trouble connecting. Please try again."
      setMessages(m => [...m, { role: 'jarvis', text: reply }])
      setState('speaking')
      speak(reply, () => setState('idle'))
    } catch {
      const fb = "Connection to my servers is temporarily unavailable."
      setMessages(m => [...m, { role: 'jarvis', text: fb }])
      setState('speaking')
      speak(fb, () => setState('idle'))
    }
  }, [detectNavigation, context, userName])

  const startListening = useCallback(() => {
    if (!SR) { handleMessage("Voice recognition isn't supported here. Please type."); return }
    if (state === 'listening') { recogRef.current?.stop(); setState('idle'); return }
    window.speechSynthesis.cancel()
    setState('listening')
    const r = new SR()
    recogRef.current = r
    r.lang = 'en-US'; r.continuous = false; r.interimResults = false
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput(t); setState('thinking'); handleMessage(t)
    }
    r.onerror = () => setState('idle')
    r.onend   = () => setState(p => p === 'listening' ? 'idle' : p)
    r.start()
  }, [state, handleMessage])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    handleMessage(input); setInput('')
  }

  function toggleOpen() {
    setOpen(o => !o)
    if (!open) setState('idle')
    else { window.speechSynthesis.cancel(); recogRef.current?.stop() }
  }

  const CHIPS = [
    { label: 'Study Logs',       msg: 'study logarithms'            },
    { label: 'Knowledge Graph',  msg: 'knowledge graph'             },
    { label: 'Study Techniques', msg: 'take me to study techniques' },
    { label: 'Book Session',     msg: 'navigate to book a session'  },
  ]

  // ── Chat panel (shared between both modes) ──────────────────────────────
  const panel = open && (
    <div className={`${s.panel} ${heroMode ? s.panelHero : ''}`} ref={panelRef}>
      <div className={s.panelHeader}>
        <div className={s.headerOrbSmall}>
          <div className={`${s.orbSmall} ${s[`orb_${state}`]}`}>
            <div className={s.ring1} /><div className={s.ring2} />
            <div className={s.core}>
              {state === 'thinking'
                ? <div className={s.thinkDots}><span/><span/><span/></div>
                : <span className={s.coreJ}>J</span>}
            </div>
            {state === 'speaking' && (
              <div className={s.waveWrap}>
                {[1,2,3,4,5].map(i => <div key={i} className={s.waveBar} style={{ animationDelay:`${i*.08}s` }} />)}
              </div>
            )}
          </div>
        </div>
        <div className={s.headerText}>
          <div className={s.headerName}>JARVIS</div>
          <div className={s.headerStatus}>
            {state === 'idle'      && <><span className={s.dotIdle}/>Online</>}
            {state === 'listening' && <><span className={s.dotListen}/>Listening…</>}
            {state === 'thinking'  && <><span className={s.dotThink}/>Thinking…</>}
            {state === 'speaking'  && <><span className={s.dotSpeak}/>Speaking…</>}
          </div>
        </div>
        <button className={s.closeBtn} onClick={toggleOpen}>✕</button>
      </div>

      <div className={s.chips}>
        {CHIPS.map(c => (
          <button key={c.label} className={s.chip} onClick={() => handleMessage(c.msg)}>{c.label}</button>
        ))}
      </div>

      <div className={s.messages} ref={msgsRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'jarvis' ? s.msgJarvis : s.msgUser}>
            {m.role === 'jarvis' && <span className={s.msgAvatar}>J</span>}
            <div className={s.msgBubble}>{m.text}</div>
          </div>
        ))}
      </div>

      <form className={s.inputRow} onSubmit={submit}>
        <input
          className={s.input}
          placeholder="Ask JARVIS anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={state === 'listening' || state === 'thinking'}
        />
        <button type="button"
          className={`${s.micBtn} ${state === 'listening' ? s.micActive : ''}`}
          onClick={startListening}
        >
          {state === 'listening'
            ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          }
        </button>
        <button type="submit" className={s.sendBtn} disabled={!input.trim()}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
        </button>
      </form>
    </div>
  )

  // ── Hero mode: inline orb with bubbles ─────────────────────────────────
  if (heroMode) {
    return (
      <div className={s.heroWrap}>
        <button className={s.heroOrbBtn} onClick={toggleOpen} aria-label="Open JARVIS">
          {/* Floating bubbles */}
          {BUBBLES.map(([angle, radius, size, delay, dur], i) => {
            const rad = (angle * Math.PI) / 180
            const x   = Math.cos(rad) * radius
            const y   = Math.sin(rad) * radius
            return (
              <span
                key={i}
                className={s.bubble}
                style={{
                  width:  size,
                  height: size,
                  left:   `calc(50% + ${x}px)`,
                  top:    `calc(50% + ${y}px)`,
                  animationDelay:    `${delay}s`,
                  animationDuration: `${dur}s`,
                }}
              />
            )
          })}

          {/* Main orb */}
          <div className={`${s.heroOrb} ${s[`orb_${state}`]} ${open ? s.orbOpen : ''}`}>
            <div className={s.heroRing1} />
            <div className={s.heroRing2} />
            <div className={s.heroRing3} />
            <div className={s.heroCore}>
              {state === 'thinking'
                ? <div className={s.thinkDots}><span/><span/><span/></div>
                : <span className={s.heroCoreJ}>J</span>}
            </div>
            {state === 'speaking' && (
              <div className={s.heroWave}>
                {[1,2,3,4,5,6,7].map(i =>
                  <div key={i} className={s.waveBar} style={{ animationDelay:`${i*.07}s` }} />
                )}
              </div>
            )}
          </div>

          {/* Label */}
          <span className={s.heroLabel}>JARVIS</span>
        </button>

        {panel}
      </div>
    )
  }

  // ── Fixed mode: bottom-right button ────────────────────────────────────
  return (
    <>
      <button
        className={`${s.trigger} ${open ? s.triggerOpen : ''}`}
        onClick={toggleOpen}
        aria-label="JARVIS"
      >
        {wakeActive && !open && <span className={s.wakeDot} title="Wake word active — say 'Jarvis'" />}
        <div className={`${s.triggerOrb} ${s[`orb_${state}`]}`}>
          <div className={s.triggerRing} />
          <div className={s.triggerRing2} />
          {state === 'thinking'
            ? <div className={s.thinkDots}><span/><span/><span/></div>
            : <span className={s.triggerJ}>J</span>}
          {state === 'speaking' && (
            <div className={s.waveWrap}>
              {[1,2,3,4,5].map(i => <div key={i} className={s.waveBar} style={{ animationDelay:`${i*.08}s` }} />)}
            </div>
          )}
        </div>
        <span className={s.triggerLabel}>JARVIS</span>
      </button>
      {panel}
    </>
  )
}
