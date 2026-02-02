import "dotenv/config";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details: string[];
}

const results: TestResult[] = [];
const baseUrl = "http://localhost:5000";

// Admin auth token - we'll use the test to get authenticated
let adminToken: string | null = null;
let testCategoryId: string = "";
let testTag1Id: string = "";
let testTag2Id: string = "";
let testPageId: string = "";

async function authenticateAsAdmin(): Promise<void> {
  console.log("\n🔐 AUTHENTICATING AS ADMIN...\n");
  
  try {
    // SECURITY: Use environment variables for test credentials
    const adminEmail = process.env.TEST_ADMIN_EMAIL;
    const adminPassword = process.env.TEST_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.log("⚠️  TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD not set. Skipping authentication.");
      console.log("   Set these environment variables to test authenticated endpoints.\n");
      return;
    }
    
    // Try login with admin credentials from environment
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword
      })
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }
    
    const loginData = await loginRes.json();
    adminToken = loginData.user?.id || "admin";
    console.log(`✅ Authenticated as admin\n`);
  } catch (error: any) {
    console.log(`⚠️  Using fallback auth (API may allow unauthenticated access): ${error.message}\n`);
  }
}

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest", // CSRF header
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json().catch(() => null);
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

async function testCreateCategory(): Promise<void> {
  console.log("\n📋 TEST 1: CREATE CATEGORY\n");
  
  const result: TestResult = {
    name: "Create Category",
    passed: false,
    details: []
  };
  
  try {
    const response = await makeRequest("POST", "/api/admin/categories", {
      name: "Test Category",
      slug: "test-category-" + Date.now(),
      status: "draft"
    });
    
    result.details.push(`Status: ${response.status}`);
    
    if (!response.ok) {
      result.error = response.error || "Request failed";
      result.details.push(`Error: ${response.data?.error || response.error}`);
      console.log(`❌ FAILED: ${result.error}`);
    } else if (!response.data?.category?.id) {
      result.error = "No category ID in response";
      result.details.push(`Response: ${JSON.stringify(response.data)}`);
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      testCategoryId = response.data.category.id;
      result.passed = true;
      result.details.push(`Category ID: ${testCategoryId}`);
      result.details.push(`Name: ${response.data.category.name}`);
      result.details.push(`Status: ${response.data.category.status}`);
      console.log(`✅ PASSED`);
      console.log(`   - Created: ${response.data.category.name}`);
      console.log(`   - ID: ${testCategoryId}`);
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function testCreateTag(): Promise<void> {
  console.log("\n🏷️  TEST 2: CREATE TAG\n");
  
  const result: TestResult = {
    name: "Create Tag",
    passed: false,
    details: []
  };
  
  try {
    // Create first tag
    const response1 = await makeRequest("POST", "/api/admin/tags", {
      name: "Test Tag 1",
      slug: "test-tag-1-" + Date.now(),
      status: "published"
    });
    
    result.details.push(`Status: ${response1.status}`);
    
    if (!response1.ok) {
      result.error = response1.error || "Request failed";
      result.details.push(`Error: ${response1.data?.error || response1.error}`);
      console.log(`❌ FAILED: ${result.error}`);
    } else if (!response1.data?.tag?.id) {
      result.error = "No tag ID in response";
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      testTag1Id = response1.data.tag.id;
      result.details.push(`Tag 1 ID: ${testTag1Id}`);
      console.log(`✅ Tag 1 created: ${testTag1Id}`);
      
      // Create second tag
      const response2 = await makeRequest("POST", "/api/admin/tags", {
        name: "Test Tag 2",
        slug: "test-tag-2-" + Date.now(),
        status: "published"
      });
      
      if (response2.ok && response2.data?.tag?.id) {
        testTag2Id = response2.data.tag.id;
        result.passed = true;
        result.details.push(`Tag 2 ID: ${testTag2Id}`);
        console.log(`✅ Tag 2 created: ${testTag2Id}`);
      } else {
        result.error = "Failed to create second tag";
        result.details.push(`Error: ${response2.data?.error || response2.error}`);
        console.log(`⚠️  Second tag creation failed`);
      }
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function testCreatePage(): Promise<void> {
  console.log("\n📄 TEST 3: CREATE PAGE WITH CATEGORY + TAG\n");
  
  const result: TestResult = {
    name: "Create Page",
    passed: false,
    details: []
  };
  
  try {
    if (!testCategoryId || !testTag1Id) {
      result.error = "Missing category or tag ID";
      result.details.push("Cannot create page without category and tag");
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      const response = await makeRequest("POST", "/api/admin/pages", {
        title: "Test Page",
        slug: "test-page-" + Date.now(),
        categoryId: testCategoryId,
        content: "# Test Page\n\nThis is a test page content.",
        tagIds: [testTag1Id],
        status: "draft"
      });
      
      result.details.push(`Status: ${response.status}`);
      
      if (!response.ok) {
        result.error = response.error || "Request failed";
        result.details.push(`Error: ${response.data?.error || response.error}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else if (!response.data?.page?.id) {
        result.error = "No page ID in response";
        result.details.push(`Response: ${JSON.stringify(response.data)}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        testPageId = response.data.page.id;
        result.passed = true;
        result.details.push(`Page ID: ${testPageId}`);
        result.details.push(`Title: ${response.data.page.title}`);
        result.details.push(`Category: ${response.data.page.categoryId}`);
        result.details.push(`Tags: ${response.data.page.tags?.length || 0}`);
        console.log(`✅ PASSED`);
        console.log(`   - Created: ${response.data.page.title}`);
        console.log(`   - ID: ${testPageId}`);
        console.log(`   - Tags: ${response.data.page.tags?.length || 0}`);
      }
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function testEditPage(): Promise<void> {
  console.log("\n✏️  TEST 4: EDIT PAGE\n");
  
  const result: TestResult = {
    name: "Edit Page",
    passed: false,
    details: []
  };
  
  try {
    if (!testPageId) {
      result.error = "No page ID to edit";
      result.details.push("Cannot edit page - page not created");
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      const response = await makeRequest("PATCH", `/api/admin/pages/${testPageId}`, {
        title: "Updated Test Page",
        content: "# Updated Content\n\nThis page was edited.",
        status: "published",
        tagIds: [testTag1Id, testTag2Id] // Add second tag
      });
      
      result.details.push(`Status: ${response.status}`);
      
      if (!response.ok) {
        result.error = response.error || "Request failed";
        result.details.push(`Error: ${response.data?.error || response.error}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else if (!response.data?.page?.id) {
        result.error = "No page data in response";
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        result.passed = true;
        result.details.push(`Updated title: ${response.data.page.title}`);
        result.details.push(`Updated status: ${response.data.page.status}`);
        result.details.push(`Updated tags count: ${response.data.page.tags?.length || 0}`);
        console.log(`✅ PASSED`);
        console.log(`   - New title: ${response.data.page.title}`);
        console.log(`   - Status: ${response.data.page.status}`);
        console.log(`   - Tags: ${response.data.page.tags?.length || 0}`);
      }
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function testDeleteTag(): Promise<void> {
  console.log("\n🗑️  TEST 5: DELETE TAG\n");
  
  const result: TestResult = {
    name: "Delete Tag",
    passed: false,
    details: []
  };
  
  try {
    if (!testTag2Id) {
      result.error = "No tag ID to delete";
      result.details.push("Cannot delete tag - tag not created");
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      // Delete unused tag (tag2)
      console.log("Attempting to delete unused tag...");
      const response = await makeRequest("DELETE", `/api/admin/tags/${testTag2Id}`);
      
      result.details.push(`Status: ${response.status}`);
      
      if (!response.ok) {
        result.error = response.error || "Request failed";
        result.details.push(`Error: ${response.data?.error || response.error}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        result.passed = true;
        result.details.push("Unused tag deleted successfully");
        console.log(`✅ PASSED - Unused tag deleted`);
        
        // Note: We can't actually delete tag1 because it's used by the page
        // So we test that the validation is in place
        result.details.push("Note: Cannot test deleting used tag (would require cascading)");
      }
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function testToggleStatus(): Promise<void> {
  console.log("\n🔄 TEST 6: TOGGLE STATUS (DRAFT ↔ PUBLISHED)\n");
  
  const result: TestResult = {
    name: "Toggle Status",
    passed: false,
    details: []
  };
  
  try {
    if (!testPageId) {
      result.error = "No page ID";
      result.details.push("Cannot toggle status - no page");
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      // Current status should be "published" from edit test
      // Toggle to draft
      const response1 = await makeRequest("PATCH", `/api/admin/pages/${testPageId}`, {
        status: "draft"
      });
      
      result.details.push(`Toggle 1 Status: ${response1.status}`);
      
      if (!response1.ok) {
        result.error = "Failed to toggle status";
        result.details.push(`Error: ${response1.data?.error || response1.error}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else if (response1.data?.page?.status !== "draft") {
        result.error = `Status is ${response1.data?.page?.status}, expected draft`;
        result.details.push(`Actual status: ${response1.data?.page?.status}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        console.log(`✅ Toggled to draft`);
        
        // Toggle back to published
        const response2 = await makeRequest("PATCH", `/api/admin/pages/${testPageId}`, {
          status: "published"
        });
        
        if (!response2.ok || response2.data?.page?.status !== "published") {
          result.error = "Failed to toggle back to published";
          result.details.push(`Error toggling back`);
          console.log(`❌ FAILED: ${result.error}`);
        } else {
          result.passed = true;
          result.details.push(`Final status: ${response2.data?.page?.status}`);
          console.log(`✅ PASSED - Toggled back to published`);
          console.log(`   - Final status: ${response2.data?.page?.status}`);
        }
      }
    }
  } catch (error: any) {
    result.error = error.message;
    result.details.push(`Exception: ${error.message}`);
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  results.push(result);
}

async function cleanup(): Promise<void> {
  console.log("\n🧹 CLEANING UP TEST DATA...\n");
  
  try {
    if (testPageId) {
      await makeRequest("DELETE", `/api/admin/pages/${testPageId}`);
      console.log("✅ Test page deleted");
    }
    
    if (testTag1Id) {
      await makeRequest("DELETE", `/api/admin/tags/${testTag1Id}`);
      console.log("✅ Test tag 1 deleted");
    }
    
    if (testCategoryId) {
      await makeRequest("DELETE", `/api/admin/categories/${testCategoryId}`);
      console.log("✅ Test category deleted");
    }
    
    console.log("");
  } catch (error: any) {
    console.log(`⚠️  Cleanup warning: ${error.message}\n`);
  }
}

function printReport(): void {
  console.log("\n" + "=".repeat(70));
  console.log("CMS ADMIN SMOKE TEST - FINAL REPORT");
  console.log("=".repeat(70) + "\n");
  
  let passCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.name}`);
    
    if (!result.passed) {
      failCount++;
      console.log(`     Error: ${result.error}`);
      for (const detail of result.details) {
        console.log(`     • ${detail}`);
      }
    } else {
      passCount++;
    }
    console.log("");
  }
  
  console.log("=".repeat(70));
  console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${results.length} tests`);
  console.log("=".repeat(70) + "\n");
  
  if (failCount === 0) {
    console.log("🎉 ALL TESTS PASSED - CMS ADMIN SYSTEM IS WORKING!\n");
    process.exit(0);
  } else {
    console.log("⚠️  SOME TESTS FAILED - Please review the errors above.\n");
    process.exit(1);
  }
}

async function runAllTests(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("CMS ADMIN END-TO-END SMOKE TEST");
  console.log("=".repeat(70));
  
  await authenticateAsAdmin();
  await testCreateCategory();
  await testCreateTag();
  await testCreatePage();
  await testEditPage();
  await testDeleteTag();
  await testToggleStatus();
  await cleanup();
  printReport();
}

// Run tests
runAllTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
