import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  browserPopupRedirectResolver,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import s from './Login.module.css'
import { worldUrl } from '../lib/siteUrls'

type Role = 'student' | 'parent' | 'tutor'
type Mode = 'signin' | 'signup'
/** Separate admin flow: passcode step → sign in → grant admin once. */
type AdminFlow = 'auth' | 'passcode' | 'armed'

function isAdminPasscodeValid(passcode: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSCODE
  return !!(expected && passcode.length > 0 && passcode === expected)
}

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (raw.startsWith('/login')) return null
  return raw
}

function friendlyError(code: string) {
  switch (code) {
    case 'auth/user-not-found':             return 'No account found with that email.'
    case 'auth/wrong-password':             return 'Incorrect password. Try again.'
    case 'auth/invalid-credential':         return 'Incorrect email or password.'
    case 'auth/invalid-login-credentials':  return 'Incorrect email or password.'
    case 'auth/account-exists-with-different-credential': return 'This email is linked to a different sign-in method. Try Google.'
    case 'auth/email-already-in-use':       return 'An account with this email already exists.'
    case 'auth/weak-password':              return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':              return 'Please enter a valid email address.'
    case 'auth/too-many-requests':          return 'Too many attempts. Please wait a moment.'
    case 'auth/popup-closed-by-user':       return ''
    case 'auth/popup-blocked':              return 'Pop-up was blocked. Allow pop-ups for this site.'
    case 'auth/unauthorized-domain':        return 'This site isn’t authorized for sign-in. Use http://localhost:5173 locally, or add your domain in Firebase Console → Authentication → Settings → Authorized domains.'
    case 'auth/operation-not-allowed':     return 'Google sign-in isn’t enabled for this project.'
    case 'auth/network-request-failed':     return 'Network error. Check your connection.'
    default:                                return `Login failed (${code}). Please try again.`
  }
}

export default function Login() {
  const [role, setRole]         = useState<Role>('student')
  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [adminFlow, setAdminFlow] = useState<AdminFlow>('auth')
  const [adminPasscode, setAdminPasscode] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))

  function navigateAfterRole(effectiveRole: string) {
    if (effectiveRole === 'tutor' || effectiveRole === 'admin') {
      navigate('/tutor', { replace: true })
    } else if (returnTo) {
      navigate(returnTo, { replace: true })
    } else {
      window.location.href = worldUrl(auth.currentUser!.uid)
    }
  }

  async function routeAfterLogin(uid: string, isNewUser = false) {
    await auth.currentUser?.getIdToken(true)
    const grantAdmin = adminFlow === 'armed'
    if (grantAdmin) setAdminFlow('auth')

    const snap = await getDoc(doc(db, 'users', uid))
    const firestoreRole = snap.data()?.role

    if (isNewUser) {
      const signupRole = grantAdmin ? 'admin' : role
      await setDoc(doc(db, 'users', uid), {
        role: signupRole,
        email: auth.currentUser?.email ?? '',
        displayName: auth.currentUser?.displayName ?? '',
        createdAt: new Date().toISOString(),
      })
      navigateAfterRole(signupRole)
      return
    }

    if (grantAdmin) {
      await setDoc(doc(db, 'users', uid), { role: 'admin' }, { merge: true })
      navigateAfterRole('admin')
      return
    }

    if (firestoreRole && firestoreRole !== role && firestoreRole !== 'admin' && firestoreRole !== 'tutor') {
      await signOut(auth)
      setError(`This account is registered as a ${firestoreRole}. Please select the "${firestoreRole}" tab.`)
      setLoading(false)
      return
    }

    if (firestoreRole === 'tutor' || firestoreRole === 'admin') {
      navigate('/tutor', { replace: true })
    } else if (returnTo) {
      navigate(returnTo, { replace: true })
    } else {
      window.location.href = worldUrl(uid)
    }
  }

  async function handleSubmit() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        await routeAfterLogin(cred.user.uid, false)
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await routeAfterLogin(cred.user.uid, true)
      }
    } catch (e: any) {
      setError(friendlyError(e.code ?? e.message ?? 'unknown'))
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
      const isNew = cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime
      await routeAfterLogin(cred.user.uid, isNew)
    } catch (e: any) {
      const msg = friendlyError(e.code ?? e.message ?? 'unknown')
      if (msg) setError(msg)
      setLoading(false)
    }
  }

  function verifyAdminPasscode() {
    setError('')
    if (!isAdminPasscodeValid(adminPasscode)) return
    setAdminPasscode('')
    setAdminFlow('armed')
  }

  function cancelAdminFlow() {
    setAdminPasscode('')
    setAdminFlow('auth')
    setError('')
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email address above first.'); return }
    try {
      await sendPasswordResetEmail(auth, email)
      alert(`Password reset email sent to ${email}`)
    } catch (e: any) {
      setError(friendlyError(e.code))
    }
  }

  return (
    <div className={s.page}>
      <div className={s.ambientMap} aria-hidden="true">
        <span className={`${s.mapDot} ${s.dotOne}`} />
        <span className={`${s.mapDot} ${s.dotTwo}`} />
        <span className={`${s.mapDot} ${s.dotThree}`} />
      </div>
      <main className={s.shell}>
        <div className={s.layout}>
          <section className={s.heroPanel} aria-label="MindCraft parent learning plan">
            <div className={s.heroContent}>
              <div className={s.heroIntro}>
                <div className={s.wordmark}>
                  <span className={s.wmMind}>Mind</span><span className={s.wmCraft}>Craft</span>
                </div>
                <h1 className={s.heroTitle}>Stop guessing what math help should do next.</h1>
                <p className={s.heroCopy}>
                  MindCraft maps where your child stands, routes the next skill to practice, and connects tutoring to the plan so progress feels visible.
                </p>
              </div>

              <div className={s.valueSection}>
                <div className={s.brushArt} aria-hidden="true">
                  <span className={s.brushWash} />
                  <span className={s.brushPeakOne} />
                  <span className={s.brushPeakTwo} />
                </div>
                <div className={s.valueGrid} aria-label="MindCraft benefits">
              <article className={s.valueCard}>
                <span className={s.valueIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 19V5h10a4 4 0 0 1 4 4v10H9a4 4 0 0 0-4 0Z" />
                    <path d="M9 7v9" />
                    <path d="M13 7v9" />
                  </svg>
                </span>
                <strong>Gap map</strong>
                <p>See the weak spots behind missed questions.</p>
              </article>
              <article className={s.valueCard}>
                <span className={s.valueIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3a4 4 0 0 1 4 4c0 2.2-1.8 4-4 4S8 9.2 8 7a4 4 0 0 1 4-4Z" />
                    <path d="M5 21a7 7 0 0 1 14 0" />
                    <path d="M18.5 9.5h2.5" />
                    <path d="M19.75 8.25v2.5" />
                  </svg>
                </span>
                <strong>Next route</strong>
                <p>Know what your child should do next.</p>
              </article>
              <article className={s.valueCard}>
                <span className={s.valueIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="7" cy="7" r="2.5" />
                    <circle cx="17" cy="7" r="2.5" />
                    <circle cx="12" cy="17" r="2.5" />
                    <path d="M9.2 8.5 10.8 15" />
                    <path d="m14.8 8.5-1.6 6.5" />
                    <path d="M9.5 7h5" />
                  </svg>
                </span>
                <strong>Tutor context</strong>
                <p>Make live help start from the real gap.</p>
              </article>
              </div>
              </div>

              <blockquote className={s.quote}>
                Parents deserve more than hope and hourly tutoring bills.
              </blockquote>
            </div>
          </section>

          <aside className={s.loginWrap}>
            <div className={s.cardStack}>
              <div className={s.cardShadow} aria-hidden="true" />
              <div className={s.card}>
                <div className={s.formHeader}>
                  <div className={s.formIntro}>
                    <p className={s.formKicker}>
                      {adminFlow === 'passcode' ? 'Admin access' : mode === 'signin' ? 'Welcome back' : 'Begin with clarity'}
                    </p>
                    <h2>
                      {adminFlow === 'passcode'
                        ? 'Enter your admin code.'
                        : mode === 'signin' ? 'Continue the learning plan.' : 'Create your MindCraft plan.'}
                    </h2>
                  </div>
                  <span className={s.secureBadge} aria-label="Secure sign in">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3 19 6v5c0 4.5-2.9 8.4-7 10-4.1-1.6-7-5.5-7-10V6l7-3Z" />
                      <path d="m9.5 12 1.7 1.7 3.6-4" />
                    </svg>
                  </span>
                </div>

                {adminFlow === 'passcode' ? (
                  <form
                    className={s.form}
                    onSubmit={(e) => { e.preventDefault(); verifyAdminPasscode() }}
                  >
                    <div className={s.field}>
                      <label htmlFor="adminPasscode">Admin passcode</label>
                      <div className={s.inputShell}>
                        <span className={s.inputIcon} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <rect x="5" y="10" width="14" height="10" rx="2" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                        <input
                          id="adminPasscode"
                          type="password"
                          placeholder="Enter code"
                          value={adminPasscode}
                          onChange={e => setAdminPasscode(e.target.value)}
                          autoComplete="off"
                          autoFocus
                        />
                      </div>
                    </div>
                    <button className={s.submitBtn} type="submit" disabled={!adminPasscode.trim()}>
                      <span>Continue</span>
                      <span aria-hidden="true">-&gt;</span>
                    </button>
                    <p className={s.bottomLink}>
                      <button type="button" onClick={cancelAdminFlow}>Back to sign in</button>
                    </p>
                  </form>
                ) : (
                  <>
                {adminFlow === 'armed' && (
                  <p className={s.formKicker} style={{ marginBottom: 16, textAlign: 'center' }}>
                    Code accepted — sign in below to activate admin access.{' '}
                    <button type="button" onClick={cancelAdminFlow}>Cancel</button>
                  </p>
                )}

                <div className={s.roleSelector} aria-label="Select your role">
                  {(['student', 'parent', 'tutor'] as Role[]).map(r => (
                    <button
                      key={r}
                      className={`${s.roleOpt} ${role === r ? s.active : ''}`}
                      onClick={() => setRole(r)}
                      type="button"
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>

                <form className={s.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
                  <div className={s.field}>
                    <label htmlFor="email">Email</label>
                    <div className={s.inputShell}>
                      <span className={s.inputIcon} aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M4 6.5h16v11H4z" />
                          <path d="m5 7 7 6 7-6" />
                        </svg>
                      </span>
                      <input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className={s.field}>
                    <label htmlFor="password">Password</label>
                    <div className={s.inputShell}>
                      <span className={s.inputIcon} aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <rect x="5" y="10" width="14" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      </span>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      />
                      <button
                        className={s.revealBtn}
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {mode === 'signin' && (
                    <div className={s.forgot}>
                      <button type="button" onClick={handleForgot}>Forgot password?</button>
                    </div>
                  )}

                  {error && <p className={s.error}>{error}</p>}

                  <button className={s.submitBtn} disabled={loading} type="submit">
                    <span>{loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}</span>
                    <span aria-hidden="true">-&gt;</span>
                  </button>
                </form>

                <div className={s.divider}><span>or</span></div>

                <button
                  className={s.googleBtn}
                  onClick={handleGoogle}
                  disabled={loading}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <p className={s.bottomLink}>
                  {mode === 'signin' ? (
                    <>New to MindCraft?{' '}
                      <button type="button" onClick={() => { setMode('signup'); setError('') }}>Create account -&gt;</button>
                    </>
                  ) : (
                    <>Already have an account?{' '}
                      <button type="button" onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
                    </>
                  )}
                </p>

                {adminFlow === 'auth' && (
                  <p className={s.bottomLink}>
                    <button type="button" onClick={() => { setAdminFlow('passcode'); setAdminPasscode(''); setError('') }}>
                      Have an admin code?
                    </button>
                  </p>
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
        Built for parents who want clearer math progress, not more guessing.
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
