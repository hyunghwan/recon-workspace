# Firebase Release Runbook

Recon Workspace ships as a static app on Firebase Hosting. The repository is public, so deploy configuration comes from environment variables rather than hardcoded project IDs.

## Release scope
- Hosting output: `dist/`
- Firestore security rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Storage rules: `storage.rules`
- No schema migration
- No data migration
- App Check is optional and not enabled by default in this repo

## Required environment
Set these values in your shell, CI variables, or `.env.local` before deploying:

```bash
SITE_ORIGIN=https://reconcile.sqncs.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PREVIEW_CHANNEL=preview
```

If Google sign-in is enabled, keep both of these domains authorized in Firebase Authentication settings:
- your public `SITE_ORIGIN` such as `https://reconcile.sqncs.com`
- `your-project-id.firebaseapp.com`

## Required verification gate
Run the full release gate before any preview or live deploy:

```bash
pnpm release:verify
```

That script runs, in order:

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:firebase
pnpm test:smoke
```

If any step fails, stop. Do not deploy preview or live.

## Preview deploy
Use a Firebase Hosting preview channel for pre-live validation:

```bash
FIREBASE_PROJECT_ID=your-project-id FIREBASE_PREVIEW_CHANNEL=preview pnpm release:preview
```

Equivalent Firebase CLI command:

```bash
npx -y firebase-tools@latest hosting:channel:deploy "$FIREBASE_PREVIEW_CHANNEL" --project "$FIREBASE_PROJECT_ID"
```

## Live deploy
After preview checks are acceptable, deploy hosting plus rules:

```bash
FIREBASE_PROJECT_ID=your-project-id pnpm release:live
```

Equivalent Firebase CLI command:

```bash
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,firestore:indexes,storage --project "$FIREBASE_PROJECT_ID"
```

## Rollback
Use the last known-good preview channel as the fastest rollback source:

```bash
npx -y firebase-tools@latest hosting:clone "$FIREBASE_PROJECT_ID:$FIREBASE_PREVIEW_CHANNEL" "$FIREBASE_PROJECT_ID:live" --project "$FIREBASE_PROJECT_ID"
```

If the preview channel is not the last known-good build, redeploy the target revision to a preview channel first and clone that result back to `live`.

## Pre-deploy checklist
- Firebase CLI is authenticated as the release operator
- `SITE_ORIGIN` is the real public `https` origin for this deployment
- `FIREBASE_PROJECT_ID` points to the correct Firebase project
- If auth is enabled, authorized domains include both the public site origin and `your-project-id.firebaseapp.com`
- `pnpm release:verify` passed without overrides
- No planned schema or data migration is bundled with this release

## CI alignment
- `.github/workflows/release-gate.yml` runs the same verification commands with a public-safe example origin
- `.github/workflows/preview-deploy.yml` is opt-in and only deploys when `FIREBASE_PROJECT_ID` and `FIREBASE_TOKEN` are configured in the repository
- Live deploy remains a manual operator action
