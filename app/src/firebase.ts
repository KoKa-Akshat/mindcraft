import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU",
  // Same-origin as Firebase Hosting so the OAuth redirect handshake never
  // crosses a third-party domain -- fixes the iPad Safari ITP redirect loop
  // (sign-in bouncing back to /login). This was tried once before and
  // reverted because it broke Google Sign-In for EVERYONE (Error 400:
  // redirect_uri_mismatch) -- that happened because the .web.app callback
  // URL was never registered with the underlying Google OAuth client's
  // authorized redirect URIs. Confirmed this time, before flipping it back:
  // (1) https://mindcraft-93858.web.app/__/auth/handler is now manually added
  // to the OAuth client's authorized redirect URIs in Google Cloud Console
  // (2026-07-10), alongside the existing .firebaseapp.com one -- both work
  // now, neither was removed; (2) verified via curl that Firebase Hosting
  // actually serves /__/auth/handler and /__/auth/iframe with 200 on the
  // .web.app domain, matching the .firebaseapp.com baseline.
  authDomain:        "mindcraft-93858.web.app",
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
