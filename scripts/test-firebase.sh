#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
mkdir -p .sisyphus/evidence

npx -y firebase-tools@latest emulators:exec \
  --project demo-recon-workspace \
  --only firestore,storage \
  "vitest run tests/firebase/emulator-flow.test.ts"
