import { test, expect } from "@playwright/test";

function randomEmail(prefix = "testuser") {
  const ts = Date.now();
  return `${prefix}.${ts}@example.com`;
}

const PASSWORD = "Password123!";
const REVIEW_TEXT = "Great professional service! Very responsive.";

test("user can register, login, and submit review", async ({ page, request }) => {
  const email = randomEmail();

  const reg = await request.post("/api/auth/register", {
    data: { email, password: PASSWORD, name: "Test User" },
  });
  expect(reg.ok()).toBeTruthy();

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('[data-testid="button-login"]');

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 });
  await expect(page.locator("nav")).toBeVisible();

  await page.goto("/search");
  const anyService = page.locator('a[href^="/service/"]');
  const count = await anyService.count();
  if (count === 0) test.skip(true, "No services to review");

  await anyService.first().click();
  await expect(page.locator('[data-testid="text-service-title"]')).toBeVisible();

  const stars = page.locator(".h-6.w-6.cursor-pointer");
  const starCount = await stars.count();
  if (starCount > 0) {
    await stars.nth(4).click();
  }
  await page.fill("#comment", REVIEW_TEXT);
  const submitBtn = page.getByRole("button", { name: /submit review|update review/i });
  await submitBtn.click();

  await expect(page.locator("text=Review submitted")).toBeVisible({ timeout: 4000 });
});

