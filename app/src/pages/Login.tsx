import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))

  async function routeAfterLogin(uid: string, isNewUser = false) {
    await auth.currentUser?.getIdToken(true)
    const snap = await getDoc(doc(db, 'users', uid))
    const firestoreRole = snap.data()?.role

    if (isNewUser) {
      await setDoc(doc(db, 'users', uid), {
        role,
        email: auth.currentUser?.email ?? '',
        displayName: auth.currentUser?.displayName ?? '',
        createdAt: new Date().toISOString(),
      })
      if (role === 'tutor') {
        navigate('/tutor', { replace: true })
      } else if (returnTo) {
        navigate(returnTo, { replace: true })
      } else {
        window.location.href = worldUrl(uid)
      }
      return
    }

    if (firestoreRole && firestoreRole !== role) {
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
      const cred = await signInWithPopup(auth, googleProvider)
      const isNew = cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime
      await routeAfterLogin(cred.user.uid, isNew)
    } catch (e: any) {
      const msg = friendlyError(e.code ?? e.message ?? 'unknown')
      if (msg) setError(msg)
      setLoading(false)
    }
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
          <section className={s.heroPanel} aria-label="MindCraft private learning studio">
            <div className={s.orbitArt} aria-hidden="true">
              <span className={s.orbitRing} />
              <span className={s.orbitRingSmall} />
            </div>
            <div className={s.wordmark}>
              <span className={s.wmMind}>Mind</span><span className={s.wmCraft}>Craft</span>
            </div>
            <p className={s.eyebrow}>Private AI tutoring studio</p>
            <h1 className={s.heroTitle}>Your calmer way into math mastery.</h1>
            <p className={s.heroCopy}>
              MindCraft turns practice, tutoring, and progress into one clear learning plan, so students know what to work on next and parents can trust the path.
            </p>

            <div className={s.valueGrid} aria-label="MindCraft benefits">
              <article className={s.valueCard}>
                <span className={s.valueIcon}>01</span>
                <strong>Learning GPS</strong>
                <p>A focused route through weak spots, next concepts, and exam-ready practice.</p>
              </article>
              <article className={s.valueCard}>
                <span className={s.valueIcon}>02</span>
                <strong>Human guidance</strong>
                <p>Tutors and AI tools work around the same student picture, not scattered notes.</p>
              </article>
              <article className={s.valueCard}>
                <span className={s.valueIcon}>03</span>
                <strong>Visible progress</strong>
                <p>Students see momentum build through mastery, sessions, and better habits.</p>
              </article>
            </div>

            <blockquote className={s.quote}>
              "A better plan makes a calmer learner."
            </blockquote>
          </section>

          <aside className={s.loginWrap}>
            <div className={s.cardStack}>
              <div className={s.cardShadow} aria-hidden="true" />
              <div className={s.card}>
                <div className={s.formIntro}>
                  <p className={s.formKicker}>{mode === 'signin' ? 'Welcome back' : 'Begin your plan'}</p>
                  <h2>{mode === 'signin' ? 'Continue your learning plan.' : 'Create your MindCraft studio.'}</h2>
                  <p>{mode === 'signin' ? 'Pick your role and step back into your roadmap.' : 'Choose your role and we will shape the first path around you.'}</p>
                </div>

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
                        placeholder="student@mindcraft.ai"
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

                <p className={s.trustLine}>Trusted by students, parents, and tutors building calmer math confidence.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
