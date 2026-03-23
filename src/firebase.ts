import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from 'firebase/app-check'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseBooleanEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const baseFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseConfig = {
  ...baseFirebaseConfig,
}

const firebaseAppCheckSiteKey = normalizeEnvValue(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY)

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
)

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const firebaseStorageBucket = normalizeEnvValue(firebaseConfig.storageBucket)
export const isAppCheckDebugEnabled = parseBooleanEnv(import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG)
export const isAppCheckSiteKeyConfigured = Boolean(firebaseAppCheckSiteKey)

function createAppCheck(): AppCheck | null {
  if (!firebaseApp || typeof window === 'undefined') {
    return null
  }

  if (!firebaseAppCheckSiteKey) {
    if (isAppCheckDebugEnabled) {
      console.warn('Firebase App Check debug mode is enabled, but VITE_FIREBASE_APPCHECK_SITE_KEY is missing.')
    }
    return null
  }

  if (isAppCheckDebugEnabled) {
    ;(globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }

  try {
    const appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(firebaseAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
    setTokenAutoRefreshEnabled(appCheck, true)
    return appCheck
  } catch (error) {
    console.warn('Firebase App Check initialization skipped:', error)
    return null
  }
}

function createAuth() {
  if (!firebaseApp) return null

  try {
    return initializeAuth(firebaseApp, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(firebaseApp)
  }
}

export const firebaseAuth = createAuth()
export const googleProvider = firebaseApp ? new GoogleAuthProvider() : null
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null
export const firebaseAppCheck = createAppCheck()
export const isAppCheckConfigured = Boolean(firebaseAppCheck)
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null

if (googleProvider) {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  })
}
