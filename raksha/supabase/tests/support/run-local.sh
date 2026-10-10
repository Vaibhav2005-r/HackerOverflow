#!/usr/bin/env bash
# Verify migrations + pgTAP on a throwaway local PostgreSQL (no Docker needed).
#   needs: postgresql + postgis + pgTAP installed (brew install postgresql@17 postgis; pgTAP built from source)
# Usage: supabase/tests/support/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."          # → supabase/
PGBIN="${PGBIN:-$(brew --prefix postgresql@17 2>/dev/null)/bin}"
export PATH="$PGBIN:$PATH"
DIR="$(mktemp -d)"; PORT="${PGPORT:-54999}"
cleanup() { pg_ctl -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
initdb -D "$DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c fsync=off" -w start >/dev/null
export PGHOST="$DIR" PGPORT="$PORT" PGUSER=postgres
createdb raksha
psql -v ON_ERROR_STOP=1 -q -d raksha -f tests/support/shim.sql
for f in migrations/*.sql; do echo "== migrate $f"; psql -v ON_ERROR_STOP=1 -q -d raksha -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d raksha -c "create extension if not exists pgtap"

fail=0
for t in tests/database/*.test.sql; do
  echo "== $t"
  out="$(psql -q -t -A -d raksha -f "$t" 2>&1)" || true
  echo "$out" | grep -E "^(ok|not ok|1\.\.|# )" | grep -v "^ok" || true
  ok=$(echo "$out" | grep -c "^ok" || true); bad=$(echo "$out" | grep -c "^not ok" || true)
  echo "   passed=$ok failed=$bad"
  echo "$out" | grep -E "ERROR|FATAL|Looks like" || true
  if [ "$bad" -ne 0 ] || echo "$out" | grep -qE "ERROR|Looks like you planned"; then fail=1; fi
done
exit $fail
