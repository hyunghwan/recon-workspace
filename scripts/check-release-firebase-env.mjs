const siteOrigin = process.env.SITE_ORIGIN?.trim()

if (!siteOrigin) {
  console.error('Missing required release environment variable: SITE_ORIGIN')
  console.error('Set SITE_ORIGIN to the canonical public origin for this deployment, for example https://reconcile.sqncs.com.')
  process.exit(1)
}

let parsed
try {
  parsed = new URL(siteOrigin)
} catch (error) {
  console.error(`Invalid SITE_ORIGIN: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

if (parsed.protocol !== 'https:') {
  console.error('SITE_ORIGIN must use https for release verification.')
  process.exit(1)
}

if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  console.error('SITE_ORIGIN must point to a public origin, not localhost or a loopback address.')
  process.exit(1)
}

console.log(`Release environment is configured with SITE_ORIGIN=${parsed.origin}.`)
