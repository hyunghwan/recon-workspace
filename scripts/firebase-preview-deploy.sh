#!/usr/bin/env bash
set -euo pipefail

pnpm release:verify
npx -y firebase-tools@latest hosting:channel:deploy preprod --project your-firebase-project-id
