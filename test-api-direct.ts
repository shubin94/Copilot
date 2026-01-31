import fetch from "node-fetch";

async function testAdminAPI() {
  console.log("🧪 Testing Admin CMS API endpoints...\n");

  // We need to test without session first to see the auth error
  try {
    console.log("1️⃣ Testing GET /api/admin/categories (no auth)...");
    const getRes = await fetch("http://localhost:5000/api/admin/categories", {
      method: "GET",
    });
    console.log("Status:", getRes.status);
    const getData = await getRes.json();
    console.log("Response:", getData);
    
    console.log("\n2️⃣ Testing POST /api/admin/categories (no auth)...");
    const postRes = await fetch("http://localhost:5000/api/admin/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        name: "Test",
        slug: "test"
      }),
    });
    console.log("Status:", postRes.status);
    const postData = await postRes.json();
    console.log("Response:", postData);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAdminAPI();
