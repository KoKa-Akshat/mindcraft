import { useEffect, useState } from 'react'
import FourierCanvas from '../components/FourierCanvas'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isTestProfileEmail, resetStudentProfile } from '../lib/testProfile'
import { loginBlockedForMs, recordLoginFailure, clearLoginFailures } from '../lib/inputGuards'
import { isDiagnosticComplete } from '../lib/practiceState'
import { WEBHOOK_BASE } from '../lib/mlApi'
import s from './Login.module.css'

type AdminFlow = 'auth' | 'passcode' | 'armed'
const ADMIN_GRANT_PENDING_KEY = 'mc_admin_grant_pending'

function isAdminPasscodeValid(p: string) {
  const expected = import.meta.env.VITE_ADMIN_PASSCODE
  return !!(expected && p.length > 0 && p === expected)
}
function armAdminGrant()      { sessionStorage.setItem(ADMIN_GRANT_PENDING_KEY, '1') }
function consumeAdminGrant()  { const v = sessionStorage.getItem(ADMIN_GRANT_PENDING_KEY) === '1'; sessionStorage.removeItem(ADMIN_GRANT_PENDING_KEY); return v }
function clearAdminGrant()    { sessionStorage.removeItem(ADMIN_GRANT_PENDING_KEY) }

/** iPad / iPhone only — redirect is required there; desktop popup is more reliable. */
function preferGoogleRedirect() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function safeReturnPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) return null
  return raw
}

async function grantAdminRole() {
  const token = await auth.currentUser?.getIdToken(true)
  if (!token) throw new Error('Not authorized')

  const res = await fetch(`${WEBHOOK_BASE}/api/grant-admin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Not authorized')
  }
}

function friendlyError(code: string) {
  switch (code) {
    case 'auth/user-not-found':             return 'No account found with that email.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':  return 'That password did not match a password account. If this is your Google email, continue with Google above.'
    case 'auth/account-exists-with-different-credential': return 'This email is already linked to Google. Continue with Google above.'
    case 'auth/email-already-in-use':       return 'That email already has an account. If you used Google before, continue with Google above.'
    case 'auth/weak-password':              return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':              return 'Please enter a valid email address.'
    case 'auth/too-many-requests':          return 'Too many attempts. Please wait a moment.'
    case 'auth/popup-closed-by-user':       return ''
    case 'auth/popup-blocked':              return 'Sign-in could not open. Tap Continue with Google again — we will use a full-page sign-in.'
    case 'auth/network-request-failed':     return 'Network error. Check your connection.'
    default:                                return `Sign-in failed (${code}). Please try again.`
  }
}

export default function Login() {
  const [emailMode, setEmailMode] = useState(false)      // show email form toggle
  const [isSignup,  setIsSignup]  = useState(false)
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [adminFlow, setAdminFlow] = useState<AdminFlow>('auth')
  const [adminPw,   setAdminPw]   = useState('')
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_GRANT_PENDING_KEY) === '1') setAdminFlow('armed')
  }, [])

  useEffect(() => {
    let cancelled = false
    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result?.user) return
        setLoading(true)
        setError('')
        await routeAfterLogin(result.user.uid)
      })
      .catch((e: { code?: string; message?: string }) => {
        if (cancelled) return
        const msg = friendlyError(e.code ?? e.message ?? 'unknown')
        if (msg) setError(msg)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function routeAfterLogin(uid: string) {
    try {
      await auth.currentUser?.getIdToken(true)

      // Test accounts start fresh on every login — never block routing on the wipe.
      if (isTestProfileEmail(auth.currentUser?.email)) {
        void resetStudentProfile(uid)
      }

      const grantAdmin = consumeAdminGrant()
      if (grantAdmin) setAdminFlow('auth')

      const snap = await getDoc(doc(db, 'users', uid))
      const existingRole = snap.data()?.role

      // Admin grant takes priority
      if (grantAdmin) {
        try {
          await grantAdminRole()
        } catch {
          setError('Not authorized.')
          navigate('/dashboard', { replace: true })
          return
        }
        navigate('/admin', { replace: true })
        return
      }

      // No Firestore doc (new user, or doc was deleted) → create as student
      if (!snap.exists() || !existingRole) {
        await setDoc(doc(db, 'users', uid), {
          role: 'student',
          email: auth.currentUser?.email ?? '',
          displayName: auth.currentUser?.displayName ?? '',
          createdAt: new Date().toISOString(),
        }, { merge: true })
        if (!returnTo) {
          const done = await isDiagnosticComplete(uid)
          if (!done) {
            navigate('/onboard?entry=1', { replace: true })
            return
          }
        }
        navigate(returnTo ?? '/dashboard', { replace: true })
        return
      }

      // Route based on existing role
      if (existingRole === 'admin') {
        navigate('/admin', { replace: true })
      } else if (existingRole === 'tutor') {
        navigate('/tutor', { replace: true })
      } else if (existingRole === 'parent') {
        navigate('/parent', { replace: true })
      } else {
        if (!returnTo) {
          const done = await isDiagnosticComplete(uid)
          if (!done) {
            navigate('/onboard?entry=1', { replace: true })
            return
          }
        }
        navigate(returnTo ?? '/dashboard', { replace: true })
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      const message = (e as { message?: string })?.message
      setError(friendlyError(code ?? message ?? 'unknown') || 'Sign-in succeeded but routing failed. Please try again.')
      setLoading(false)
    }
  }

  async function handleEmailSubmit() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    const blockedMs = loginBlockedForMs()
    if (blockedMs > 0) {
      setError(`Too many attempts. Try again in ${Math.ceil(blockedMs / 1000)}s.`)
      return
    }
    setError('')
    setLoading(true)
    try {
      const cred = isSignup
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password)
      clearLoginFailures()
      await routeAfterLogin(cred.user.uid)
    } catch (e: any) {
      recordLoginFailure()
      setError(friendlyError(e.code ?? e.message ?? 'unknown'))
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      if (preferGoogleRedirect()) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      const cred = await signInWithPopup(auth, googleProvider)
      await routeAfterLogin(cred.user.uid)
    } catch (e: any) {
      if (e?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider)
          return
        } catch (redirectErr: any) {
          const msg = friendlyError(redirectErr.code ?? redirectErr.message ?? 'unknown')
          if (msg) setError(msg)
          setLoading(false)
          return
        }
      }
      const msg = friendlyError(e.code ?? e.message ?? 'unknown')
      if (msg) setError(msg)
      setLoading(false)
    }
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email address first.'); return }
    try {
      await sendPasswordResetEmail(auth, email)
      alert(`Password reset email sent to ${email}`)
    } catch (e: any) {
      setError(friendlyError(e.code))
    }
  }

  function verifyAdminPasscode() {
    setError('')
    if (!isAdminPasscodeValid(adminPw)) { setError('Incorrect passcode.'); return }
    setAdminPw('')
    armAdminGrant()
    setAdminFlow('armed')
  }

  return (
    <div className={s.page}>
      <main className={s.shell}>
        <div className={s.layout}>

          {/* Left hero panel */}
          <section className={s.heroPanel} aria-label="MindCraft">
            <FourierCanvas className={s.fourierBg} />
            <div className={s.heroContent}>
              <div className={s.heroIntro}>
                <div className={s.wordmark}>
                  <span className={s.wmMind}>Mind</span><span className={s.wmCraft}>Craft</span>
                </div>
                <h1 className={s.heroTitle}>Come back to your map.</h1>
                <p className={s.heroCopy}>
                  Pick up where you left off, see the next step, and keep math feeling possible.
                </p>
              </div>
            </div>
          </section>

          {/* Right sign-in panel */}
          <aside className={s.loginWrap}>
            <div className={s.cardStack}>
              <div className={s.cardShadow} aria-hidden="true" />
              <div className={s.card}>

                {/* Admin passcode step */}
                {adminFlow === 'passcode' ? (
                  <>
                    <div className={s.formHeader}>
                      <div className={s.formIntro}>
                        <p className={s.formKicker}>Admin access</p>
                        <h2>Enter your admin code.</h2>
                      </div>
                    </div>
                    <form className={s.form} onSubmit={e => { e.preventDefault(); verifyAdminPasscode() }}>
                      <div className={s.field}>
                        <label htmlFor="adminPw">Admin passcode</label>
                        <div className={s.inputShell}>
                          <span className={s.inputIcon} aria-hidden="true">
                            <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                          </span>
                          <input id="adminPw" type="password" placeholder="Enter code" value={adminPw}
                            onChange={e => setAdminPw(e.target.value)} autoComplete="off" autoFocus />
                        </div>
                      </div>
                      {error && <p className={s.error}>{error}</p>}
                      <button className={s.submitBtn} type="submit" disabled={!adminPw.trim()}>
                        <span>Continue</span><span aria-hidden="true">-&gt;</span>
                      </button>
                      <p className={s.bottomLink}><button type="button" onClick={() => { clearAdminGrant(); setAdminPw(''); setAdminFlow('auth'); setError('') }}>Back to sign in</button></p>
                    </form>
                  </>
                ) : (
                  <>
                    <div className={s.formHeader}>
                      <div className={s.formIntro}>
                        <p className={s.formKicker}>
                          {adminFlow === 'armed' ? 'Admin access ready' : 'Welcome'}
                        </p>
                        <h2>
                          {adminFlow === 'armed' ? 'Sign in to activate admin.' : isSignup ? 'Create your account.' : 'Sign in to continue.'}
                        </h2>
                      </div>
                      <span className={s.secureBadge} aria-label="Secure sign in">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3 19 6v5c0 4.5-2.9 8.4-7 10-4.1-1.6-7-5.5-7-10V6l7-3Z" />
                          <path d="m9.5 12 1.7 1.7 3.6-4" />
                        </svg>
                      </span>
                    </div>

                    {adminFlow === 'armed' && (
                      <p className={s.formKicker} style={{ marginBottom: 16, textAlign: 'center' }}>
                        Code accepted.{' '}
                        <button type="button" onClick={() => { clearAdminGrant(); setAdminFlow('auth') }}>Cancel</button>
                      </p>
                    )}

                    {error && <p className={s.error}>{error}</p>}

                    {/* PRIMARY: Google button */}
                    <button className={s.googleBtn} onClick={handleGoogle} disabled={loading} type="button">
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
                    </button>
                    <p className={s.authHint}>
                      Use this for any Gmail or account you originally created with Google.
                    </p>

                    {emailMode && (
                      <>
                        <div className={s.divider}><span>password account</span></div>
                        <p className={s.emailNote}>
                          Only use this if you created a MindCraft password. Google accounts do not use this password box.
                        </p>
                        <form className={s.form} onSubmit={e => { e.preventDefault(); handleEmailSubmit() }}>
                          <div className={s.field}>
                            <label htmlFor="email">Email</label>
                            <div className={s.inputShell}>
                              <span className={s.inputIcon} aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M4 6.5h16v11H4z" /><path d="m5 7 7 6 7-6" /></svg>
                              </span>
                              <input id="email" type="email" placeholder="you@email.com"
                                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                            </div>
                          </div>
                          <div className={s.field}>
                            <label htmlFor="password">Password</label>
                            <div className={s.inputShell}>
                              <span className={s.inputIcon} aria-hidden="true">
                                <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                              </span>
                              <input id="password" type={showPw ? 'text' : 'password'}
                                placeholder="Password" value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete={isSignup ? 'new-password' : 'current-password'} />
                              <button className={s.revealBtn} type="button"
                                onClick={() => setShowPw(v => !v)}
                                aria-label={showPw ? 'Hide password' : 'Show password'}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                                  <circle cx="12" cy="12" r="2.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!isSignup && (
                            <div className={s.forgot}><button type="button" onClick={handleForgot}>Forgot password?</button></div>
                          )}
                          <button className={s.submitBtn} disabled={loading} type="submit">
                            <span>{loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</span>
                            <span aria-hidden="true">-&gt;</span>
                          </button>
                        </form>
                        <p className={s.bottomLink}>
                          {isSignup
                            ? <><span>Have an account? </span><button type="button" onClick={() => { setIsSignup(false); setError('') }}>Sign in</button></>
                            : <><span>New here? </span><button type="button" onClick={() => { setIsSignup(true); setError('') }}>Create account</button></>
                          }
                          <br />
                          <button type="button" onClick={() => { setEmailMode(false); setIsSignup(false); setError('') }}>Back to Google sign in</button>
                        </p>
                      </>
                    )}
                  </>
                )}

              </div>
            </div>
          </aside>
        </div>
      </main>

      <p className={s.pageTrust}>
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3 19 6v5c0 4.5-2.9 8.4-7 10-4.1-1.6-7-5.5-7-10V6l7-3Z" />
            <path d="m9.5 12 1.7 1.7 3.6-4" />
          </svg>
        </span>
        Trusted by students and parents building calmer math confidence.
      </p>
      <div className={s.socialLinks} aria-label="MindCraft social links">
        <a href="https://www.instagram.com/joinmindcraft/" target="_blank" rel="noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" /></svg>
        </a>
        <a href="https://x.com/joinmindcraft" target="_blank" rel="noreferrer" aria-label="X">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-4.71-6.23-5.4 6.23H2.75l7.73-8.84L1.25 2.25h6.83l4.25 5.62Zm-1.16 17.52h1.83L7.08 4.13H5.12Z" /></svg>
        </a>
        <a href="https://open.spotify.com/playlist/3P9VnnuuoRYLKQB3QYCSe2" target="_blank" rel="noreferrer" aria-label="Spotify">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.31a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 0 1-.33-1.46c4.57-1.04 8.5-.58 11.66 1.35.36.22.47.68.25 1.02Zm1.46-3.25a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.55-11.96-1.4a.94.94 0 1 1-.54-1.8c4.36-1.32 9.78-.68 13.48 1.59.44.27.58.85.31 1.3Zm.13-3.39C15.22 8.37 8.83 8.16 5.15 9.28a1.12 1.12 0 1 1-.65-2.14c4.23-1.28 11.28-1.03 15.74 1.62a1.12 1.12 0 0 1-1.15 1.91Z" /></svg>
        </a>
        <a href="https://www.linkedin.com/in/mind-craft-64354641a/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.32 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.53V9H7.1v11.45ZM22.23 0H1.76C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.76 24h20.47c.97 0 1.77-.77 1.77-1.73V1.73C24 .77 23.2 0 22.23 0Z" /></svg>
        </a>
      </div>
    </div>
  )
}
