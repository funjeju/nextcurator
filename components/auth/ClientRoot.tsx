'use client'

import ProfileSetupModal from './ProfileSetupModal'

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProfileSetupModal />
    </>
  )
}
