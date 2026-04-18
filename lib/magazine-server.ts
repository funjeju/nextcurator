import { initAdminApp } from '@/lib/firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'
import type { CurationSettings } from '@/lib/magazine'

initAdminApp()
function adminDb() { return getFirestore() }

const SETTINGS_DEFAULTS: CurationSettings = {
  enabled: false,
  schedule: '3x_weekly',
  minVideoCount: 5,
  maxVideoCount: 8,
  lookbackDays: 3,
  lastGeneratedAt: '',
  autoPublish: false,
}

export async function getCurationSettings(): Promise<CurationSettings> {
  try {
    const snap = await adminDb().collection('settings').doc('curation').get()
    if (!snap.exists) return { ...SETTINGS_DEFAULTS }
    return { ...SETTINGS_DEFAULTS, ...snap.data() } as CurationSettings
  } catch {
    return { ...SETTINGS_DEFAULTS }
  }
}

export async function saveCurationSettings(settings: Partial<CurationSettings>) {
  await adminDb().collection('settings').doc('curation').set(settings, { merge: true })
}
