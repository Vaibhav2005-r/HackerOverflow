# Raksha backend (Supabase)

The app runs **without any backend** (local mode, IndexedDB). Add Supabase to get real cross-device live sharing, push, evidence upload and shared community reports.

## What's here
| Path | What |
|---|---|
| `migrations/0001_init.sql` | tables, constraints, indexes, the 5-contact trigger |
| `migrations/0002_rls.sql` | RLS on **every** table, table-level revokes, private `evidence` bucket policies |
| `migrations/0003_rpc.sql` | `start_share`, `end_share`, `start_sos`, `resolve_sos`, `submit_report`, `get_report_aggregates`, `delete_my_data`, `share_view_data` |
| `migrations/0004_retention.sql` | `retention_cleanup()` + daily `pg_cron` job |
| `functions/share-view` | public, token-gated read for the contact page (`verify_jwt = false`, 1 req / 2 s / token) |
| `functions/sos-notify` | Web Push fan-out to circle members who also use Raksha (P1) |
| `functions/delete-account` | evidence objects + auth user ("Delete all my data") |
| `tests/database/*.test.sql` | pgTAP: RLS proof, token hashing, point rules, SOS/duress, reports, retention |
| `seed.sql` | ~20 demo reports (generated: `pnpm --filter @raksha/core seed:make`) |

## Run it locally (Docker + Supabase CLI)
```bash
pnpm db:start                      # supabase start
pnpm db:reset                      # migrations + seed.sql
pnpm db:test                       # supabase test db  (pgTAP)
supabase functions serve --env-file supabase/.env.local
```
Put the printed API URL and anon key in `apps/web/.env.local`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key>
```
Function secrets (`supabase secrets set …`): `APP_ORIGIN`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. Enable **anonymous sign-ins** (already set in `config.toml` for local; switch it on in the dashboard for a hosted project).

## No Docker? Verify on plain PostgreSQL
`pnpm db:verify-local` starts a throwaway PostgreSQL + PostGIS, applies a tiny shim for Supabase's `auth`/`storage`/roles (`tests/support/shim.sql`), runs every migration, the pgTAP files and `seed.sql`. Needs `postgresql@17`, `postgis` and pgTAP installed.

## Security model (checked by the tests)
- Anon key only in the client. The service-role key lives only in function secrets.
- Every table has RLS; `anon` has no table privileges. `share_sessions`, `sos_events` and `reports` have **no write policies**: all writes go through validated RPCs.
- Share tokens: 256-bit, only `sha256(token)` stored, returned once. The contact page reads via `share-view` → `share_view_data()` (execute granted to `service_role` only). Invalid/expired tokens answer 404 with no detail.
- Reports store the H3 cell only, never coordinates; aggregates expose no reporter ids or notes.
- PINs and the duress PIN are hashed on the device (PBKDF2-SHA256) and never sent.
- Retention: live/walk trails 24 h after the session ends; SOS 30 days; reports 180 days.

## Known limits
- The report distance check (400 m) uses the position the client claims. It is best-effort anti-spam, not proof.
- Evidence audio is uploaded in 10 s chunks while the app is open; a closed tab stops recording (browser limit).
- Realtime is polling (3 s) rather than Supabase Realtime, which keeps the contact page free of auth and the SDK.
