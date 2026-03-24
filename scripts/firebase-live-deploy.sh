#!/usr/bin/env bash
set -euo pipefail

pnpm release:verify
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,firestore:indexes,storage --project your-firebase-project-id
