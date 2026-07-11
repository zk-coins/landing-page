#!/usr/bin/env bash
#
# Run the Playwright suite inside the pinned container so screenshots render
# against the exact browsers the committed baselines were generated with.
#
#   bash scripts/e2e-docker.sh                     # run + compare + visual gate
#   bash scripts/e2e-docker.sh --update-snapshots  # (re)generate the baselines
#
# --platform linux/amd64 pins the render architecture to the one GitHub Actions
# uses (ubuntu-latest, amd64), so baselines generated on an arm64 host (e.g. an
# Apple Silicon machine) still match CI byte for byte. node_modules is kept in an
# anonymous volume so the in-container Linux install never overwrites the host's
# modules. Baselines and the report are written through the bind mount and persist
# on the host.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

UPDATE=""
RUN_VISUAL_GATE=1
if [ "${1:-}" = "--update-snapshots" ]; then
  UPDATE="--update-snapshots"
  RUN_VISUAL_GATE=0
fi

echo "Playwright container: ${IMAGE} (linux/amd64)"

docker run --rm --init \
  --platform linux/amd64 \
  -v "$PWD":/work \
  -v /work/node_modules \
  -w /work \
  -e CI=1 \
  "$IMAGE" \
  bash -c "
    set -e
    npm ci --no-audit --no-fund || npm ci --no-audit --no-fund
    npx playwright test ${UPDATE}
    if [ ${RUN_VISUAL_GATE} -eq 1 ]; then node scripts/check-visual.mjs; fi
  "
