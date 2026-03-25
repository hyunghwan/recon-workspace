# Contributing

Thanks for taking a look at Recon Workspace.

## Repository posture
This repository is public as a build-in-public reference implementation. Contributions are welcome, but maintainer review and response time are best effort and not guaranteed.

## Before opening a PR
- Check the existing docs in `docs/` so the product and technical context stay aligned.
- Prefer small, focused pull requests.
- For non-trivial product or architecture changes, open an issue or discussion first so we can align on direction.

## Local checks
Run the verification flow before asking for review:

```bash
pnpm lint
SITE_ORIGIN=https://reconcile.sqncs.com pnpm build
pnpm test
pnpm test:firebase
pnpm test:smoke
```

If you are working from a fork deployed under another domain, replace `SITE_ORIGIN` with that public `https` origin.

## Scope expectations
- Keep product positioning consistent with the docs under `docs/product/`.
- Keep growth content aligned with the editorial guidance under `docs/growth/`.
- Do not commit local state, logs, or deploy bindings such as `.env.local`, `.firebaserc`, `.vercel/`, `.omx/`, or `.sisyphus/`.

## Code style
- Favor small, readable changes over broad refactors.
- Update docs when behavior, setup, or release steps change.
- Add or adjust tests when you change user-facing or rules-related behavior.

## Reporting issues
- Bugs and sharp edges are welcome in GitHub Issues.
- For security-sensitive problems, follow the guidance in [SECURITY.md](SECURITY.md).
