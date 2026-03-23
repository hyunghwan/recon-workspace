import { useEffect, useRef, useState, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue } from '@/auth/auth-session'
import {
  clearPendingAuthAction,
  clearRedirectInFlight,
  completeRedirectSignIn,
  consumeAuthIntentFromUrl,
  consumePostAuthPath,
  describeAuthError,
  executePendingAuthIntent,
  observeAuthState,
  readPendingAuthAction,
  readRedirectInFlight,
} from '@/auth'
import { firebaseAuth } from '@/firebase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>({
    user: null,
    ready: !firebaseAuth,
  })
  const [redirectResultReady, setRedirectResultReady] = useState(!firebaseAuth)
  const authActionStartedRef = useRef(false)

  useEffect(() => {
    if (!firebaseAuth) return

    consumeAuthIntentFromUrl(Boolean(firebaseAuth.currentUser))

    let cancelled = false

    completeRedirectSignIn()
      .catch((error) => {
        console.error('Firebase redirect sign-in failed:', describeAuthError(error))
      })
      .finally(() => {
        if (!cancelled) {
          setRedirectResultReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!firebaseAuth) return

    const unsubscribe = observeAuthState((nextUser) => {
      setState({
        user: nextUser,
        ready: true,
      })

      if (!nextUser) return

      clearPendingAuthAction()
      clearRedirectInFlight()
      authActionStartedRef.current = false

      const destination = consumePostAuthPath()
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (destination && currentPath !== destination) {
        window.location.replace(destination)
      }
    })

    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!state.ready || !redirectResultReady) return
    if (state.user) {
      clearPendingAuthAction()
      return
    }

    const pendingAuthAction = readPendingAuthAction()
    if (!pendingAuthAction) return
    if (readRedirectInFlight()) return
    if (authActionStartedRef.current) return

    authActionStartedRef.current = true
    const signInAttempt = executePendingAuthIntent()
    if (!signInAttempt) {
      authActionStartedRef.current = false
      return
    }

    void signInAttempt.catch((error) => {
      authActionStartedRef.current = false
      console.error('Firebase sign-in failed:', describeAuthError(error))
    })
  }, [redirectResultReady, state.ready, state.user])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
