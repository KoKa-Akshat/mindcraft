import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU",
  // Same-origin as Firebase Hosting (not the default .firebaseapp.com) so the
  // OAuth redirect handshake never crosses a third-party domain — Safari ITP
  // was wiping the pending-redirect state mid-flow on iPad, bouncing sign-in
  // back to /login. Firebase Hosting auto-proxies /__/auth/* for this domain
  // since it's the same project's Hosting site; no console/DNS change needed.
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
