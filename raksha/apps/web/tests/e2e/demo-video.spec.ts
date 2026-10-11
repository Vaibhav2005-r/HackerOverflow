import { test, type Page } from "@playwright/test";
import { onboard, planRoute } from "./helpers";

// Records docs/demo.webm — run with: DEMO_VIDEO=1 pnpm --filter web test:e2e demo-video
test.skip(!process.env.DEMO_VIDEO, "only when recording the demo");
test.use({ video: { mode: "on", size: { width: 390, height: 844 } }, viewport: { width: 390, height: 844 } });

const hold = async (page: Page, ms: number) => {
  const b = await page.getByTestId("hold-sos").first().boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
};

test("Raksha demo", async ({ page }) => {
  await onboard(page);
  await page.waitForTimeout(3500);                 // map + safety hexes + Sakhi orb
  await planRoute(page);
  await page.waitForTimeout(4000);                 // routes, comfort scores, trade-off text
  await page.getByTestId("route-card-safest").getByRole("button").click();
  await page.waitForTimeout(3500);                 // weak stretches explained
  await page.goto("/");
  await page.waitForTimeout(1500);
  await hold(page, 2400);                          // hold-to-SOS
  await page.waitForTimeout(4000);
  await page.close();
});
