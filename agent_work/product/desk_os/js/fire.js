/**
 * fire.js · Desk OS's bridge to the real MindCraft Firebase backend.
 *
 * Desk OS is a static shell with no bundler, so this loads the Firebase v10
 * modular SDK straight from the gstatic CDN, pinned to the same major.minor
 * the React app ships ("firebase": "^10.12.0" in app/package.json). The web
 * config below is copied from app/src/firebase.ts (the source of truth); a
 * Firebase web config is public client configuration, not a secret, it is
 * embedded in the built React bundle already.
 *
 * Why this works with zero sign-in UI here: Desk OS is served from the SAME
 * ORIGIN as the React app (Vite dev server locally, Firebase Hosting in
 * prod). The React app persists its auth session with browserLocalPersistence
 * (IndexedDB, keyed by apiKey and appId, shared across paths on one origin),
 * so getAuth() on this page silently restores the very session the student
 * signed in with over on /login. No second login, no token handoff in URLs.
 *
 * Everything is loaded lazily via dynamic import on first use, so the gate
 * and the unauthenticated /try/desk marketing demo never pay the SDK's
 * download cost, and a blocked CDN degrades to the static demo data instead
 * of breaking the page.
 */

const CDN = 'https://www.gstatic.com/firebasejs/10.12.0';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU',
  authDomain: 'mindcraft-93858.web.app',
  projectId: 'mindcraft-93858',
  storageBucket: 'mindcraft-93858.firebasestorage.app',
  messagingSenderId: '1024068467805',
  appId: '1:1024068467805:web:1fed20442356c7b757e1b4',
};

/** @type {Promise<object | null> | null} */
let firePromise = null;

/**
 * Load the SDK, init the app, and resolve the restored auth state once.
 * Resolves to `{ app, auth, db, user, fx }` where `fx` is the whole
 * firestore module namespace (collection, query, onSnapshot, ...), or to
 * `null` when the SDK cannot load at all (offline demo, blocked CDN).
 * `user` is the restored Firebase user or null when nobody is signed in.
 */
export function ensureFire() {
  if (firePromise) return firePromise;
  firePromise = (async () => {
    try {
      const [appMod, authMod, fx] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
      ]);
      const app = appMod.getApps().length
        ? appMod.getApps()[0]
        : appMod.initializeApp(FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      const db = fx.getFirestore(app);
      // First emission of auth state = "restore finished", signed in or not.
      const user = await new Promise((resolve) => {
        const stop = authMod.onAuthStateChanged(
          auth,
          (u) => { stop(); resolve(u); },
          () => { stop(); resolve(null); },
        );
      });
      return { app, auth, db, user, fx };
    } catch {
      return null;
    }
  })();
  return firePromise;
}

/** Convenience: the restored signed-in user, or null (demo / SDK missing). */
export async function fireUser() {
  const fire = await ensureFire();
  return fire?.user || null;
}
