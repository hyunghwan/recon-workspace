# Firebase Hosting vs Vercel

Recon Workspace can be hosted entirely on Firebase.

## Firebase-only stack
- Hosting: Firebase Hosting
- Auth: Firebase Auth (Google)
- DB: Firestore

## Why this is a good fit right now
- simple stack
- one console
- native Google sign-in support
- enough for an MVP with a React front-end and basic persistence

## When to reconsider later
If the product grows into heavier workflow automation, server-side parsing, or more complex reporting, we can revisit backend architecture. But for the current MVP, Firebase is enough.
