# Firebase Setup

Recon Workspace now uses Firebase-only infrastructure:
- Google login with Firebase Auth
- workspace, period, import, record, and match persistence with Firestore
- original CSV storage with Firebase Storage
- front-end hosting with Firebase Hosting

## Required environment variables
Create `.env.local` locally and configure the same values in your hosting environment:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_APPCHECK_DEBUG=
```

The live Firebase Hosting config for this project currently publishes `storageBucket=your-firebase-project-id.firebasestorage.app`, so local and deployed env values should match that exact bucket name.

## Firebase console steps
1. Create a Firebase project
2. Add a web app
3. Enable Authentication > Google
4. Keep `your-firebase-project-id.firebaseapp.com` as the Firebase Auth helper domain unless you have explicitly whitelisted another `__/auth/handler` redirect URI in Google OAuth configuration
5. Add both `your-firebase-project-id.firebaseapp.com` and `your-firebase-project-id.web.app` to Authentication > Settings > Authorized domains
6. Enable Firestore Database
7. Enable Firebase Storage and click `Get Started`
8. Copy config values into `.env.local`
9. If Cloud Storage App Check enforcement is enabled, create a reCAPTCHA v3 site key, add it to `VITE_FIREBASE_APPCHECK_SITE_KEY`, and use `VITE_FIREBASE_APPCHECK_DEBUG=true` only for localhost debugging

## Firestore structure
- `users/{uid}`
- `users/{uid}/workspaces/{workspaceId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/imports/{importId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/records/{recordId}`
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/matches/{matchId}`

## Storage path
- `users/{uid}/workspaces/{workspaceId}/periods/{periodId}/imports/{importId}/{fileName}`

## Hosting
The project includes:
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

## Deploy flow
After `firebase login` and after setting the correct project id in `.firebaserc`:

```bash
pnpm build
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project your-firebase-project-id
```

After Firebase Storage has been initialized in the console, deploy storage rules too:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,storage --project your-firebase-project-id
```

If CLI management commands fail because the cached login expired, reauthenticate before inspecting live project settings:

```bash
npx -y firebase-tools@latest login --reauth
```
