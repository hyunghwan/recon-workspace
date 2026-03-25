#!/usr/bin/env bash
set -euo pipefail

set -a
if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  source .env.local
fi
set +a

: "${FIREBASE_PREVIEW_CHANNEL:=preview}"

node scripts/check-firebase-deploy-env.mjs preview
pnpm release:verify
npx -y firebase-tools@latest hosting:channel:deploy "$FIREBASE_PREVIEW_CHANNEL" --project "$FIREBASE_PROJECT_ID"
