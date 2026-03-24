# Firebase Hosting Release Notes

Recon Workspace now releases through Firebase Hosting, not a Vercel-first path.

## Production release shape
- Static SPA hosted from `dist/`
- Canonical public origin: `https://your-firebase-project-id.web.app`
- Secondary authorized domain: `https://your-firebase-project-id.firebaseapp.com`
- Firebase Auth for Google sign-in
- Firestore for workspace and month data
- Firebase Storage for original CSV uploads

## Why the Firebase-first path stays in place
- Hosting, Auth, Firestore, and Storage stay in one project
- Preview channels let us verify the same production project before a live deploy
- The current app is a static React/Vite build, so Firebase Hosting matches the shipped architecture

## Release discipline
- Run `pnpm release:verify` before preview or live deploy
- Use `pnpm release:preview` for the pre-live channel
- Use `pnpm release:live` only after the preview result is acceptable
- Use `firebase hosting:clone` with a known good `VERSION_ID` for Hosting rollback

## Deferred decision
Cloud Storage App Check enforcement is documented but not newly enabled in this hardening pass.
