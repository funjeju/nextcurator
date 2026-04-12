import { Suspense } from 'react'
import RoomClient from './RoomClient'

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#1c1a18] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
      </div>
    }>
      <RoomClient roomId={params.roomId} />
    </Suspense>
  )
}
