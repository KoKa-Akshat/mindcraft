import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}

const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /articles/{articleId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /sessions/{sessionId} {
      allow read: if request.auth != null && (
        resource.data.studentId == request.auth.uid ||
        resource.data.studentEmail == request.auth.token.email ||
        resource.data.tutorId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth != null && (
        request.resource.data.tutorId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow update: if request.auth != null && (
        resource.data.tutorId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow delete: if request.auth != null && (
        resource.data.tutorId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );

      match /messages/{messageId} {
        allow read, write: if request.auth != null && (
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.studentId == request.auth.uid ||
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.studentEmail == request.auth.token.email ||
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.tutorId == request.auth.uid
        );
      }
    }

    match /chats/{chatId} {
      allow read, write: if request.auth != null && (
        chatId.split('_')[0] == request.auth.uid ||
        chatId.split('_')[1] == request.auth.uid
      );
      match /messages/{messageId} {
        allow read, write: if request.auth != null && (
          chatId.split('_')[0] == request.auth.uid ||
          chatId.split('_')[1] == request.auth.uid
        );
      }
    }

    match /transcripts/{transcriptId} {
      allow read: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'tutor' ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow write: if false;
    }
  }
}
`.trim()

const STORAGE_RULES = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chat-files/{chatId}/{allPaths=**} {
      allow read, write: if request.auth != null && (
        chatId.split('_')[0] == request.auth.uid ||
        chatId.split('_')[1] == request.auth.uid
      );
    }
    match /sessions/{sessionId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`.trim()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')
  if (req.body?.secret !== process.env.ANTHROPIC_API_KEY?.slice(-8)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const app = getApps()[0]
    const credential = (app as any).options.credential
    const token = await credential.getAccessToken()
    const accessToken = token.access_token
    const projectId = 'mindcraft-93858'

    // Deploy Firestore rules
    const fsRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { files: [{ name: 'firestore.rules', content: FIRESTORE_RULES }] }
        }),
      }
    )
    const fsData = await fsRes.json()
    if (!fsRes.ok) return res.status(500).json({ error: 'Firestore ruleset failed', detail: fsData })
    const fsRulesetName = fsData.name

    // Release Firestore rules
    const fsReleaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: fsRulesetName } }),
      }
    )
    const fsReleaseData = await fsReleaseRes.json()

    // Deploy Storage rules
    const stRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { files: [{ name: 'storage.rules', content: STORAGE_RULES }] }
        }),
      }
    )
    const stData = await stRes.json()
    if (!stRes.ok) return res.status(500).json({ error: 'Storage ruleset failed', detail: stData })
    const stRulesetName = stData.name

    const storageBucket = `${projectId}.firebasestorage.app`
    const storageReleaseName = `firebase.storage/${storageBucket}`

    // Try to patch existing release; if 404, create it
    let stReleaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${encodeURIComponent(storageReleaseName)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: { name: `projects/${projectId}/releases/${storageReleaseName}`, rulesetName: stRulesetName } }),
      }
    )
    if (stReleaseRes.status === 404) {
      stReleaseRes = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `projects/${projectId}/releases/${storageReleaseName}`, rulesetName: stRulesetName }),
        }
      )
    }
    const stReleaseData = await stReleaseRes.json()

    return res.status(200).json({
      ok: true,
      firestoreRelease: fsReleaseData,
      storageRelease: stReleaseData,
    })
  } catch (err: any) {
    console.error('deploy-rules error:', err)
    return res.status(500).json({ error: err?.message })
  }
}
