const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// JS 값 → Firestore REST 필드 변환
export function toFirestoreFields(obj: unknown): Record<string, unknown> {
  if (obj === null || obj === undefined) return {}
  if (typeof obj !== 'object' || Array.isArray(obj)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = toFirestoreValue(v)
  }
  return out
}

function toFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v) } }
  return { stringValue: String(v) }
}

// Firestore REST 필드 → JS 값 변환
export function fromFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v as Record<string, unknown>)
  }
  return out
}

function fromFirestoreValue(v: Record<string, unknown>): unknown {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) {
    const arr = v.arrayValue as { values?: unknown[] }
    return (arr.values ?? []).map(i => fromFirestoreValue(i as Record<string, unknown>))
  }
  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> }
    return map.fields ? fromFirestoreFields(map.fields) : {}
  }
  return null
}

export async function runFirestoreQuery(collectionId: string, structuredQuery: any) {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
  console.log(`[FirestoreREST] Querying ${collectionId} (url: ${url.slice(0, 50)}...)`)
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...structuredQuery } }),
    cache: 'no-store' // 캐시 방지
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[FirestoreREST] ❌ Query failed (${res.status}):`, errorText)
    throw new Error(`Query failed: ${res.status}`)
  }

  const results = await res.json()
  if (!Array.isArray(results)) {
    console.error('[FirestoreREST] ❌ Expected array but got:', results)
    return []
  }

  console.log(`[FirestoreREST] ✅ Query successful, count: ${results.length}`)
  return results
    .filter((r: any) => r.document)
    .map((r: any) => ({ 
      id: r.document.name.split('/').pop(), 
      ...fromFirestoreFields(r.document.fields) 
    }))
}
