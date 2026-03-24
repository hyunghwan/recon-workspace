# Firebase Release Runbook

Recon Workspace ships from this repository to Firebase Hosting project `your-firebase-project-id`.

## Release scope
- Hosting: `dist/`
- Firestore security rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Storage rules: `storage.rules`
- No schema migration
- No data migration
- App Check enforcement remains deferred in this release

## Canonical public origin
- Live origin: `https://reconcile.sqncs.com`
- Authorized auth fallback: `https://your-firebase-project-id.firebaseapp.com`

Keep both domains authorized in Firebase Authentication settings. The release build must use:

```bash
SITE_ORIGIN=https://reconcile.sqncs.com
```

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
Use the same Firebase project for preview verification:

```bash
pnpm release:preview
```

Equivalent Firebase CLI command:

```bash
npx -y firebase-tools@latest hosting:channel:deploy preprod --project your-firebase-project-id
```

## Live deploy
After preview checks are acceptable, deploy hosting plus rules:

```bash
pnpm release:live
```

Equivalent Firebase CLI command:

```bash
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,firestore:indexes,storage --project your-firebase-project-id
```

## Rollback
Firebase Hosting rollback in this repo uses the verified preview channel as the no-guesswork fallback. Clone the last known-good `preprod` channel back to live:

```bash
npx -y firebase-tools@latest hosting:clone your-firebase-project-id:preprod your-firebase-project-id:live --project your-firebase-project-id
```

If `preprod` is no longer the last known-good build, re-run preview deploy from the target git revision and then clone that preview channel to `live`.

## Pre-deploy checklist
- Firebase CLI is authenticated as the release operator
- Active project is `your-firebase-project-id`
- `SITE_ORIGIN=https://reconcile.sqncs.com`
- Auth authorized domains include `reconcile.sqncs.com`
- Auth authorized domains include `your-firebase-project-id.firebaseapp.com`
- `pnpm release:verify` passed without overrides
- No planned schema or data migration is bundled with this release

## CI alignment
- `.github/workflows/release-gate.yml` runs the same verification commands as local release verification
- `.github/workflows/preview-deploy.yml` keeps preview deploy manual
- Live deploy stays manual from the repo or GitHub Actions
