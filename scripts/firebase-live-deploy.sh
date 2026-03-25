#!/usr/bin/env bash
set -euo pipefail

set -a
if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  source .env.local
fi
set +a

node scripts/check-firebase-deploy-env.mjs live
pnpm release:verify
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,firestore:indexes,storage --project "$FIREBASE_PROJECT_ID"
