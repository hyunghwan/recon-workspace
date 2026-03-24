const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'SITE_ORIGIN',
]

const missingKeys = requiredKeys.filter((key) => {
  const value = process.env[key]?.trim()
  return !value
})

if (missingKeys.length) {
  console.error('Missing required release environment variables:')
  for (const key of missingKeys) {
    console.error(`- ${key}`)
  }
  console.error('')
  console.error('Release builds must include both SITE_ORIGIN and the Firebase web config values.')
  process.exit(1)
}

if (process.env.SITE_ORIGIN?.trim() !== 'https://reconcile.sqncs.com') {
  console.error('SITE_ORIGIN must be https://reconcile.sqncs.com for release verification.')
  process.exit(1)
}

console.log('Release Firebase environment variables are present.')
