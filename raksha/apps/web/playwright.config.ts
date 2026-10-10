import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 19.2060, longitude: 72.8746 }, // TCET, inside the demo area
    permissions: ["geolocation"],
    timezoneId: "Asia/Kolkata",
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] },
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "pnpm exec vite --port 5173 --host 127.0.0.1", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 60_000 },
    // production build (service worker + CSP): used by offline.spec.ts; run `pnpm build` first
    { command: "pnpm exec vite preview --port 4173 --host 127.0.0.1", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 60_000 },
  ],
});
