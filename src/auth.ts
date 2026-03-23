import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'

import { firebaseAuth, googleProvider } from './firebase'

export const pendingAuthActionKey = 'recon-pending-auth-action'
export const postAuthPathKey = 'recon-post-auth-path'
export const redirectInFlightKey = 'recon-redirect-in-flight'
export const postAuthAppActionKey = 'recon-post-auth-app-action'

export type GoogleSignInMode = 'default' | 'import'

export type BeginGoogleSignInOptions = {
  returnTo?: string
  mode?: GoogleSignInMode
  forceRedirect?: boolean
}

export type PendingAuthAction = {
  createdAt: string
  flowId: string
  forceRedirect: boolean
  mode: GoogleSignInMode
  returnTo: string
}

export type PostAuthAppAction = 'show_import'

type ConsumedAuthIntent = {
  consumed: boolean
  pendingAuthAction: PendingAuthAction | null
  postAuthAppAction: PostAuthAppAction | null
}

function parseStoredJson<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeStoredJson(key: string, value: unknown) {
  window.sessionStorage.setItem(key, JSON.stringify(value))
}

function popupShouldFallbackToRedirect(error: unknown) {
  if (!(error instanceof Error) || !('code' in error)) return false
  const code = String((error as Error & { code?: string }).code ?? '')
  return code === 'auth/popup-blocked' || code === 'auth/web-storage-unsupported'
}

function normalizeReturnTo(returnTo?: string) {
  const fallback = '/app'

  if (typeof window === 'undefined') {
    return returnTo || fallback
  }

  try {
    const url = new URL(returnTo || fallback, window.location.origin)
    if (url.origin !== window.location.origin) {
      return fallback
    }

    const pathname = url.pathname === '/' ? fallback : url.pathname
    const searchParams = new URLSearchParams(url.search)
    searchParams.delete('signin')
    searchParams.delete('intent')
    const search = searchParams.toString()

    return `${pathname}${search ? `?${search}` : ''}${url.hash || ''}`
  } catch {
    return fallback
  }
}

function setPostAuthState(input: { mode: GoogleSignInMode; returnTo: string }) {
  window.sessionStorage.setItem(postAuthPathKey, input.returnTo)

  if (input.mode === 'import' && !input.returnTo.includes('/imports')) {
    window.sessionStorage.setItem(postAuthAppActionKey, 'show_import')
    return
  }

  window.sessionStorage.removeItem(postAuthAppActionKey)
}

export function describeAuthError(error: unknown) {
  return error instanceof Error ? error.message : 'Google sign-in failed'
}

export function observeAuthState(callback: (user: User | null) => void) {
  if (!firebaseAuth) return null
  return onAuthStateChanged(firebaseAuth, callback)
}

export function consumeAuthIntentFromUrl(isAuthenticated: boolean): ConsumedAuthIntent {
  const currentUrl = new URL(window.location.href)
  const wantsSignIn = currentUrl.searchParams.get('signin') === 'google'
  const wantsImport = currentUrl.searchParams.get('intent') === 'import'

  if (!wantsSignIn && !wantsImport) {
    return {
      consumed: false,
      pendingAuthAction: null,
      postAuthAppAction: null,
    }
  }

  const mode: GoogleSignInMode = wantsImport ? 'import' : 'default'
  const sanitizedReturnTo = normalizeReturnTo(`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  setPostAuthState({
    mode,
    returnTo: sanitizedReturnTo,
  })

  if (`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` !== sanitizedReturnTo) {
    window.history.replaceState({}, '', sanitizedReturnTo)
  }

  const postAuthAppAction = (window.sessionStorage.getItem(postAuthAppActionKey) as PostAuthAppAction | null) ?? null

  if (isAuthenticated) {
    window.sessionStorage.removeItem(pendingAuthActionKey)
    return {
      consumed: true,
      pendingAuthAction: null,
      postAuthAppAction,
    }
  }

  const pendingAuthAction: PendingAuthAction = {
    createdAt: new Date().toISOString(),
    flowId: crypto.randomUUID(),
    forceRedirect: false,
    mode,
    returnTo: sanitizedReturnTo,
  }

  writeStoredJson(pendingAuthActionKey, pendingAuthAction)

  return {
    consumed: true,
    pendingAuthAction,
    postAuthAppAction,
  }
}

export function prepareAppDestination(options: Pick<BeginGoogleSignInOptions, 'mode' | 'returnTo'> = {}) {
  const mode = options.mode ?? 'default'
  const returnTo = normalizeReturnTo(options.returnTo)

  if (mode === 'import' && !returnTo.includes('/imports')) {
    window.sessionStorage.setItem(postAuthAppActionKey, 'show_import')
  } else {
    window.sessionStorage.removeItem(postAuthAppActionKey)
  }

  return returnTo
}

export function readPendingAuthAction() {
  return parseStoredJson<PendingAuthAction>(pendingAuthActionKey)
}

export function clearPendingAuthAction() {
  window.sessionStorage.removeItem(pendingAuthActionKey)
}

export function readRedirectInFlight() {
  return window.sessionStorage.getItem(redirectInFlightKey)
}

export function clearRedirectInFlight() {
  window.sessionStorage.removeItem(redirectInFlightKey)
}

export async function completeRedirectSignIn() {
  if (!firebaseAuth) return null

  try {
    return await getRedirectResult(firebaseAuth)
  } finally {
    clearRedirectInFlight()
  }
}

export async function beginGoogleSignIn(options: BeginGoogleSignInOptions = {}) {
  if (!firebaseAuth || !googleProvider) {
    throw new Error('Google sign-in is not configured yet.')
  }

  const mode = options.mode ?? 'default'
  const returnTo = normalizeReturnTo(options.returnTo)
  const isSmallScreen = window.matchMedia('(max-width: 720px)').matches
  const flowId = crypto.randomUUID()
  const shouldRedirect = options.forceRedirect ?? isSmallScreen

  setPostAuthState({
    mode,
    returnTo,
  })
  clearPendingAuthAction()

  if (shouldRedirect) {
    window.sessionStorage.setItem(redirectInFlightKey, flowId)
    await signInWithRedirect(firebaseAuth, googleProvider)
    return null
  }

  try {
    return await signInWithPopup(firebaseAuth, googleProvider)
  } catch (error) {
    if (popupShouldFallbackToRedirect(error)) {
      window.sessionStorage.setItem(redirectInFlightKey, flowId)
      await signInWithRedirect(firebaseAuth, googleProvider)
      return null
    }

    throw error
  }
}

export function executePendingAuthIntent() {
  const pendingAuthAction = readPendingAuthAction()
  if (!pendingAuthAction) return null

  clearPendingAuthAction()

  return beginGoogleSignIn({
    forceRedirect: pendingAuthAction.forceRedirect,
    mode: pendingAuthAction.mode,
    returnTo: pendingAuthAction.returnTo,
  })
}

export function consumePostAuthPath() {
  const postAuthPath = window.sessionStorage.getItem(postAuthPathKey)
  if (postAuthPath) {
    window.sessionStorage.removeItem(postAuthPathKey)
  }
  return postAuthPath
}

export function consumePostAuthAppAction() {
  const appAction = window.sessionStorage.getItem(postAuthAppActionKey) as PostAuthAppAction | null
  if (appAction) {
    window.sessionStorage.removeItem(postAuthAppActionKey)
  }
  return appAction
}

export async function signOutCurrentUser() {
  clearPendingAuthAction()
  clearRedirectInFlight()
  window.sessionStorage.removeItem(postAuthPathKey)
  window.sessionStorage.removeItem(postAuthAppActionKey)

  if (!firebaseAuth) return
  await signOut(firebaseAuth)
}
