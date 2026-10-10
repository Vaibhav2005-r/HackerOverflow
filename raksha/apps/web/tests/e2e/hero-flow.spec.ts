import { expect, test, type Page } from "@playwright/test";
import { onboard, pin, planRoute } from "./helpers";

const holdSos = async (page: Page, ms = 2300) => {
  const b = await page.getByTestId("hold-sos").first().boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
};
test.beforeEach(async ({ page }) => { await onboard(page); });

test("home renders the map with the safety hex layer and band chip", async ({ page }) => {
  await expect(page.getByTestId("time-band")).toContainText("Night");
  await expect.poll(() => page.evaluate(() => { const m = (window as any).__rakshaMap; return m?.getSource?.("hex") ? m.querySourceFeatures("hex").length : 0; }), { timeout: 20_000 }).toBeGreaterThan(100);
  const size = await page.evaluate(() => { const c = (window as any).__rakshaMap.getCanvas(); return [c.clientWidth, c.clientHeight]; });
  expect(size[1]).toBeGreaterThan(700); // regression: MapLibre CSS used to collapse the container
});

test("search → plan shows Sakhi's pick, trade-off text and explained weak stretches", async ({ page }) => {
  await planRoute(page);
  await expect(page.getByTestId("route-skeleton")).toHaveCount(0);
  const safest = page.getByTestId("route-card-safest");
  await expect(safest).toContainText("Sakhi's pick");
  await expect(safest).toContainText(/well-lit streets/);
  await expect(safest).not.toContainText(/\bsafe\b(?!st)/i); // honesty rule: never claims "safe"
  await safest.getByRole("button").click();               // tap the selected card to expand
  await expect(page.getByTestId("weak-stretches")).toBeVisible();
  await expect(page.getByTestId("stretch-row").first()).toBeVisible();
  await expect(page.getByTestId("sakhi-text")).toContainText(/min longer|well-lit|stays on/);
});

test("hold SOS 2 s → SOS screen; wrong PIN errors; right PIN resolves", async ({ page }) => {
  await holdSos(page);
  await expect(page.getByTestId("sos-screen")).toBeVisible();
  await expect(page.getByTestId("sos-screen")).toHaveAttribute("data-mode", "silent");
  await expect(page.getByTestId("sos-link")).toBeVisible();
  await expect(page.getByTestId("sos-call-112")).toHaveAttribute("href", "tel:112");
  await page.getByTestId("sos-cancel").click();
  await pin(page, "0000");
  await expect(page.getByRole("alert").filter({ hasText: "didn't match" })).toBeVisible();
  await pin(page, "4821");
  await expect(page.getByTestId("resolved")).toBeVisible();
  await expect(page.getByTestId("resolved-title")).toContainText("SOS cancelled");
});

test("reloading on a journey screen falls back to Home instead of a blank page", async ({ page }) => {
  for (const path of ["/plan", "/journey", "/guard"]) {
    await page.goto(path);
    await expect(page.getByTestId("home")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  }
});

test("a short hold does not trigger SOS", async ({ page }) => {
  await holdSos(page, 700);
  await expect(page.getByTestId("sos-screen")).toHaveCount(0);
});

test("duress PIN shows the same resolved UI while the contact view stays ACTIVE with a coercion flag", async ({ page, context }) => {
  await holdSos(page);
  const link = (await page.getByTestId("sos-link").textContent())!;
  const token = link.split("/s/")[1]!.trim();
  const contact = await context.newPage();
  await contact.goto(`/s/${token}`);
  await expect(contact.getByTestId("sv-status")).toContainText("SOS active");
  await expect(contact.getByTestId("sv-coercion")).toHaveCount(0);

  await page.getByTestId("sos-cancel").click();
  await pin(page, "1357"); // duress
  await expect(page.getByTestId("resolved-title")).toContainText("SOS cancelled"); // identical to the real cancel
  await expect(contact.getByTestId("sv-coercion")).toBeVisible({ timeout: 10_000 });
  await expect(contact.getByTestId("sv-status")).toContainText("SOS active");
  await expect(contact.getByTestId("sv-last")).toContainText(/ago/); // last known position was published immediately
  await page.getByTestId("resolved-tell").click();
  await expect(page.getByTestId("resolved-sent")).toBeVisible();
});

test("shake → 3 s countdown (cancellable) → SOS", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Shake to SOS always armed" }).click();
  await page.getByTestId("sim-shake").click();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await page.getByTestId("countdown-cancel").click();
  await expect(page.getByTestId("countdown")).toHaveCount(0);
  await page.getByTestId("sim-shake").click();
  await expect(page.getByTestId("sos-screen")).toBeVisible({ timeout: 8_000 });
});

test("fake call rings, answers and times the call", async ({ page }) => {
  await page.getByTestId("open-fake-call").click();
  await page.getByTestId("fake-caller-input").fill("Maa");
  await page.getByTestId("delay-0").click();
  await page.getByTestId("fake-schedule").click();
  await expect(page.getByTestId("fake-call-screen")).toBeVisible();
  await expect(page.getByTestId("fake-caller")).toHaveText("Maa");
  await page.getByTestId("fake-answer").click();
  await expect(page.getByTestId("fake-timer")).toHaveText(/00:0\d/, { timeout: 5_000 });
  await page.getByTestId("fake-end").click();
  await expect(page.getByTestId("fake-call-screen")).toHaveCount(0);
});

test("a community report is stored locally and adjusts the hex score", async ({ page }) => {
  const h3 = await page.evaluate(async () => { const idx = await (await fetch("/data/index.json")).json(); const j = await (await fetch(`/data/${idx.cities[0].id}/cells.json`)).json(); return j.cells[10][0] as string; });
  const before = await page.evaluate((h) => (window as any).__raksha.city.getState().lookup, h3).then(() => page.evaluate((h) => { const c = (window as any).__raksha.city.getState(); return c.cells.get(h).scores[2] as number; }, h3));
  await page.evaluate((h) => (window as any).__raksha.mapUi.getState().set({ hexTap: { h3: h, nonce: 1 } }), h3);
  await expect(page.getByTestId("hex-reasons")).toBeVisible();
  await page.getByTestId("report-here").click();
  await page.getByTestId("report-harassment").click();
  await expect(page.getByTestId("toast")).toBeVisible();
  const after = await page.evaluate((h) => { const c = (window as any).__raksha.city.getState(); const a = c.adj?.get(h)?.night.delta ?? 0; return a as number; }, h3);
  expect(after).toBeLessThan(0);
  expect(before).toBeGreaterThan(0);
});

test.describe("journey", () => {
  test.setTimeout(240_000);
  test("simulated night walk: heads-up before the stretch, then Guard mode with the one-hand dock", async ({ page }) => {
    await planRoute(page);
    await page.getByTestId("simulate-walk").click();
    await expect(page.getByTestId("journey")).toBeVisible();
    await expect(page.getByTestId("instruction")).toBeVisible();
    await expect(page.getByTestId("card-heads-up")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("sakhi-text").first()).not.toBeEmpty();
    await expect(page.getByTestId("guard")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("guard-overline")).toContainText(/guard mode/i);
    await expect(page.getByTestId("shake-chip")).toContainText("on");
    for (const id of ["tile-siren", "tile-share", "tile-fake", "tile-spot", "hold-sos"]) await expect(page.getByTestId(id)).toBeVisible();
    // every Guard control is in the bottom 60% of the screen and ≥ 56 px
    const vh = page.viewportSize()!.height;
    for (const id of ["tile-siren", "tile-share", "tile-fake", "tile-spot"]) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.y).toBeGreaterThan(vh * 0.4); expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(56);
    }
    await page.getByTestId("exit-guard").click();
    await expect(page.getByTestId("journey")).toBeVisible();
  });
});
