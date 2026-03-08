/**
 * Test the API endpoint
 */
async function testApi() {
  try {
    const response = await fetch("http://localhost:5000/api/locations/top");
    const data = await response.json();
    
    console.log("\n✨ API Response:\n");
    console.log(JSON.stringify(data, null, 2));
    
    console.log("\n📊 Summary:");
    console.log(`  Countries: ${data.countries?.length || 0}`);
    console.log(`  States: ${data.states?.length || 0}`);
    console.log(`  Cities: ${data.cities?.length || 0}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

testApi();
