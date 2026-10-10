#!/usr/bin/env bash
# Builds every city pack, priority order. Resumable: finished tiles are cached in data/raw/<city>/.
cd "$(dirname "$0")"
for c in mumbai durgapur delhi bengaluru pune kolkata hyderabad chennai; do
  echo "=== $c $(date +%T)"; .venv/bin/python -m raksha_pipeline.run --city "$c" || echo "!! $c failed"
done
# second and third pass: finished tiles are cached, so only the missing ones are fetched
for pass in 2 3; do
  for c in mumbai durgapur delhi bengaluru pune kolkata hyderabad chennai; do
    [ -f "../apps/web/public/data/$c/cells.json" ] && continue
    echo "=== pass $pass: $c $(date +%T)"; .venv/bin/python -m raksha_pipeline.run --city "$c" || echo "!! $c failed"
  done
done
echo "=== done $(date +%T)"
