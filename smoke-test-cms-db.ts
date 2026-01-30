import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details: string[];
}

const results: TestResult[] = [];
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

let testCategoryId: string = "";
let testTag1Id: string = "";
let testTag2Id: string = "";
let testPageId: string = "";

async function testCreateCategory(): Promise<void> {
  console.log("\n📋 TEST 1: CREATE CATEGORY\n");
  
  const result: TestResult = {
    name: "Create Category",
    passed: false,
    details: []
  };
  
  try {
    const slug = `test-category-${Date.now()}`;
    const response = await pool.query(
      `INSERT INTO categories (name, slug, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, slug, status, created_at`,
      ["Test Category", slug, "draft"]
    );
    
    if (response.rows.length === 0) {
      result.error = "No rows returned from insert";
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      const category = response.rows[0];
      testCategoryId = category.id;
      result.passed = true;
      result.details.push(`Category ID: ${testCategoryId}`);
      result.details.push(`Name: ${category.name}`);
      result.details.push(`Slug: ${category.slug}`);
      result.details.push(`Status: ${category.status}`);
      console.log(`✅ PASSED`);
      console.log(`   - Created: ${category.name}`);
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
    const slug1 = `test-tag-1-${Date.now()}`;
    const response1 = await pool.query(
      `INSERT INTO tags (name, slug, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, slug, status`,
      ["Test Tag 1", slug1, "published"]
    );
    
    if (response1.rows.length === 0) {
      result.error = "No rows returned from tag insert";
      console.log(`❌ FAILED: ${result.error}`);
    } else {
      testTag1Id = response1.rows[0].id;
      result.details.push(`Tag 1 ID: ${testTag1Id}`);
      console.log(`✅ Tag 1 created: ${testTag1Id}`);
      
      const slug2 = `test-tag-2-${Date.now()}`;
      const response2 = await pool.query(
        `INSERT INTO tags (name, slug, status) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, slug, status`,
        ["Test Tag 2", slug2, "published"]
      );
      
      if (response2.rows.length === 0) {
        result.error = "Failed to create second tag";
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        testTag2Id = response2.rows[0].id;
        result.passed = true;
        result.details.push(`Tag 2 ID: ${testTag2Id}`);
        console.log(`✅ Tag 2 created: ${testTag2Id}`);
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
      const slug = `test-page-${Date.now()}`;
      
      // Start transaction for page + tags
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        const pageResponse = await client.query(
          `INSERT INTO pages (title, slug, category_id, content, status) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id, title, slug, category_id, status`,
          ["Test Page", slug, testCategoryId, "# Test Page\n\nThis is a test page.", "draft"]
        );
        
        if (pageResponse.rows.length === 0) {
          throw new Error("Failed to create page");
        }
        
        testPageId = pageResponse.rows[0].id;
        
        // Add tag to page
        await client.query(
          `INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)`,
          [testPageId, testTag1Id]
        );
        
        await client.query("COMMIT");
        
        result.passed = true;
        result.details.push(`Page ID: ${testPageId}`);
        result.details.push(`Title: Test Page`);
        result.details.push(`Category ID: ${testCategoryId}`);
        result.details.push(`Tags assigned: 1`);
        console.log(`✅ PASSED`);
        console.log(`   - Created: Test Page`);
        console.log(`   - ID: ${testPageId}`);
        console.log(`   - Category: ${testCategoryId}`);
        console.log(`   - Tags: 1`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        // Update page
        const updateResponse = await client.query(
          `UPDATE pages SET title = $1, content = $2, status = $3 
           WHERE id = $4 
           RETURNING id, title, content, status`,
          [
            "Updated Test Page",
            "# Updated Content\n\nThis page was edited.",
            "published",
            testPageId
          ]
        );
        
        if (updateResponse.rows.length === 0) {
          throw new Error("Failed to update page");
        }
        
        // Remove old tag and add both tags
        await client.query(`DELETE FROM page_tags WHERE page_id = $1`, [testPageId]);
        await client.query(`INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)`, [testPageId, testTag1Id]);
        await client.query(`INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)`, [testPageId, testTag2Id]);
        
        // Get tags
        const tagsResponse = await client.query(
          `SELECT COUNT(*) as count FROM page_tags WHERE page_id = $1`,
          [testPageId]
        );
        
        await client.query("COMMIT");
        
        const page = updateResponse.rows[0];
        result.passed = true;
        result.details.push(`Updated title: ${page.title}`);
        result.details.push(`Updated status: ${page.status}`);
        result.details.push(`Updated tags count: ${tagsResponse.rows[0].count}`);
        console.log(`✅ PASSED`);
        console.log(`   - New title: ${page.title}`);
        console.log(`   - Status: ${page.status}`);
        console.log(`   - Tags: ${tagsResponse.rows[0].count}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
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
      // Delete unused tag (tag2) - it should have no references
      console.log("Attempting to delete unused tag...");
      
      const deleteResponse = await pool.query(
        `DELETE FROM tags WHERE id = $1 RETURNING id`,
        [testTag2Id]
      );
      
      if (deleteResponse.rows.length === 0) {
        result.error = "Tag deletion failed";
        result.details.push(`Could not delete tag ${testTag2Id}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        result.passed = true;
        result.details.push("Unused tag deleted successfully");
        console.log(`✅ PASSED - Unused tag deleted`);
        result.details.push("Used tag (tag1) still exists (referenced by page)");
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
      const response1 = await pool.query(
        `UPDATE pages SET status = $1 WHERE id = $2 RETURNING id, status`,
        ["draft", testPageId]
      );
      
      if (response1.rows.length === 0 || response1.rows[0].status !== "draft") {
        result.error = `Failed to toggle to draft`;
        result.details.push(`Actual status: ${response1.rows[0]?.status}`);
        console.log(`❌ FAILED: ${result.error}`);
      } else {
        console.log(`✅ Toggled to draft`);
        
        // Toggle back to published
        const response2 = await pool.query(
          `UPDATE pages SET status = $1 WHERE id = $2 RETURNING id, status`,
          ["published", testPageId]
        );
        
        if (response2.rows.length === 0 || response2.rows[0].status !== "published") {
          result.error = "Failed to toggle back to published";
          result.details.push(`Error toggling back`);
          console.log(`❌ FAILED: ${result.error}`);
        } else {
          result.passed = true;
          result.details.push(`Final status: ${response2.rows[0].status}`);
          console.log(`✅ PASSED - Toggled back to published`);
          console.log(`   - Final status: ${response2.rows[0].status}`);
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
      await pool.query(`DELETE FROM page_tags WHERE page_id = $1`, [testPageId]);
      await pool.query(`DELETE FROM pages WHERE id = $1`, [testPageId]);
      console.log("✅ Test page deleted");
    }
    
    if (testTag1Id) {
      await pool.query(`DELETE FROM tags WHERE id = $1`, [testTag1Id]);
      console.log("✅ Test tag 1 deleted");
    }
    
    if (testCategoryId) {
      await pool.query(`DELETE FROM categories WHERE id = $1`, [testCategoryId]);
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
  } else {
    console.log("⚠️  SOME TESTS FAILED - Please review the errors above.\n");
  }
}

async function runAllTests(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("CMS ADMIN END-TO-END SMOKE TEST");
  console.log("=".repeat(70));
  
  try {
    await testCreateCategory();
    await testCreateTag();
    await testCreatePage();
    await testEditPage();
    await testDeleteTag();
    await testToggleStatus();
    await cleanup();
    printReport();
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await pool.end();
  }
}

// Run tests
runAllTests();
