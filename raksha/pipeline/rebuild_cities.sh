#!/usr/bin/env bash
# Rebuilds the city packs on the national scales: features (national norms) → national calibration → final scoring.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/Library/pnpm:$PATH"
CITIES="mumbai pune delhi bengaluru hyderabad chennai kolkata durgapur"
rm -f ../apps/web/public/data/calibration.json
for c in $CITIES; do echo "== features $c"; .venv/bin/python -m raksha_pipeline.run --city $c > /dev/null; done
( cd ../packages/core && ./node_modules/.bin/tsx src/scoring/calibrate-cli.ts $(for c in $CITIES; do echo ../../data/raw/features_$c.json; done) ../../apps/web/public/data/calibration.json )
for c in $CITIES; do echo "== score $c"; ( cd ../packages/core && ./node_modules/.bin/tsx src/scoring/build-cells.ts ../../data/raw/features_$c.json ../../apps/web/public/data/$c --calibration ../../apps/web/public/data/calibration.json | grep -E "cells →|WARNING" ); done
.venv/bin/python -c "from raksha_pipeline.run import build_index; build_index()"
echo CITIES_DONE
