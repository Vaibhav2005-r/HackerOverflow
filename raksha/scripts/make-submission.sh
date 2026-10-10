#!/usr/bin/env bash
# Builds the app and zips source + prebuilt apps/web/dist + run instructions for Unstop.
#   scripts/make-submission.sh [output.zip]      (default: ../raksha-submission.zip)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(cd .. && pwd)/${1:-raksha-submission.zip}"
pnpm build >/dev/null
rm -f "$OUT"
zip -qr "$OUT" . \
  -x "node_modules/*" "*/node_modules/*" "pipeline/.venv/*" "data/raw/*" "*/.scratch/*" ".scratch/*" \
     "apps/web/test-results/*" "apps/web/playwright-report/*" "*/__pycache__/*" "*/.pytest_cache/*" \
     "*/coverage/*" "*.log" ".DS_Store" "*/.DS_Store" "deno.lock" "apps/web/dist/stats.json" ".git/*"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | grep -E "apps/web/dist/index.html|public/data/mumbai_demo/cells.json|README.md|start-demo.sh|serve.py" | awk '{print "  contains", $4}'
