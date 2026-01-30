// Test the actual API
async function testAPI() {
  try {
    console.log("Testing /api/public/pages/sdfds...");
    const res = await fetch("http://localhost:5000/api/public/pages/sdfds");
    const text = await res.text();
    
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    console.log("Body:", text);
    
    if (res.ok) {
      const data = JSON.parse(text);
      console.log("\n✅ SUCCESS - Parsed data:", JSON.stringify(data, null, 2));
    } else {
      console.log("\n❌ FAILED:", text);
    }
  } catch (error) {
    console.error("❌ Request error:", error instanceof Error ? error.message : error);
  }
}

testAPI();
