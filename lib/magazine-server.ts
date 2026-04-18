// 서버 전용 — API 라우트에서만 import
// firebase-admin 없이 Firestore REST API + 어드민 ID 토큰으로 직접 처리

import type { CurationSettings } from '@/lib/magazine'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const DEFAULTS: CurationSettings = {
  enabled: false,
  schedule: '3x_weekly',
  minVideoCount: 5,
  maxVideoCount: 8,
  lookbackDays: 3,
  lastGeneratedAt: '',
  autoPublish: false,
}

// ─── Firestore 타입 변환 ─────────────────────────────────────────────────────

type FV = { stringValue?: string; integerValue?: string; booleanValue?: boolean; doubleValue?: number; nullValue?: null; mapValue?: { fields?: Record<string, FV> }; arrayValue?: { values?: FV[] } }

function toFV(v: unknown): FV {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'string')  return { stringValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, FV> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function fromFV(v: FV): unknown {
  if ('booleanValue'  in v) return v.booleanValue
  if ('integerValue'  in v) return Number(v.integerValue)
  if ('doubleValue'   in v) return v.doubleValue
  if ('stringValue'   in v) return v.stringValue
  if ('nullValue'     in v) return null
  if ('arrayValue'    in v) return (v.arrayValue?.values ?? []).map(fromFV)
  if ('mapValue'      in v) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v.mapValue?.fields ?? {})) out[k] = fromFV(val)
    return out
  }
  return null
}

function makeHeaders(idToken?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (idToken) h['Authorization'] = `Bearer ${idToken}`
  return h
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getCurationSettings(idToken?: string): Promise<CurationSettings> {
  try {
    const res = await fetch(`${BASE}/settings/curation?key=${API_KEY}`, {
      headers: makeHeaders(idToken),
    })
    if (!res.ok) return { ...DEFAULTS }
    const doc = await res.json()
    if (!doc.fields) return { ...DEFAULTS }
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(doc.fields as Record<string, FV>)) data[k] = fromFV(v)
    return { ...DEFAULTS, ...data } as CurationSettings
  } catch (e) {
    console.error('[getCurationSettings]', e)
    return { ...DEFAULTS }
  }
}

export async function saveCurationSettings(settings: Partial<CurationSettings>, idToken?: string) {
  const fields: Record<string, FV> = {}
  for (const [k, v] of Object.entries(settings)) fields[k] = toFV(v)

  const updateMask = Object.keys(settings).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const url = `${BASE}/settings/curation?key=${API_KEY}&${updateMask}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: makeHeaders(idToken),
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Firestore PATCH failed (${res.status}): ${body}`)
  }
}
