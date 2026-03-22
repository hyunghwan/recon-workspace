# Recon Workspace

Recon Workspace is a reconciliation prep workspace for bookkeepers and small finance teams.

It focuses on the messy layer before the books are clean:
- matching statement lines to supporting documents
- tracking unresolved exceptions
- identifying missing receipts/invoices
- preparing for month-end close

## Current state
This repository contains:
- product docs in `/docs`
- a React + TypeScript MVP UI
- demo mode without login
- cloud-ready auth/DB scaffolding for Firebase + Google login
- a Vercel-ready front-end build

## Docs
- `docs/vision.md`
- `docs/mvp.md`
- `docs/gtm.md`
- `docs/architecture.md`
- `docs/content-marketing.md`
- `docs/seo-article-month-end-close.md`
- `docs/firebase-setup.md`
- `docs/firebase-hosting-note.md`

## Local development
```bash
pnpm install
pnpm dev
```

## Production build
```bash
pnpm build
```

## Deployment
This app is designed to deploy directly to Vercel as a static React/Vite project.
