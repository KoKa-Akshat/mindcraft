/**
 * First-login welcome ritual: Namaste (Nepali-inspired crimson/blue ocean),
 * then a short role-specific welcome. Once per uid+role.
 */

import { useEffect, useState } from 'react'
import s from './WelcomeRitual.module.css'

export type WelcomeRole = 'student' | 'tutor' | 'parent'

const STORAGE_PREFIX = 'mc-welcome-ritual:'

const COPY: Record<WelcomeRole, { title: string; body: string }> = {
  student: {
    title: 'Welcome',
    body: 'You took the first step. Your map is waiting, and you do not start from zero.',
  },
  tutor: {
    title: 'Welcome',
    body: 'One place to know your students, prepare in sixty seconds, and teach with continuity.',
  },
  parent: {
    title: 'Welcome',
    body: 'We will keep you close to the progress without making you the math teacher.',
  },
}

export function welcomeRitualSeen(uid: string, role: WelcomeRole): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${uid}:${role}`) === '1'
  } catch {
    return true
  }
}

export function markWelcomeRitualSeen(uid: string, role: WelcomeRole) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${uid}:${role}`, '1')
  } catch {
    /* ignore */
  }
}

type Props = {
  uid: string
  role: WelcomeRole
  onDone: () => void
}

export default function WelcomeRitual({ uid, role, onDone }: Props) {
  const [slide, setSlide] = useState<0 | 1>(0)
  const copy = COPY[role]

  useEffect(() => {
    if (slide !== 0) return
    const t = window.setTimeout(() => setSlide(1), 2000)
    return () => window.clearTimeout(t)
  }, [slide])

  useEffect(() => {
    if (slide !== 1) return
    const t = window.setTimeout(() => finish(), 3200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide])

  function finish() {
    markWelcomeRitualSeen(uid, role)
    onDone()
  }

  return (
    <div className={s.shell} role="dialog" aria-label="Welcome">
      <div className={s.ocean} aria-hidden="true">
        <div className={s.crimson} />
        <div className={s.blue} />
        <div className={s.mist} />
      </div>

      {slide === 0 ? (
        <div className={`${s.panel} ${s.panelIn}`}>
          <p className={s.namaste}>Namaste</p>
        </div>
      ) : (
        <div className={`${s.panel} ${s.panelIn}`}>
          <p className={s.kicker}>{copy.title}</p>
          <p className={s.message}>{copy.body}</p>
          <button type="button" className={s.continue} onClick={finish}>
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
