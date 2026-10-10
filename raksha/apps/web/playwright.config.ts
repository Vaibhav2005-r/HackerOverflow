import { defineConfig, devices } from "@playwright/test";

const NO_KEYS = "VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_ORS_KEY= VITE_VAPID_PUBLIC_KEY=";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: 0,
  workers: 2,                       // software-rendered WebGL is CPU-hungry; more workers makes tests flaky
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 19.2060, longitude: 72.8746 }, // TCET, inside the demo area
    permissions: ["geolocation"],
    timezoneId: "Asia/Kolkata",
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] },
    trace: "retain-on-failure",
  },
  // Hermetic: keys from .env.local are blanked, so tests always run in local mode on their own ports/builds.
  webServer: [
    { command: `${NO_KEYS} pnpm exec vite --port 5174 --host 127.0.0.1`, url: "http://127.0.0.1:5174", reuseExistingServer: false, timeout: 60_000 },
    // production build (service worker + CSP) for offline.spec.ts
    { command: `${NO_KEYS} pnpm exec vite build --outDir dist-test --emptyOutDir && ${NO_KEYS} pnpm exec vite preview --outDir dist-test --port 4174 --host 127.0.0.1`, url: "http://127.0.0.1:4174", reuseExistingServer: false, timeout: 180_000 },
  ],

});
