import { expect, type Page } from "@playwright/test";

export async function pin(page: Page, digits: string) {
  // the 4-digit pad submits itself on the 4th digit
  for (const d of digits) await page.getByTestId("pinpad").getByRole("button", { name: d, exact: true }).click();
  await page.waitForTimeout(450); // auto-submit delay + pad remount
}

/** Full onboarding: name, one contact, PIN + duress PIN, permissions. Ends on Home. */
export async function onboard(page: Page, opts: { name?: string; pin?: string; duress?: string } = {}) {
  const { name = "Riya", pin: p = "4821", duress = "1357" } = opts;
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
