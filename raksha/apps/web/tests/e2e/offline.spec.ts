import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

// Runs against the production build (service worker + strict CSP) on :4173.
test.use({ baseURL: "http://127.0.0.1:4173" });

test("installable PWA: manifest with PNG + maskable icons, service worker registers", async ({ page, request }) => {
  await onboard(page);
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string; purpose: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  expect(m.icons.some((i: { sizes: string; type: string }) => i.sizes === "192x192" && i.type === "image/png")).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
});

test("no CSP violations and no console errors on the production build", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/openfreemap|tiles|Failed to load resource/.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));
  await onboard(page);
  await page.getByTestId("search").click();
  await page.getByTestId("demo-night-walk").click();
  await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"))).toContain("default-src 'self'");
});

test("offline: the shell loads from cache, the hex layer still draws, Guard and fake call work", async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // wait until the precache has been filled
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(2000);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("home")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("You're offline", { exact: false })).toBeVisible();
  // city data comes from the cache, so the safety hexes render even though the base tiles can't load
  await expect.poll(() => page.evaluate(() => { const m = (window as unknown as { __rakshaMap?: { getSource: (s: string) => unknown; querySourceFeatures: (s: string) => unknown[] } }).__rakshaMap; return m?.getSource("hex") ? m.querySourceFeatures("hex").length : 0; }), { timeout: 20_000 }).toBeGreaterThan(50);

  await page.getByTestId("guard-now").click();
  await expect(page.getByTestId("guard")).toBeVisible();
  await expect(page.getByTestId("hold-sos")).toBeVisible();
  await page.getByTestId("tile-fake").click();
  await page.getByTestId("delay-0").click();
  await page.getByTestId("fake-schedule").click();
  await expect(page.getByTestId("fake-call-screen")).toBeVisible();
});
