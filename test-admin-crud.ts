import fetch from "node-fetch";

const BASE_URL = "http://localhost:5000";
const CSRF_TOKEN = "test-token"; // Will be set from session

let userId: string;
let categoryId: string;
let tagId: string;
let pageId: string;

// Helper to make API calls with CSRF and session
async function apiCall(
  endpoint: string,
  method: string,
  body?: any
): Promise<any> {
  const headers: any = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  console.log(`\n[${method}] ${endpoint}`);
  if (body) {
    console.log("Body:", JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include" as any,
    });

    const contentType = response.headers.get("content-type");
    let result;
    if (contentType?.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error(`❌ FAILED: ${response.status}`);
      return null;
    }

    console.log("✅ SUCCESS");
    return result;
  } catch (error) {
    console.error("❌ ERROR:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function runTests() {
  console.log("=".repeat(80));
  console.log("STEP 4: ADMIN CRUD VERIFICATION");
  console.log("=".repeat(80));

  console.log("\n--- TEST 1: Create Category ---");
  const categoryResult = await apiCall("/api/admin/categories", "POST", {
    name: "Test Category",
    slug: "test-category",
    status: "published",
  });
  if (categoryResult?.category) {
    categoryId = categoryResult.category.id;
    console.log(`Category created: ${categoryId}`);
  }

  console.log("\n--- TEST 2: Get Categories ---");
  await apiCall("/api/admin/categories", "GET");

  console.log("\n--- TEST 3: Create Tag ---");
  const tagResult = await apiCall("/api/admin/tags", "POST", {
    name: "Test Tag",
    slug: "test-tag",
    status: "published",
  });
  if (tagResult?.tag) {
    tagId = tagResult.tag.id;
    console.log(`Tag created: ${tagId}`);
  }

  console.log("\n--- TEST 4: Get Tags ---");
  await apiCall("/api/admin/tags", "GET");

  console.log("\n--- TEST 5: Create Page ---");
  const pageResult = await apiCall("/api/admin/pages", "POST", {
    title: "Test Page",
    slug: "test-page",
    categoryId: categoryId,
    content: "This is test content",
    tagIds: [tagId].filter(Boolean),
    status: "draft",
    metaTitle: "Test Meta Title",
    metaDescription: "Test Meta Description",
  });
  if (pageResult?.page) {
    pageId = pageResult.page.id;
    console.log(`Page created: ${pageId}`);
  }

  console.log("\n--- TEST 6: Get Pages ---");
  await apiCall("/api/admin/pages", "GET");

  console.log("\n--- TEST 7: Update Page (change to published) ---");
  await apiCall(`/api/admin/pages/${pageId}`, "PATCH", {
    status: "published",
  });

  console.log("\n--- TEST 8: Update Category ---");
  await apiCall(`/api/admin/categories/${categoryId}`, "PATCH", {
    name: "Updated Category Name",
  });

  console.log("\n--- TEST 9: Update Tag ---");
  await apiCall(`/api/admin/tags/${tagId}`, "PATCH", {
    name: "Updated Tag Name",
  });

  console.log("\n--- TEST 10: Delete Page ---");
  await apiCall(`/api/admin/pages/${pageId}`, "DELETE", {});

  console.log("\n" + "=".repeat(80));
  console.log("STEP 4 TESTS COMPLETE");
  console.log("=".repeat(80));
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
