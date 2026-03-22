# Firebase Setup

Recon Workspace now uses Firebase-only infrastructure:
- Google login with Firebase Auth
- transaction persistence with Firestore
- front-end hosting with Firebase Hosting

## Required environment variables
Create `.env.local` locally and configure the same values in your hosting environment:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firebase console steps
1. Create a Firebase project
2. Add a web app
3. Enable Authentication > Google
4. Enable Firestore Database
5. Copy config values into `.env.local`

## Firestore structure
- `users/{uid}`
- `users/{uid}/workspaces/default`
- `users/{uid}/workspaces/default/transactions/{transactionId}`

## Hosting
The project includes:
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`

## Deploy flow
After `firebase login` and after setting the correct project id in `.firebaserc`:

```bash
pnpm build
firebase deploy
```
