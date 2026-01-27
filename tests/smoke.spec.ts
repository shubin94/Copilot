import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("nav");
  await expect(nav).toBeVisible();
});

test("search loads and controls", async ({ page }) => {
  await page.goto("/search");
  const heading = page.locator('[data-testid="text-search-heading"]');
  await expect(heading).toBeVisible();
  const sort = page.locator('[data-testid="button-sort-dropdown"]');
  await expect(sort).toBeVisible();
});

test("navigate to a service if available", async ({ page }) => {
  await page.goto("/search");
  const anyService = page.locator('a[href^="/service/"]');
  const count = await anyService.count();
  if (count > 0) {
    await anyService.first().click();
    const title = page.locator('[data-testid="text-service-title"]');
    await expect(title).toBeVisible();
    const nameRow = page.locator('[data-testid="text-detective-name"]');
    await expect(nameRow).toBeVisible();
  } else {
    await page.waitForTimeout(200);
  }
});

test("open detective page via name if possible", async ({ page }) => {
  await page.goto("/search");
  const anyService = page.locator('a[href^="/service/"]');
  const has = await anyService.count();
  if (has > 0) {
    await anyService.first().click();
    const nameLink = page.locator('[data-testid="text-detective-name"] a');
    const linkCount = await nameLink.count();
    if (linkCount > 0) {
      await nameLink.first().click();
      const detName = page.locator('[data-testid="text-detective-name"]');
      await expect(detName).toBeVisible();
    }
  } else {
    await page.waitForTimeout(200);
  }
});

test("favorites page loads", async ({ page }) => {
  await page.goto("/user/favorites");
  const title = page.locator("h1");
  await expect(title).toBeVisible();
});

test("static pages load", async ({ page }) => {
  const paths = [
    "/about",
    "/privacy",
    "/terms",
    "/packages",
    "/blog",
    "/support",
    "/contact",
  ];
  for (const p of paths) {
    await page.goto(p);
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  }
});

