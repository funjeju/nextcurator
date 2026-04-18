import { initializeApp, getApps, cert } from 'firebase-admin/app'

export function initAdminApp() {
  if (getApps().length > 0) return
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error('[firebase-admin] Missing env vars:', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey })
    throw new Error('Firebase Admin credentials not configured')
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}
