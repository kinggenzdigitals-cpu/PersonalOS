import { test, expect } from "@playwright/test";

for (const path of ["/", "/pricing", "/privacy", "/terms", "/robots.txt", "/sitemap.xml"]) {
  test(`public smoke: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
  });
}

test("auth redirects protected pages to sign in", async ({ page }) => {
  await page.goto("/money");
  await expect(page).toHaveURL(/login|sign-in|auth/);
});
