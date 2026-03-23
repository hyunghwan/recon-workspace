import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthContextValue = {
  ready: boolean
  user: User | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthSession() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthProvider.')
  }

  return context
}
