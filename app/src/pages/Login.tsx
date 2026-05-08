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
import { useNavigate } from 'react-router-dom'
import s from './Login.module.css'

type Role = 'student' | 'parent' | 'tutor'
type Mode = 'signin' | 'signup'

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
  const navigate = useNavigate()

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
      navigate(role === 'tutor' ? '/tutor' : '/dashboard', { replace: true })
      return
    }

    if (firestoreRole && firestoreRole !== role) {
      await signOut(auth)
      setError(`This account is registered as a ${firestoreRole}. Please select the "${firestoreRole}" tab.`)
      setLoading(false)
      return
    }

    navigate(firestoreRole === 'tutor' || firestoreRole === 'admin' ? '/tutor' : '/dashboard', { replace: true })
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
      <div className={s.noise} aria-hidden />

      <div className={s.branding}>
        <a href="https://koka-akshat.github.io/mindcraft/" className={s.wordmark}>
          Mind<span>C</span>raft
        </a>
        <p className={s.examPrep}>Personal Exam Prep</p>
      </div>

      <div className={s.cardPane}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <div>
              <h2 className={s.welcome}>
                {mode === 'signin' ? 'Welcome back' : 'Start your map.'}
              </h2>
              <p className={s.cardSub}>
                {mode === 'signin' ? 'Sign in to continue your prep' : 'Create your MindCraft account'}
              </p>
            </div>
            <div className={s.settingsBtn} aria-label="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v3m0 16v3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M1 12h3m16 0h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
              </svg>
            </div>
          </div>

          <div className={s.roleSelector}>
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

          <div className={s.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
            />
          </div>

          <div className={s.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signin' && (
            <div className={s.forgot}>
              <button type="button" onClick={handleForgot}>Forgot password?</button>
            </div>
          )}

          {error && <p className={s.error}>{error}</p>}

          <button className={s.submitBtn} onClick={handleSubmit} disabled={loading} type="button">
            {loading ? 'Please wait…' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>

          <div className={s.divider}>Continue with Google</div>

          <button className={s.googleBtn} onClick={handleGoogle} disabled={loading} type="button">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className={s.bottomLink}>
          {mode === 'signin' ? (
            <>New to MindCraft?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError('') }}>Create account</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
