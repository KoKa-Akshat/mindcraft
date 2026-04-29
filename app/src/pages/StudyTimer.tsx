import { useEffect, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

import s from './StudyTimer.module.css'

// ── Technique definitions ─────────────────────────────────────────────────────

interface Technique {
  id:          string
  name:        string
  tagline:     string
  science:     string
  emoji:       string
  color:       string
  glow:        string
  focus:       number   // minutes
  shortBreak:  number
  longBreak:   number
  sessions:    number   // focus rounds before long break
  customizable: boolean
}

const TECHNIQUES: Technique[] = [
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    tagline: '25 min focus · 5 min break',
    science: 'Developed by Francesco Cirillo in the 1980s. Short focus bursts prevent mental fatigue and build momentum through small wins.',
    emoji: '🍅',
    color: '#E74C3C',
    glow:  'rgba(231,76,60,0.18)',
    focus: 25, shortBreak: 5, longBreak: 15, sessions: 4,
    customizable: true,
  },
  {
    id: '5217',
    name: '52 / 17',
    tagline: '52 min focus · 17 min break',
    science: 'Discovered in DeskTime data from 5.3M users. The top 10% most productive workers naturally settled on this exact ratio.',
    emoji: '📊',
    color: '#27AE60',
    glow:  'rgba(39,174,96,0.18)',
    focus: 52, shortBreak: 17, longBreak: 30, sessions: 3,
    customizable: false,
  },
  {
    id: 'ultradian',
    name: 'Ultradian',
    tagline: '90 min focus · 20 min break',
    science: 'Based on Kleitman\'s Basic Rest-Activity Cycle. Your brain naturally oscillates in 90-minute alertness waves throughout the day.',
    emoji: '🌊',
    color: '#8E44AD',
    glow:  'rgba(142,68,173,0.18)',
    focus: 90, shortBreak: 20, longBreak: 30, sessions: 2,
    customizable: false,
  },
  {
    id: 'deepwork',
    name: 'Deep Work',
    tagline: '90 min blocks · no distractions',
    science: 'Cal Newport\'s framework for cognitively demanding work. Extended uninterrupted blocks build the concentration muscle over time.',
    emoji: '🔱',
    color: '#0069FF',
    glow:  'rgba(0,105,255,0.18)',
    focus: 90, shortBreak: 15, longBreak: 30, sessions: 2,
    customizable: true,
  },
  {
    id: 'flowtime',
    name: 'Flowtime',
    tagline: 'Flow until ready · then rest',
    science: 'Matches Csikszentmihalyi\'s flow state research. You break when YOU choose, not a timer — preserving deep concentration when it\'s working.',
    emoji: '🎯',
    color: '#F59E0B',
    glow:  'rgba(245,158,11,0.18)',
    focus: 0, shortBreak: 0, longBreak: 0, sessions: 0,  // manual — no auto-advance
    customizable: false,
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'focus' | 'break' | 'longBreak'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

// ── Main component ────────────────────────────────────────────────────────────

export default function StudyTimer() {
  const user     = useUser()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<Technique | null>(null)
  const [customFocus, setCustomFocus] = useState(25)
  const [customBreak, setCustomBreak] = useState(5)
  const [showCustom,  setShowCustom]  = useState(false)

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />
      <main className={s.page}>
        {selected
          ? <TimerView
              technique={selected}
              customFocus={customFocus}
              customBreak={customBreak}
              onBack={() => setSelected(null)}
            />
          : <PickerView
              onSelect={t => {
                if (t.customizable) { setCustomFocus(t.focus || 25); setCustomBreak(t.shortBreak || 5); setShowCustom(false) }
                setSelected(t)
              }}
              showCustom={showCustom}
              setShowCustom={setShowCustom}
              customFocus={customFocus}
              customBreak={customBreak}
              setCustomFocus={setCustomFocus}
              setCustomBreak={setCustomBreak}
            />
        }
      </main>
    </div>
  )
}

// ── Picker ────────────────────────────────────────────────────────────────────

function PickerView({ onSelect, showCustom, setShowCustom, customFocus, customBreak, setCustomFocus, setCustomBreak }: {
  onSelect: (t: Technique) => void
  showCustom: boolean
  setShowCustom: (v: boolean) => void
  customFocus: number
  customBreak: number
  setCustomFocus: (v: number) => void
  setCustomBreak: (v: number) => void
}) {
  return (
    <div className={s.picker}>
      <div className={s.pickerHeader}>
        <h1 className={s.pickerTitle}>Study Techniques</h1>
        <p className={s.pickerSub}>Choose a method that fits how your brain works today.</p>
      </div>
      <div className={s.cards}>
        {TECHNIQUES.map(t => (
          <div
            key={t.id}
            className={s.techCard}
            style={{ '--tc': t.color, '--tg': t.glow } as React.CSSProperties}
            onClick={() => onSelect(t)}
          >
            <div className={s.techEmoji}>{t.emoji}</div>
            <div className={s.techName}>{t.name}</div>
            <div className={s.techTagline}>{t.tagline}</div>
            <p className={s.techScience}>{t.science}</p>
            <div className={s.techCta} style={{ color: t.color }}>
              Start session →
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function TimerView({ technique, customFocus, customBreak, onBack }: {
  technique:   Technique
  customFocus: number
  customBreak: number
  onBack:      () => void
}) {
  const isFlowtime = technique.id === 'flowtime'
  const focusMins  = technique.customizable ? customFocus : (technique.focus || 25)
  const breakMins  = technique.customizable ? customBreak : (technique.shortBreak || 5)

  const [mode, setMode]         = useState<Mode>('focus')
  const [running, setRunning]   = useState(false)
  const [secondsLeft, setSec]   = useState(focusMins * 60)
  const [elapsed, setElapsed]   = useState(0)    // for flowtime: counts up
  const [session, setSession]   = useState(1)
  const [completed, setComp]    = useState(0)
  const [flipping, setFlip]     = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { color, glow } = technique

  const totalSec = mode === 'focus'
    ? focusMins * 60
    : mode === 'break'
      ? breakMins * 60
      : (technique.longBreak || breakMins) * 60

  const progress = isFlowtime
    ? Math.min(elapsed / (focusMins * 60), 1)
    : 1 - secondsLeft / totalSec

  // tick
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current!); return }
    intervalRef.current = setInterval(() => {
      if (isFlowtime) {
        setElapsed(e => e + 1)
      } else {
        setSec(s => {
          if (s <= 1) { clearInterval(intervalRef.current!); handlePhaseEnd(); return 0 }
          return s - 1
        })
      }
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [running, mode])

  function handlePhaseEnd() {
    setRunning(false)
    setFlip(true)
    setTimeout(() => {
      setFlip(false)
      if (mode === 'focus') {
        const nc = completed + 1
        setComp(nc)
        const isLong = technique.sessions > 0 && nc % technique.sessions === 0
        const next: Mode = isLong ? 'longBreak' : 'break'
        setMode(next)
        setSec((isLong ? technique.longBreak : breakMins) * 60)
      } else {
        setSession(n => n + 1)
        setMode('focus')
        setSec(focusMins * 60)
      }
    }, 700)
  }

  function flowBreak() {
    setRunning(false)
    setFlip(true)
    const restSecs = Math.round(elapsed / 5)   // ~1/5 of focus time
    setTimeout(() => {
      setFlip(false)
      setMode('break')
      setElapsed(0)
      setSec(restSecs)
      setComp(c => c + 1)
    }, 700)
  }

  function flowResume() {
    setMode('focus')
    setElapsed(0)
    setSec(focusMins * 60)
    setRunning(false)
    setSession(n => n + 1)
  }

  function reset() {
    setRunning(false)
    setMode('focus')
    setSec(focusMins * 60)
    setElapsed(0)
    setComp(0)
    setSession(1)
  }

  // display time
  let displaySec = isFlowtime ? elapsed : secondsLeft
  if (isFlowtime && mode === 'break') displaySec = secondsLeft
  const mins = Math.floor(displaySec / 60)
  const secs = displaySec % 60

  const modeLabel = mode === 'focus'
    ? (isFlowtime ? 'IN FLOW' : 'FOCUS')
    : mode === 'break' ? (isFlowtime ? 'REST TIME' : 'SHORT BREAK')
    : 'LONG BREAK'

  // sand geometry (SVG viewBox 0 0 100 200)
  const topH      = 84
  const botH      = 84
  const topShift  = progress * topH
  const botFillH  = progress * botH
  const botY      = 192 - botFillH

  const longSessions = technique.sessions || 4

  return (
    <div className={s.center}>
      {/* Back */}
      <button className={s.backBtn} onClick={onBack}>
        ← All Techniques
      </button>

      {/* Phase badge */}
      <div className={s.phaseBadge} style={{ color, borderColor: color, background: `${color}18` }}>
        <span className={s.phaseDot} style={{ background: color }} />
        {modeLabel} · {technique.name}
      </div>

      {/* Hourglass */}
      <div className={s.glassWrap} style={{ '--glow': glow } as React.CSSProperties}>
        <svg
          viewBox="0 0 100 200"
          className={`${s.hourglass} ${flipping ? s.flip : ''}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="topClip2">
              <polygon points="10,8 90,8 56,92 44,92" />
            </clipPath>
            <clipPath id="botClip2">
              <polygon points="44,108 56,108 90,192 10,192" />
            </clipPath>
            <linearGradient id="sandGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="glassGrad2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.01)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.07)" />
            </linearGradient>
          </defs>

          <polygon points="10,8 90,8 56,92 44,92" fill="rgba(10,37,64,0.25)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <polygon points="44,108 56,108 90,192 10,192" fill="rgba(10,37,64,0.25)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <rect x="44" y="92" width="12" height="16" fill="rgba(10,37,64,0.35)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          <g clipPath="url(#topClip2)">
            <rect x="10" y={8 + topShift} width="80" height={Math.max(0, topH - topShift)} fill="url(#sandGrad2)" />
            <rect x="10" y={8 + topShift} width="80" height="4" fill="rgba(255,255,255,0.15)" rx="1" />
          </g>
          <g clipPath="url(#botClip2)">
            <rect x="10" y={botY} width="80" height={botFillH} fill="url(#sandGrad2)" />
          </g>

          <polygon points="10,8 90,8 56,92 44,92" fill="url(#glassGrad2)" pointerEvents="none" />
          <polygon points="44,108 56,108 90,192 10,192" fill="url(#glassGrad2)" pointerEvents="none" />

          {running && progress < 0.98 && [0, 1, 2].map(i => (
            <circle key={i} cx="50" r="1.2" fill={color} opacity="0.8"
              className={s.sandDrop} style={{ animationDelay: `${i * 0.13}s` }} />
          ))}
        </svg>
      </div>

      {/* Time */}
      <div className={s.timeDisplay} style={{ color }}>
        {isFlowtime && mode === 'focus' ? '+' : ''}{pad(mins)}<span className={s.colon}>:</span>{pad(secs)}
      </div>

      {/* Session dots */}
      <div className={s.dots}>
        {Array.from({ length: longSessions }).map((_, i) => (
          <span key={i} className={s.dot}
            style={{ background: i < (completed % longSessions) ? color : 'rgba(0,0,0,0.08)' }} />
        ))}
      </div>
      <div className={s.sessionLabel}>Session {session}</div>

      {/* Controls */}
      <div className={s.controls}>
        <button className={s.btnRound} onClick={reset} title="Reset" aria-label="Reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>

        {isFlowtime && mode === 'focus' && running ? (
          <button
            className={s.btnPlay}
            style={{ background: color, boxShadow: `0 6px 0 ${color}88, 0 4px 24px ${color}55` }}
            onClick={flowBreak}
            title="Take a break"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        ) : isFlowtime && mode === 'break' ? (
          <button
            className={s.btnPlay}
            style={{ background: color, boxShadow: `0 6px 0 ${color}88, 0 4px 24px ${color}55` }}
            onClick={flowResume}
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        ) : (
          <button
            className={s.btnPlay}
            style={{ background: color, boxShadow: `0 6px 0 ${color}88, 0 4px 24px ${color}55` }}
            onClick={() => setRunning(r => !r)}
          >
            {running
              ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            }
          </button>
        )}

        <button className={s.btnRound} onClick={() => !isFlowtime && handlePhaseEnd()} title="Skip" aria-label="Skip" style={{ opacity: isFlowtime ? 0.3 : 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>

      {isFlowtime && (
        <p className={s.flowtimeHint}>
          {mode === 'focus'
            ? running ? 'Hit pause when you naturally lose focus.' : 'Start your flow. Pause whenever you\'re ready to rest.'
            : 'Rest up — resume when you\'re recharged.'
          }
        </p>
      )}
    </div>
  )
}
