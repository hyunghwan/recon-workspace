# Firebase Hosting Release Notes

Recon Workspace ships through Firebase Hosting instead of a Vercel-first path.

## Release shape
- Static SPA hosted from `dist/`
- Canonical public origin comes from `SITE_ORIGIN`
- Firebase Auth helper domain is your project fallback domain, usually `your-project-id.firebaseapp.com`
- Firebase Auth powers Google sign-in when configured
- Firestore stores workspace and month data
- Firebase Storage keeps original CSV uploads

## Why the Firebase-first path stays in place
- Hosting, Auth, Firestore, and Storage stay in one stack
- Preview channels make pre-live verification straightforward
- The app is a static React/Vite build, so Firebase Hosting fits the shipped architecture

## Release discipline
- Run `pnpm release:verify` before preview or live deploy
- Use `pnpm release:preview` for the pre-live channel
- Use `pnpm release:live` only after the preview result is acceptable
- Use `firebase hosting:clone` from the last known-good preview channel for rollback

## Deferred decision
Cloud Storage App Check is documented and supported, but it is not enabled by default in this public repo.
