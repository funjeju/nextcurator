'use client'

import ProfileSetupModal from './ProfileSetupModal'
import AuthModal from './AuthModal'

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProfileSetupModal />
      <AuthModal />
    </>
  )
}
