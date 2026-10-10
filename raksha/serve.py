#!/usr/bin/env python3
"""Zero-install static server for the prebuilt app (apps/web/dist) with SPA fallback, so /plan, /s/<token> etc. work on reload.
Usage: python3 serve.py [port]   (default 4173). Open http://localhost:<port> — localhost counts as a secure context, so the
service worker, geolocation and motion APIs work. (A phone on the LAN over plain http will not get those; use https or DevTools device mode.)"""
import http.server, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apps", "web", "dist")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        path = self.translate_path(self.path.split("?")[0])
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(os.path.join(path, "index.html")):
            self.path = "/index.html"            # SPA fallback
        return super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def guess_type(self, path):
        return "application/manifest+json" if path.endswith(".webmanifest") else super().guess_type(path)

if not os.path.isdir(ROOT):
    sys.exit("apps/web/dist not found — run `pnpm build` first (the submission zip already contains it).")
print(f"Raksha → http://localhost:{PORT}   (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
