import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU",
  authDomain:        "mindcraft-93858.firebaseapp.com",
  projectId:         "mindcraft-93858",
  storageBucket:     "mindcraft-93858.firebasestorage.app",
  messagingSenderId: "1024068467805",
  appId:             "1:1024068467805:web:1fed20442356c7b757e1b4",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
