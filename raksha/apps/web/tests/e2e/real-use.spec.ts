import { expect, test } from "@playwright/test";
import { onboard, mockNetwork } from "./helpers";

test.describe("normal use (Test mode off)", () => {
  test("no demo or test tooling is visible; the clock is the real clock", async ({ page }) => {
    await onboard(page, { testMode: false });
    await expect(page.getByTestId("time-band")).toBeDisabled();           // only cycles in Test mode
    await expect(page.getByText(/demo/i)).toHaveCount(0);
    await page.goto("/settings");
    await expect(page.getByTestId("test-tools")).toHaveCount(0);
    await expect(page.getByTestId("sim-shake")).toHaveCount(0);
    await page.getByTestId("toggle-test-mode").click();                    // opt-in
    await expect(page.getByTestId("test-tools")).toBeVisible();
  });

  test("routes start from her real location and there is no 'Simulate walk' button", async ({ page }) => {
    await onboard(page, { testMode: false });
    await page.getByTestId("search").click();
    await page.getByTestId("search-input").fill("Kandivali");
    await page.getByTestId("result-0").click();
    await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("change-start")).toContainText("My location");
    await expect(page.getByTestId("simulate-walk")).toHaveCount(0);
  });
});

test.describe("location denied", () => {
  test.use({ permissions: [] });
  test("asks for a start point, then plans from it", async ({ page }) => {
    await onboard(page, { testMode: false });
    await page.getByTestId("search").click();
    await page.getByTestId("search-input").fill("Kandivali");
    await page.getByTestId("result-0").click();
    await expect(page.getByTestId("toast")).toContainText(/start point/i);
    await expect(page.getByTestId("search-input")).toHaveAttribute("placeholder", /starting from/i);
    await page.getByTestId("search-input").fill("Malad");
    await page.getByTestId("result-1").click();
    await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("change-start")).toContainText("Malad station");
  });
});

test.describe("outside every city pack", () => {
  test.use({ geolocation: { latitude: 26.9124, longitude: 75.7873 } }); // Jaipur: no pack yet
  test("says so honestly, and routes still work (scored cautiously)", async ({ page }) => {
    await onboard(page, { testMode: false });
    await expect(page.getByTestId("no-coverage")).toBeVisible({ timeout: 15_000 });
    await mockNetwork(page, "jaipur");
    await page.getByTestId("search").click();
    await page.getByTestId("search-input").fill("Jaipur");
    await page.getByTestId("result-0").click();
    await expect(page.getByTestId("route-card-safest")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("limited-data")).toBeVisible();          // unknown cells are never shown as comfortable
  });
});

test("Hindi: the language switch changes the UI and Sakhi's lines, and the page language follows", async ({ page }) => {
  await onboard(page, { testMode: false });
  await page.goto("/settings");
  await page.getByTestId("lang-hi").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "सेटिंग्स" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("search")).toContainText("कहाँ जाना है?");
  await expect(page.getByTestId("sakhi-text")).toContainText(/[ऀ-ॿ]/);    // Sakhi greets in Devanagari
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain("Mukta");
});
