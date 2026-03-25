const mode = process.argv[2] ?? 'deploy'
const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
const previewChannel = process.env.FIREBASE_PREVIEW_CHANNEL?.trim() || 'preview'

if (!projectId) {
  console.error('Missing required deploy environment variable: FIREBASE_PROJECT_ID')
  console.error('Set FIREBASE_PROJECT_ID in the shell, GitHub Actions variables, or .env.local before running Firebase deploy scripts.')
  process.exit(1)
}

if (!/^[a-z0-9-]+$/i.test(projectId)) {
  console.error(`FIREBASE_PROJECT_ID looks invalid: ${projectId}`)
  process.exit(1)
}

if (!/^[a-z0-9-]+$/i.test(previewChannel)) {
  console.error(`FIREBASE_PREVIEW_CHANNEL looks invalid: ${previewChannel}`)
  process.exit(1)
}

const label = mode === 'preview' ? `preview channel "${previewChannel}"` : 'live deploy'
console.log(`Firebase deploy environment is ready for ${label} in project "${projectId}".`)
