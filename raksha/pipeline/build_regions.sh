#!/usr/bin/env bash
# Builds the state-wide tiles (after the national norms + calibration exist). Resumable (chunk cache).
cd "$(dirname "$0")"
export PATH="$HOME/Library/pnpm:$PATH"
while pgrep -f "raksha_pipeline.region --region west_bengal" > /dev/null; do sleep 5; done
for r in maharashtra madhya_pradesh; do echo "=== $r $(date +%T)"; .venv/bin/python -m raksha_pipeline.region --region $r --workers 6 || echo "!! $r failed"; done
echo REGIONS_DONE
