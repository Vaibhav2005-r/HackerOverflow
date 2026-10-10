# Going live (all free)

Raksha needs **HTTPS** on a real phone: geolocation, the service worker, motion sensors and "Add to Home Screen" all refuse plain `http://` (except `localhost`). Everything below is free-tier.

| Piece | Service | Cost | Notes |
|---|---|---|---|
| App hosting | **Cloudflare Pages** (or Netlify / GitHub Pages) | free | static files, HTTPS, unlimited bandwidth on Cloudflare |
| Backend | **Supabase** free tier | free | Postgres + auth + storage + edge functions. Projects pause after 7 days idle (resume from the dashboard) |
| Map tiles | **OpenFreeMap** | free, no key | |
| Routing | **FOSSGIS OSRM** (+ OpenRouteService fallback) | free | OSRM demo servers are fair-use; for heavy traffic self-host OSRM or use ORS (free key, 2 000 req/day) |
| Place search | **Photon** (Nominatim fallback) | free | fair-use; send a descriptive User-Agent |
| Safety data | OpenStreetMap via **Geofabrik** extracts | free | rebuilt by the `city-packs` workflow |
| Email codes | Supabase Auth | free | the built-in sender is limited to ~2 emails/hour: add your own SMTP (Brevo/Resend free tiers) before real sign-ups |

## 1. Backend (once)
1. **Auth → Providers → enable "Allow anonymous sign-ins"** (the app signs people in anonymously first; email is an optional upgrade).
2. **SQL Editor →** paste `supabase/setup.sql` → Run. (It is generated from the migrations by `supabase/build-setup.sh`.)
3. Edge functions + secrets (needs the Supabase CLI and your login):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy share-view --no-verify-jwt
   npx supabase functions deploy sos-notify
   npx supabase functions deploy delete-account
   npx supabase secrets set --env-file supabase/.env.local     # VAPID_*, APP_ORIGIN (your https site URL!)
   ```
4. **Auth → URL configuration:** set *Site URL* to your https origin.
5. (Recommended) **Auth → SMTP:** add your own SMTP so email codes are reliable.

## 2. Frontend
Cloudflare Pages → *Create project → Direct Upload* named `raksha`, then in GitHub add repo **secrets**: `CLOUDFLARE_API_TOKEN` (Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the *publishable* key), optionally `VITE_ORS_KEY`, `VITE_VAPID_PUBLIC_KEY`. Every push to `main` that touches the app deploys via `.github/workflows/deploy.yml`.
`public/_headers` ships the security headers (CSP, HSTS, Permissions-Policy, caching) and `public/_redirects` the SPA fallback.

Manual alternative: `pnpm build` and upload `apps/web/dist` anywhere that serves static files with an SPA fallback.

## 3. City data
`pipeline/config/cities.yaml` lists the cities. The `city-packs` workflow (monthly, or run it by hand for one city) downloads the Geofabrik extract, rebuilds the packs and opens a PR. To run locally:
```bash
brew install osmium-tool                                   # or apt install osmium-tool
mkdir -p data/raw/pbf && curl -L -o data/raw/pbf/western-zone.osm.pbf https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf
pnpm pipeline:run --city mumbai                             # or --city all
```
Add a city: add it to `cities.yaml` with its `bbox` and the right Geofabrik `pbf` zone, run the pipeline, commit `apps/web/public/data/<id>/`. The app reads `public/data/index.json` and loads the pack covering wherever the user is.

## 4. Before inviting real users
- Rotate any keys that were ever pasted into chat or committed. Only the *publishable* key belongs in the frontend; the *secret* key must never be in the repo, the build, or the browser.
- Have a lawyer read the in-app Privacy notice and Terms (they are plain-language drafts, not legal advice).
- Decide who monitors the project (Supabase email alerts) and what you tell users when it's down: the app falls back to local mode and `tel:112` always works.
- Tell users plainly what a web app can't do (see README → Honest limitations).
