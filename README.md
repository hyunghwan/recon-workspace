# Recon Workspace

Recon Workspace is a build-in-public reconciliation prep app for bookkeepers and small finance teams. It focuses on the messy layer before the books are clean: importing CSV batches, tracking unresolved items, attaching support, and preparing month-end follow-up.

Live site: [https://reconcile.sqncs.com/](https://reconcile.sqncs.com/)

## What is in this repo
- A React + TypeScript app with a marketing site, blog, and authenticated workspace shell
- Firebase Auth, Firestore, and Storage integration for cloud-backed workspaces
- Sample CSV templates and realistic fixture packs for month-end reconciliation flows
- Product, growth, engineering, and operations docs kept in the open

## Core workflow
- Organize work by client workspace and monthly reconciliation period
- Import bank, card, payout, and support-document CSV batches
- Review matched, ambiguous, unmatched, and exception queues
- Track missing support and export follow-up lists before close

## Stack
- React 19
- TypeScript
- Vite
- Firebase Auth, Firestore, Storage, and Hosting
- Playwright and Vitest for verification

## Quick start
```bash
pnpm install
pnpm dev
```

The app can boot without Firebase configuration. In that mode, you can explore the marketing site and sample workspace, while sign-in and live uploads stay disabled.

To enable Firebase-backed sign-in, sync, and uploads:

```bash
cp .env.example .env.local
```

Then fill in the Firebase web app values in `.env.local`.

## Build and verify
Release-style builds require a public `https` origin:

```bash
SITE_ORIGIN=https://reconcile.sqncs.com pnpm build
pnpm release:verify
```

`pnpm release:verify` runs lint, build, unit tests, Firebase rules tests, and a smoke test against the built app.

## Firebase deployment
The deploy scripts are environment-driven so the repo can be forked safely:

```bash
FIREBASE_PROJECT_ID=your-project-id FIREBASE_PREVIEW_CHANNEL=preview pnpm release:preview
FIREBASE_PROJECT_ID=your-project-id pnpm release:live
```

If you prefer Firebase CLI project aliases locally, copy `.firebaserc.example` to `.firebaserc` and replace the placeholder project ID.

## Docs
- Docs hub: [docs/README.md](docs/README.md)
- Product: [docs/product/vision.md](docs/product/vision.md), [docs/product/mvp.md](docs/product/mvp.md)
- Growth: [docs/growth/gtm.md](docs/growth/gtm.md), [docs/growth/content-marketing.md](docs/growth/content-marketing.md), [docs/growth/blog-seo-guide.md](docs/growth/blog-seo-guide.md), [docs/growth/blog-operations-runbook.md](docs/growth/blog-operations-runbook.md)
- Engineering: [docs/engineering/architecture.md](docs/engineering/architecture.md), [docs/engineering/firebase-setup.md](docs/engineering/firebase-setup.md)
- Operations: [docs/operations/firebase-hosting-note.md](docs/operations/firebase-hosting-note.md), [docs/operations/firebase-release-runbook.md](docs/operations/firebase-release-runbook.md)
- Build in public: [docs/build-in-public/project-status.md](docs/build-in-public/project-status.md)

## Open source posture
This repository is public as a reference implementation and build-in-public artifact. Issues and pull requests are welcome, but maintainer response time is best effort and not guaranteed.

See:
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License
[MIT](LICENSE)
