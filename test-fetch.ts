// Simple direct fetch test
async function test() {
  console.log("Testing /api/public/pages/sdfds...");
  
  try {
    const response = await fetch("http://localhost:5000/api/public/pages/sdfds", {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
    
    if (response.ok) {
      try {
        const data = JSON.parse(text);
        console.log("\n✅ SUCCESS:");
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log("(Not JSON)");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

test();
