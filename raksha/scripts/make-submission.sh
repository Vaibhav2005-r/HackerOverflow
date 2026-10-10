#!/usr/bin/env bash
# Builds the app and zips source + prebuilt apps/web/dist + run instructions for Unstop.
#   scripts/make-submission.sh [output.zip]      (default: ../raksha-submission.zip)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(cd .. && pwd)/${1:-raksha-submission.zip}"
# The judges' zip is built KEYLESS (local mode) so your Supabase/ORS/VAPID values in apps/web/.env.local are never baked into dist.
# Process env wins over .env files in Vite. Set WITH_BACKEND=1 to deliberately ship a build wired to your Supabase project.
if [ -z "${WITH_BACKEND:-}" ]; then export VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_ORS_KEY= VITE_VAPID_PUBLIC_KEY=; fi
pnpm build >/dev/null
if [ -z "${WITH_BACKEND:-}" ] && [ -f apps/web/.env.local ]; then
  # fail if any real value from .env.local (URL, keys) ended up in the bundle
  while IFS='=' read -r k v; do
    case "$k" in VITE_*) [ "${#v}" -ge 12 ] && grep -rqF -- "$v" apps/web/dist && { echo "ERROR: value of $k leaked into apps/web/dist — aborting"; exit 1; } ;; esac
  done < apps/web/.env.local
fi
rm -f "$OUT"
zip -qr "$OUT" . \
  -x "node_modules/*" "*/node_modules/*" "pipeline/.venv/*" "data/raw/*" "*/.scratch/*" ".scratch/*" \
     "apps/web/test-results/*" "apps/web/playwright-report/*" "*/__pycache__/*" "*/.pytest_cache/*" \
     "*/coverage/*" "*.log" ".DS_Store" "*/.DS_Store" "deno.lock" "apps/web/dist/stats.json" ".git/*" \
     ".env" "*/.env" ".env.local" "*/.env.local" ".env.*.local" "*/.env.*.local"
# hard stop: no env file other than the .env.example template may ship
if unzip -l "$OUT" | awk '{print $4}' | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | grep -q .; then
  rm -f "$OUT"; echo "ERROR: an env file with secrets was about to ship — zip deleted"; exit 1
fi
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | grep -E "apps/web/dist/index.html|public/data/mumbai_demo/cells.json|README.md|start-demo.sh|serve.py" | awk '{print "  contains", $4}'
