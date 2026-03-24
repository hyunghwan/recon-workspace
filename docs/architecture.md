# MVP Architecture

## Stack
- React + TypeScript + Vite
- Static deployment on Firebase Hosting
- Firebase Auth, Firestore, and Storage for the production data path
- Local sample data for guided exploration when signed out

## App sections
- landing / explanation layer
- interactive reconciliation workspace

## Core front-end modules
- `App.tsx` — page composition
- `src/data.ts` — sample client/month workspace data
- `src/features/workspace/` — client shell, files, review, and follow-up routes
- `src/firestore.ts` — Firebase persistence and storage upload helpers

## State approach
Use React state with a local sample snapshot by default.
When a user signs in, the same workspace model saves through Firebase.

## Deployment approach
- `pnpm build` emits the static SPA plus generated blog content into `dist/`
- `firebase.json` rewrites app routes to `index.html`
- `pnpm release:verify` is the required release gate before preview or live deploy
- Preview deploys run through Firebase Hosting preview channels in the same project

## Design goals
- finance-tool clarity without enterprise ugliness
- dense but readable table UI
- status-first workflow
- fast scanning of unresolved items

## MVP definition of done
- docs committed
- React app ships the workspace flow around client -> month -> files/review/follow-up
- build passes
- deployable to Firebase Hosting
- shareable GitHub repo
