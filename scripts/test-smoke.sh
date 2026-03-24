#!/usr/bin/env bash
set -euo pipefail

mkdir -p .sisyphus/evidence
pnpm exec playwright test tests/smoke/app-load.spec.ts
