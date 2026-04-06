import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

// ─────────────────────────────────────────────────────────────
// STEP: Go to console.firebase.google.com
//   1. Create a project called "mindcraft"
//   2. Add a Web app (click </> icon)
//   3. Copy the firebaseConfig object values below
//   4. In Authentication → Sign-in method, enable:
//        • Email/Password
//        • Google
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "PASTE_HERE",
  authDomain:        "PASTE_HERE",
  projectId:         "PASTE_HERE",
  storageBucket:     "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId:             "PASTE_HERE",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
