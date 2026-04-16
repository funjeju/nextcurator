import { db } from './firebase'
import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore'

export interface TravelRegion {
  id: string
  userId: string
  name: string
  emoji: string
  spotCount: number
  createdAt: any
}

export interface TravelSpot {
  id: string
  userId: string
  regionId: string
  name: string
  address?: string
  description?: string
  thumbnail?: string
  sourceType: 'youtube' | 'manual'
  sourceVideoId?: string
  sourceSessionId?: string
  videoTimestamp?: string
  visited: boolean
  createdAt: any
}

// ── 지역 폴더 ──────────────────────────────────────────────────────────────────

export async function getRegions(userId: string): Promise<TravelRegion[]> {
  const q = query(
    collection(db, 'travel_regions'),
    where('userId', '==', userId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TravelRegion))
  return list.sort((a, b) => {
    const at = a.createdAt?.seconds ?? 0
    const bt = b.createdAt?.seconds ?? 0
    return bt - at
  })
}

export async function createRegion(userId: string, name: string, emoji = '📍'): Promise<string> {
  const ref = await addDoc(collection(db, 'travel_regions'), {
    userId,
    name,
    emoji,
    spotCount: 0,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function renameRegion(regionId: string, name: string, emoji: string): Promise<void> {
  await updateDoc(doc(db, 'travel_regions', regionId), { name, emoji })
}

export async function deleteRegion(regionId: string): Promise<void> {
  const spotsSnap = await getDocs(
    query(collection(db, 'travel_spots'), where('regionId', '==', regionId)),
  )
  const batch = writeBatch(db)
  spotsSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'travel_regions', regionId))
  await batch.commit()
}

// ── 스팟 ───────────────────────────────────────────────────────────────────────

export async function getSpots(userId: string, regionId: string): Promise<TravelSpot[]> {
  const q = query(
    collection(db, 'travel_spots'),
    where('userId', '==', userId),
    where('regionId', '==', regionId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TravelSpot))
  return list.sort((a, b) => {
    const at = a.createdAt?.seconds ?? 0
    const bt = b.createdAt?.seconds ?? 0
    return at - bt
  })
}

export async function addSpot(
  userId: string,
  regionId: string,
  spot: Omit<TravelSpot, 'id' | 'userId' | 'regionId' | 'visited' | 'createdAt'>,
): Promise<string> {
  const [ref] = await Promise.all([
    addDoc(collection(db, 'travel_spots'), {
      ...spot,
      userId,
      regionId,
      visited: false,
      createdAt: serverTimestamp(),
    }),
    updateDoc(doc(db, 'travel_regions', regionId), { spotCount: increment(1) }),
  ])
  return ref.id
}

export async function deleteSpot(spotId: string, regionId: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, 'travel_spots', spotId)),
    updateDoc(doc(db, 'travel_regions', regionId), { spotCount: increment(-1) }),
  ])
}

export async function toggleVisited(spotId: string, visited: boolean): Promise<void> {
  await updateDoc(doc(db, 'travel_spots', spotId), { visited })
}
