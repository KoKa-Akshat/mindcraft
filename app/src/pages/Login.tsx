import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

type Role = 'student' | 'parent' | 'tutor'
type Mode = 'signin' | 'signup'

export default function Login() {
  const [role, setRole]       = useState<Role>('student')
  const [mode, setMode]       = useState<Mode>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function friendlyError(code: string) {
    switch (code) {
      case 'auth/user-not-found':        return 'No account found with that email.'
      case 'auth/wrong-password':        return 'Incorrect password. Try again.'
      case 'auth/invalid-credential':    return 'Incorrect email or password.'
      case 'auth/email-already-in-use':  return 'An account with this email already exists.'
      case 'auth/weak-password':         return 'Password must be at least 6 characters.'
      case 'auth/invalid-email':         return 'Please enter a valid email address.'
      case 'auth/too-many-requests':     return 'Too many attempts. Please wait a moment.'
      case 'auth/popup-closed-by-user':  return ''
      default:                           return 'Something went wrong. Please try again.'
    }
  }

  async function handleSubmit() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
      navigate('/dashboard')
    } catch (e: any) {
      setError(friendlyError(e.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      navigate('/dashboard')
    } catch (e: any) {
      const msg = friendlyError(e.code)
      if (msg) setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email address above first.'); return }
    setError('')
    try {
      await sendPasswordResetEmail(auth, email)
      setError('') // clear any old errors
      alert(`Password reset email sent to ${email}`)
    } catch (e: any) {
      setError(friendlyError(e.code))
    }
  }

  return (
    <div className={styles.split}>

      {/* ── LEFT: tree image ── */}
      <div className={styles.left}>
        <img src="../img/tree.jpg" className={styles.leftBg} alt="" />
        <div className={styles.leftOverlay} />
        <a href="../index.html" className={styles.leftLogo}>
          Mind<span>Craft</span>
        </a>
      </div>

      {/* ── RIGHT: form ── */}
      <div className={styles.right}>
        <div className={styles.formWrap}>

          {/* Brand */}
          <div className={styles.rcHero}>
            <div className={styles.rcBrandName}>Mind<span>Craft</span></div>
            <p className={styles.rcTagline}>A Platform for Performance</p>
          </div>

          {/* Role selector */}
          <div className={styles.roleSelector}>
            {(['student', 'parent', 'tutor'] as Role[]).map(r => (
              <button
                key={r}
                className={`${styles.roleOpt} ${role === r ? styles.active : ''}`}
                onClick={() => setRole(r)}
                type="button"
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Forgot password */}
          {mode === 'signin' && (
            <div className={styles.forgot}>
              <button type="button" onClick={handleForgot}>Forgot password?</button>
            </div>
          )}

          {/* Error */}
          {error && <p className={styles.error}>{error}</p>}

          {/* Primary CTA */}
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div className={styles.divider}>or</div>

          {/* Google */}
          <button
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={loading}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle signin/signup */}
          <p className={styles.bottomLink}>
            {mode === 'signin' ? (
              <>New to MindCraft?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError('') }}>
                  Create account
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError('') }}>
                  Sign in
                </button>
              </>
            )}
          </p>

        </div>
      </div>
    </div>
  )
}
