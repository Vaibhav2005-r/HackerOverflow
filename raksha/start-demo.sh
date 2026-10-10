#!/usr/bin/env bash
# Runs the prebuilt app. No installs needed beyond Python 3 (or Node, see below).
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then exec python3 serve.py "${1:-4173}"
elif command -v node >/dev/null 2>&1; then exec npx --yes serve -s apps/web/dist -l "${1:-4173}"
else echo "Need Python 3 or Node.js to serve apps/web/dist"; exit 1; fi
