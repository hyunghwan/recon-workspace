#!/usr/bin/env bash
set -euo pipefail

mkdir -p .sisyphus/evidence
log_file=".sisyphus/evidence/task-9-release-automation.txt"
error_file=".sisyphus/evidence/task-9-release-automation-error.txt"

set -a
if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  source .env.local
fi
set +a

node scripts/check-release-firebase-env.mjs | tee -a "$log_file"

{
  echo "Task 9 Release Automation Evidence"
  echo
  echo "Command:"
  echo "  pnpm release:verify"
  echo
} > "$log_file"

steps=("lint" "build" "test" "test:firebase" "test:smoke")

for step in "${steps[@]}"; do
  if [[ "${FORCE_FAIL_STAGE:-}" == "$step" ]]; then
    {
      echo "Task 9 Release Automation Failure Evidence"
      echo
      echo "Blocked before step:"
      echo "  $step"
      echo
      echo "Reason:"
      echo "  Forced failure before $step"
      echo
      echo "Preview/live deploy commands were not executed."
    } > "$error_file"
    echo "Forced failure before $step"
    exit 1
  fi

  echo "==> Running pnpm $step" | tee -a "$log_file"
  pnpm "$step" | tee -a "$log_file"
done
