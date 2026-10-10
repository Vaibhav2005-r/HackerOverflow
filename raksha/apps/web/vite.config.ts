import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

/** Strict CSP for production builds only (dev needs inline HMR scripts). Network hosts are exactly the ones the app talks to. */
function csp(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const supa = env.VITE_SUPABASE_URL ? [env.VITE_SUPABASE_URL, env.VITE_SUPABASE_URL.replace(/^http/, "ws")] : [];
  const connect = ["'self'", "https://tiles.openfreemap.org", "https://routing.openstreetmap.de", "https://photon.komoot.io",
    "https://nominatim.openstreetmap.org", "https://api.openrouteservice.org", ...supa].join(" ");
  const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; ` +
    `media-src 'self' blob:; worker-src 'self' blob:; child-src 'self' blob:; connect-src ${connect}; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  return {
    name: "raksha-csp", apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    csp(mode),
    react(),
    ...(process.env.ANALYZE ? [visualizer({ filename: "dist/stats.json", template: "raw-data", gzipSize: true })] : []),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/", name: "Raksha", short_name: "Raksha", description: "A companion that walks with you.",
        theme_color: "#0B0A14", background_color: "#0B0A14", display: "standalone", orientation: "portrait", start_url: "/", scope: "/", categories: ["navigation", "lifestyle"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        shortcuts: [{ name: "Guard me now", url: "/?guard=1", description: "Open Raksha with Guard mode on" }],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"], navigateFallback: "/index.html", maximumFileSizeToCacheInBytes: 6_000_000 },
    }),
  ],
  optimizeDeps: { exclude: ["maplibre-gl"] }, // keeps its module worker resolvable in dev
  build: { chunkSizeWarningLimit: 900 },
}));
