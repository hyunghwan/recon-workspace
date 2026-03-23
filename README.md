# Recon Workspace

Recon Workspace is a reconciliation prep workspace for bookkeepers and small finance teams.

It focuses on the messy layer before the books are clean:
- organizing work by workspace and monthly reconciliation period
- importing statement, payout, and supporting-document CSV batches
- matching normalized records with a deterministic reconciliation engine
- tracking matched, ambiguous, unmatched, and exception queues
- preparing a follow-up list before month-end close

## Current state
This repository contains:
- product docs in `/docs`
- a React + TypeScript reconciliation UI
- local sample workspaces and local persistence
- Firebase Auth + Firestore + Storage integration for pilot users
- sample CSV templates in `/public`
- a Vercel-ready front-end build

## Docs
- `docs/vision.md`
- `docs/mvp.md`
- `docs/gtm.md`
- `docs/architecture.md`
- `docs/content-marketing.md`
- `docs/seo-article-month-end-close.md`
- `docs/blog-seo-guide.md`
- `docs/blog-operations-runbook.md`
- `docs/firebase-setup.md`
- `docs/firebase-hosting-note.md`

## Local development
```bash
pnpm install
pnpm dev
```

If Cloud Storage App Check enforcement is enabled for the Firebase project, also set:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_APPCHECK_DEBUG=true
```

## Production build
```bash
SITE_ORIGIN=https://your-domain.com
pnpm build
```

The blog build validates Markdown content, renders static pages into `dist/blog/`, and generates `sitemap.xml`, `rss.xml`, and `robots.txt`.

## Deployment
This app is designed to deploy directly to Vercel as a static React/Vite project.

Firebase artifacts can be deployed with:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project your-firebase-project-id
```

If Firebase Storage has already been initialized for the project, deploy storage rules too:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,storage --project your-firebase-project-id
```

For Google sign-in, use the Firebase Auth helper domain in `VITE_FIREBASE_AUTH_DOMAIN` (for this project: `your-firebase-project-id.firebaseapp.com`) unless you have explicitly configured and whitelisted a different `__/auth/handler` redirect URI.

If Firebase CLI management commands start failing with `Your credentials are no longer valid`, refresh them with:

```bash
npx -y firebase-tools@latest login --reauth
```
