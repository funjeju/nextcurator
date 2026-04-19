// 서버 전용 — API 라우트에서만 import
// firebase-admin 없이 Firestore REST API + 어드민 ID 토큰으로 직접 처리

import type { CurationSettings, CuratedPost } from '@/lib/magazine'
import { initAdminApp } from '@/lib/firebase-admin'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const DEFAULTS: CurationSettings = {
  enabled: false,
  schedule: '1x_daily',
  dailyLimit: 1,
  lookbackDays: 5,
  lastGeneratedAt: '',
  autoPublish: false,
  categoryFilter: [],
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

  // 1차 시도: ID 토큰으로 인증
  // 2차 시도: API Key만으로 (Firestore 규칙이 열려있을 경우)
  const attempts = idToken
    ? [makeHeaders(idToken), makeHeaders(undefined)]
    : [makeHeaders(undefined)]

  let lastError = ''
  for (const headers of attempts) {
    const url = `${BASE}/settings/curation?key=${API_KEY}&${updateMask}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    })
    if (res.ok) return
    const body = await res.text().catch(() => '')
    lastError = `Firestore PATCH failed (${res.status}): ${body}`
    console.error('[saveCurationSettings]', lastError)
  }
  throw new Error(lastError)
}

// ─── Admin SDK 기반 curated_posts 쓰기 (Security Rules 우회) ─────────────────

export async function saveCuratedPostAdmin(
  post: Omit<CuratedPost, 'id' | 'viewCount' | 'likeCount'>
): Promise<string> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const id = `mag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await db.collection('curated_posts').doc(id).set({ ...post, id, viewCount: 0, likeCount: 0 })
  return id
}

export async function publishCuratedPostAdmin(id: string) {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  await db.collection('curated_posts').doc(id).update({
    status: 'published',
    publishedAt: new Date().toISOString(),
  })
}

export async function saveCurationSettingsAdmin(settings: Partial<CurationSettings>) {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  await db.collection('settings').doc('curation').set(settings, { merge: true })
}

export async function getPostBySlugAdmin(slug: string): Promise<CuratedPost | null> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const snap = await db.collection('curated_posts').where('slug', '==', slug).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0].data() as CuratedPost
}

export async function incrementPostViewAdmin(id: string) {
  initAdminApp()
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
  const db = getFirestore()
  await db.collection('curated_posts').doc(id).update({ viewCount: FieldValue.increment(1) })
}

export interface PlatformComment {
  text: string
  segmentLabel: string | null
  parentId: string | null
}

export async function getPlatformCommentsBySessionIdAdmin(sessionId: string): Promise<PlatformComment[]> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const snap = await db.collection('comments').where('sessionId', '==', sessionId).get()
  return snap.docs
    .map(d => d.data())
    .filter(c => !c.isAI && typeof c.text === 'string' && c.text.trim())
    .map(c => ({
      text: c.text as string,
      segmentLabel: (c.segmentLabel as string | null) ?? null,
      parentId: (c.parentId as string | null) ?? null,
    }))
}

export async function getSummaryBySessionIdAdmin(sessionId: string): Promise<import('@/lib/magazine').SummaryForCuration | null> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const snap = await db.collection('saved_summaries').where('sessionId', '==', sessionId).limit(1).get()
  if (snap.empty) return null
  const data = snap.docs[0].data()
  const id = snap.docs[0].id
  const meta = data.square_meta ?? {}
  return {
    id,
    sessionId: data.sessionId ?? '',
    videoId: data.videoId ?? '',
    title: data.title ?? '',
    channel: data.channel ?? meta.channel ?? '',
    thumbnail: data.thumbnail ?? meta.thumbnail ?? '',
    category: data.category ?? meta.category ?? 'learning',
    topicCluster: data.topicCluster ?? meta.topicCluster ?? '',
    tags: data.tags ?? meta.tags ?? [],
    contextSummary: data.contextSummary ?? '',
    reportSummary: data.reportSummary ?? '',
    summarizedAt: data.createdAt ?? '',
    videoPublishedAt: data.videoPublishedAt ?? '',
    ytViewCount: data.ytViewCount ?? meta.ytViewCount ?? 0,
    postedToMagazine: data.postedToMagazine ?? false,
  }
}

export async function listCuratedPostsAdmin(): Promise<CuratedPost[]> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const snap = await db.collection('curated_posts').orderBy('createdAt', 'desc').limit(50).get()
  return snap.docs.map(d => d.data() as CuratedPost)
}

export async function getRelatedPostsAdmin(
  category: string,
  excludeId: string,
  limit = 3,
): Promise<CuratedPost[]> {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  const db = getFirestore()

  // 같은 카테고리 우선
  const snap = await db.collection('curated_posts')
    .where('status', '==', 'published')
    .where('category', '==', category)
    .orderBy('publishedAt', 'desc')
    .limit(limit + 1)
    .get()

  const same = snap.docs.map(d => d.data() as CuratedPost).filter(p => p.id !== excludeId)

  if (same.length >= limit) return same.slice(0, limit)

  // 부족하면 최신 발행 글로 채움
  const rest = await db.collection('curated_posts')
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .limit(limit + 5)
    .get()

  const fallback = rest.docs
    .map(d => d.data() as CuratedPost)
    .filter(p => p.id !== excludeId && !same.find(s => s.id === p.id))

  return [...same, ...fallback].slice(0, limit)
}
