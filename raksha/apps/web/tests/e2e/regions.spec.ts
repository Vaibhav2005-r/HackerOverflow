import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

// State-wide coverage: places that are NOT in any city pack are served from on-demand state tiles.
const PLACES = [
  { name: "Nashik, Maharashtra", lat: 19.9975, lng: 73.7898, state: "Maharashtra" },
  { name: "Bhopal, Madhya Pradesh", lat: 23.2599, lng: 77.4126, state: "Madhya Pradesh" },
  { name: "Siliguri, West Bengal", lat: 26.7271, lng: 88.3953, state: "West Bengal" },
];

for (const p of PLACES) {
  test.describe(p.name, () => {
    test.use({ geolocation: { latitude: p.lat, longitude: p.lng } });

    test("is covered by state tiles: hexes draw, no 'no data' notice, NCRB shows the state's rank", async ({ page }) => {
      await onboard(page, { testMode: false });
      await expect.poll(() => page.evaluate(() => (window as any).__raksha.city.getState().cells.size as number), { timeout: 30_000 }).toBeGreaterThan(500);
      await expect(page.getByTestId("no-coverage")).toHaveCount(0);
      await page.getByTestId("open-district").click();
      await expect(page.getByTestId("ncrb-total")).toHaveText(/\d/, { timeout: 15_000 });
      await expect(page.getByTestId("ncrb-state-rank")).toContainText(p.state.split(",")[0]!);
      await expect(page.getByTestId("ncrb-caveat")).toContainText("not used in the street-level safety score");
    });
  });
}

test.describe("route across tiles", () => {
  test.use({ geolocation: { latitude: 19.9975, longitude: 73.7898 } });
  test("a long route loads the tiles along it before it is scored (no 'limited data' on covered ground)", async ({ page }) => {
    // Nashik → Pune-ish: a synthetic straight route through Maharashtra, far longer than one tile
    await onboard(page, { testMode: false });
    await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ json: { code: "Ok", routes: [{ duration: 14400, distance: 210000,
      geometry: { type: "LineString", coordinates: Array.from({ length: 101 }, (_, i) => [73.79 + (i / 100) * 0.1, 19.99 - (i / 100) * 1.45]) }, legs: [{ steps: [] }] }] } }) });
    await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { type: "FeatureCollection", features: [{ geometry: { coordinates: [73.89, 18.54] }, properties: { name: "Somewhere south" } }] } }));
    await page.getByTestId("search").click();
    await page.getByTestId("search-input").fill("south");
    await page.getByTestId("result-0").click();
    await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 30_000 });
    const tiles = await page.evaluate(() => (window as any).__raksha.city.getState().cells.size as number);
    expect(tiles).toBeGreaterThan(2000);                                           // many tiles, not just the one under her feet
  });
});
