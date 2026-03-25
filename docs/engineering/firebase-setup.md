# Firebase Setup

Recon Workspace uses Firebase for:
- Google sign-in with Firebase Auth
- workspace, period, import, record, and match persistence with Firestore
- original CSV storage with Firebase Storage
- static front-end hosting with Firebase Hosting

## Environment variables
Copy `.env.example` to `.env.local` and fill in the values for your Firebase project:

```bash
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:replace-me
SITE_ORIGIN=https://reconcile.sqncs.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PREVIEW_CHANNEL=preview
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_APPCHECK_DEBUG=
```

Notes:
- The app can run without the Firebase web config values. In that mode, sign-in and cloud uploads stay disabled.
- `SITE_ORIGIN` must be your public `https` origin for release-style builds because it drives canonical URLs, Open Graph tags, RSS, and sitemap output.
- `FIREBASE_PROJECT_ID` and `FIREBASE_PREVIEW_CHANNEL` are used by the deploy scripts, not by the browser app itself.

## Firebase console steps
1. Create a Firebase project.
2. Add a web app and copy the web config into `.env.local`.
3. Enable Authentication > Google if you want sign-in.
4. Add your public site origin and `your-project-id.firebaseapp.com` to Authentication > Settings > Authorized domains when using Google sign-in.
5. Enable Firestore Database.
6. Enable Firebase Storage.
7. If Cloud Storage App Check enforcement is enabled, create a reCAPTCHA v3 site key, set `VITE_FIREBASE_APPCHECK_SITE_KEY`, and use `VITE_FIREBASE_APPCHECK_DEBUG=true` only for localhost debugging.
8. Optional: copy `.firebaserc.example` to `.firebaserc` if you want Firebase CLI project aliases locally.

## Firestore structure
- `users/{uid}` for onboarding preferences such as `sampleSeededAt` and `sampleDismissedAt`
- `users/{uid}/workspaces/{workspaceId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/imports/{importId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/records/{recordId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/matches/{matchId}`

## Storage path
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/imports/{importId}/{fileName}`

## Repo files
The Firebase-related repo files are:
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `.firebaserc.example`

## Deploy flow
After `firebase login`, export or define `FIREBASE_PROJECT_ID` and `SITE_ORIGIN`, then run:

```bash
pnpm release:verify
FIREBASE_PROJECT_ID=your-project-id FIREBASE_PREVIEW_CHANNEL=preview pnpm release:preview
FIREBASE_PROJECT_ID=your-project-id pnpm release:live
```

For the full command sequence, rollback flow, and CI posture, use [../operations/firebase-release-runbook.md](../operations/firebase-release-runbook.md).

If Firebase CLI management commands fail because the cached login expired, reauthenticate before inspecting live project settings:

```bash
npx -y firebase-tools@latest login --reauth
```
