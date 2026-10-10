import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const scan = async (page: Page, label: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".maplibregl-map").exclude("[data-testid=map]").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
};

test.beforeEach(async ({ page }) => { await onboard(page); await page.waitForTimeout(1500); });

test("axe: Home has no serious or critical violations (night)", async ({ page }) => { await scan(page, "home"); });

test("axe: Home in the day theme", async ({ page }) => {
  await page.getByTestId("time-band").click(); // night → day
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await scan(page, "home-day");
});

test("axe: Guard", async ({ page }) => {
  await page.getByTestId("guard-now").click();
  await expect(page.getByTestId("guard")).toBeVisible();
  await page.waitForTimeout(800);
  await scan(page, "guard");
});

test("axe: SOS (silent) and the PIN screen", async ({ page }) => {
  const b = await page.getByTestId("hold-sos").first().boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2); await page.mouse.down(); await page.waitForTimeout(2300); await page.mouse.up();
  await expect(page.getByTestId("sos-screen")).toBeVisible();
  await page.waitForTimeout(800);
  await scan(page, "sos");
  await page.getByTestId("sos-cancel").click();
  await scan(page, "sos-pin");
});

test("axe: Search and Plan", async ({ page }) => {
  await page.getByTestId("search").click();
  await page.waitForTimeout(800);
  await scan(page, "search");
  await page.getByTestId("demo-tcet-kandivali").click();
  await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await scan(page, "plan");
});
