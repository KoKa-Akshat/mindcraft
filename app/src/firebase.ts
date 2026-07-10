import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU",
  // REVERTED 2026-07-10: switching this to the .web.app domain broke Google
  // Sign-In for everyone (Error 400: redirect_uri_mismatch) — the assumption
  // that Firebase auto-registers the .web.app callback URL with the
  // underlying Google OAuth client's authorized redirect URIs was wrong; that
  // registration is a manual step in Google Cloud Console that was never
  // done. Back to the default that Google's OAuth client actually has
  // whitelisted. The iPad Safari ITP redirect-loop issue this was meant to
  // fix is real but narrower than a total outage — revisit only after
  // manually adding https://mindcraft-93858.web.app/__/auth/handler to the
  // OAuth client's authorized redirect URIs in Google Cloud Console first.
  authDomain:        "mindcraft-93858.firebaseapp.com",
  projectId:         "mindcraft-93858",
  storageBucket:     "mindcraft-93858.firebasestorage.app",
  messagingSenderId: "1024068467805",
  appId:             "1:1024068467805:web:1fed20442356c7b757e1b4",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
void setPersistence(auth, browserLocalPersistence).catch(() => {})
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
