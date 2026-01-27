import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";

test.describe("admin flows", () => {
  test.beforeEach(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) test.skip(true, "Admin credentials not provided");
  });

  test("admin can login and view dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('[data-testid="button-login"]');
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 5000 });
    await expect(page.locator("text=Admin Dashboard")).toBeVisible({ timeout: 5000 });
  });

  test("admin can open signups and approve via API", async ({ page, request }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('[data-testid="button-login"]');
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 5000 });

    await page.goto("/admin/signups");
    await expect(page.locator("text=Signups")).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    const email = `applicant.${ts}@example.com`;
    const body = {
      email,
      password: "Password123!",
      fullName: "Applicant Test",
      businessType: "individual",
      phoneCountryCode: "+1",
      phoneNumber: "5550000000",
      fullAddress: "123 Test St",
      pincode: "12345",
      documents: ["https://example.com/doc.png"],
      serviceCategories: ["Surveillance"],
      categoryPricing: [{ category: "Surveillance", price: "100", currency: "USD" }],
    };
    const create = await request.post("/api/applications", { data: body });
    expect(create.ok()).toBeTruthy();
    const app = await create.json();
    const id = (app as any)?.application?.id;
    expect(id).toBeTruthy();

    const approve = await request.patch(`/api/applications/${id}`, { data: { status: "approved" } });
    expect(approve.ok()).toBeTruthy();

    await page.reload();
    await expect(page.locator("text=approved")).toBeVisible({ timeout: 5000 });
  });
});

