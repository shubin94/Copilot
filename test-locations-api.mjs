/**
 * Test the location API endpoints
 */

async function testLocationApi() {
  try {
    console.log("Testing /api/locations/countries...");
    
    const response = await fetch('http://localhost:5000/api/locations/countries', {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    const countries = data.countries || [];
    
    console.log(`✅ Found ${countries.length} countries:\n`);
    
    // Show first 10
    countries.slice(0, 10).forEach((country, i) => {
      console.log(`[${i+1}] ${country.name} (${country.code})`);
    });
    
    if (countries.length > 10) {
      console.log(`... and ${countries.length - 10} more`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  }
}

testLocationApi();
