import { db } from './firebase'
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore'

export interface SavedItinerarySlot {
  time: string
  spotName: string
  activity: string
  tip?: string
  isRecommended?: boolean
}
export interface SavedItineraryDay {
  day: number
  date?: string
  summary: string
  slots: SavedItinerarySlot[]
}
export interface SavedItinerary {
  id: string
  userId: string
  regionName: string
  regionEmoji: string
  startDate: string
  endDate: string
  nights: number
  days: number
  mode: 'spots_only' | 'with_recommendations'
  result: {
    days: SavedItineraryDay[]
    overall_tip: string
    accommodation_suggestion?: string | null
    transport_tips?: string
  }
  createdAt: any
}

export async function getSavedItineraries(userId: string): Promise<SavedItinerary[]> {
  const q = query(
    collection(db, 'travel_itineraries'),
    where('userId', '==', userId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedItinerary))
  return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export async function saveItinerary(
  userId: string,
  data: Omit<SavedItinerary, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'travel_itineraries'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteItinerary(id: string): Promise<void> {
  await deleteDoc(doc(db, 'travel_itineraries', id))
}
