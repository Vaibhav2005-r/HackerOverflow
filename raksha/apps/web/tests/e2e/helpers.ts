import { expect, type Page } from "@playwright/test";
import routes from "../fixtures/routes.json" with { type: "json" };

type R = { duration: number; distance: number; coords: [number, number][] };
const fixtures = routes as unknown as Record<string, R[]>;

/** OSRM-shaped response from recorded geometry (test fixtures only — the app itself ships no demo routes). */
const osrm = (rs: R[]) => ({
  code: "Ok",
  routes: rs.map((r) => ({
    duration: r.duration, distance: r.distance, geometry: { type: "LineString", coordinates: r.coords },
    legs: [{ steps: [
      { distance: r.distance * 0.4, name: "Test Road", maneuver: { type: "depart", modifier: "straight" } },
      { distance: r.distance * 0.5, name: "Link Road", maneuver: { type: "turn", modifier: "right" } },
      { distance: r.distance * 0.1, name: "", maneuver: { type: "arrive" } },
    ] }],
  })),
});

/**
 * Routing and geocoding are mocked, so tests are deterministic and offline-safe.
 * `route` picks which recorded route set OSRM "returns": "nightWalk" crosses weak stretches (heads-up → Guard), "calm" does not.
 */
export async function mockNetwork(page: Page, route: "nightWalk" | "calm" | "jaipur" = "nightWalk") {
  // "jaipur": a synthetic route in a city with no data pack, to test the no-coverage behaviour
  const line = (n: number): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [75.7885 + (i / n) * 0.012, 26.9196 + (i / n) * 0.002]);
  const jaipur: R[] = [{ duration: 900, distance: 1300, coords: line(40) }, { duration: 1000, distance: 1400, coords: line(40).map(([x, y], i) => [x, y + (i % 2 ? 0.0003 : 0)] as [number, number]) }];
  const set = route === "jaipur" ? jaipur : route === "nightWalk" ? fixtures["night-walk"]! : fixtures["tcet-kandivali"]!;
  await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ json: osrm(set) }));
  const places = route === "jaipur"
    ? { type: "FeatureCollection", features: [{ geometry: { coordinates: [75.8005, 26.9216] }, properties: { name: "Jaipur Junction", district: "Jaipur" } }] }
    : { type: "FeatureCollection", features: [
    { geometry: { coordinates: [72.8519, 19.2054] }, properties: { name: "Kandivali station", street: "Station Road", district: "Kandivali West" } },
    { geometry: { coordinates: [72.8493, 19.1864] }, properties: { name: "Malad station", district: "Malad West" } },
  ] };
  await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: places }));
  await page.route(/nominatim\.openstreetmap\.org/, (r) => r.fulfill({ json: [] }));
}

/** Test mode on, pretend it's night, fast simulated walks — set before the app boots. */
export async function testModeNight(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((patch) => {
    const k = "raksha:settings";
    if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ state: { testMode: true, demoBand: "night", simSpeed: 40, ...patch }, version: 0 }));
  }, extra);
}

export async function pin(page: Page, digits: string) {
  // the 4-digit pad submits itself on the 4th digit
  for (const d of digits) await page.getByTestId("pinpad").getByRole("button", { name: d, exact: true }).click();
  await page.waitForTimeout(450); // auto-submit delay + pad remount
}

/** Full onboarding: name, one contact, PIN + duress PIN, permissions. Ends on Home. */
export async function onboard(page: Page, opts: { name?: string; pin?: string; duress?: string; route?: "nightWalk" | "calm" | "jaipur"; testMode?: boolean } = {}) {
  const { name = "Riya", pin: p = "4821", duress = "1357", route = "nightWalk", testMode = true } = opts;
  await mockNetwork(page, route);
  if (testMode) await testModeNight(page);
  await page.goto("/");
  await expect(page.getByTestId("onboarding")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId("ob-next").click();
  await page.getByTestId("ob-name").fill(name);
  await page.getByTestId("ob-next").click();
  await page.getByTestId("ob-contact-name").fill("Maa");
  await page.getByTestId("ob-contact-phone").fill("+91 98765 43210");
  await page.getByTestId("ob-add-contact").click();
  await expect(page.getByTestId("circle-item")).toHaveCount(1);
  await page.getByTestId("ob-next").click();
  await pin(page, p); await pin(page, p); await pin(page, duress);
  await page.getByTestId("ob-grant").click();
  await page.getByTestId("ob-next").click(); // ready → start
  await expect(page.getByTestId("home")).toBeVisible();
}

/** Search for a destination and open the Plan sheet (real UI path: search pill → type → pick a result). */
export async function planRoute(page: Page, query = "Kandivali") {
  await page.getByTestId("search").click();
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("result-0").click();
  await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
}
