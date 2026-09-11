import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated user-story tests.");

test("sign in, visit core flows, and sign out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/home|onboarding/);

  for (const path of ["/money", "/habits", "/focus", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }

  await page.getByRole("button", { name: /account|user|menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out|log out/i }).click();
  await expect(page).toHaveURL(/login|sign-in|auth|\/$/);
});
