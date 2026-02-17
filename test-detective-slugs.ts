/**
 * Quick test to verify detective slugs are in the API response
 * Run with: npm tsx test-detective-slugs.ts
 */

async function testDetectiveSlugEndpoint() {
  try {
    console.log("Testing /api/detectives endpoint...\n");
    
    // Test 1: Fetch first 3 detectives
    const res = await fetch('http://localhost:3000/api/detectives?limit=3', {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) {
      console.error(`❌ API error: ${res.status} ${res.statusText}`);
      return;
    }
    
    const data = await res.json();
    const detectives = data.detectives || [];
    
    console.log(`Found ${detectives.length} detectives:\n`);
    
    if (detectives.length === 0) {
      console.log("❌ No detectives returned from API");
      return;
    }
    
    detectives.forEach((detective: any, index: number) => {
      console.log(`[${index + 1}] ${detective.businessName || detective.id}`);
      console.log(`    ID: ${detective.id}`);
      console.log(`    Slug: ${detective.slug || '❌ MISSING'}`);
      console.log(`    Country: ${detective.country}`);
      console.log(`    State: ${detective.state}`);
      console.log(`    City: ${detective.city}`);
      console.log('');
    });
    
    // Count missing slugs
    const missingSlugs = detectives.filter((d: any) => !d.slug).length;
    if (missingSlugs > 0) {
      console.log(`\n⚠️  WARNING: ${missingSlugs} detectives are missing slugs!`);
    } else {
      console.log(`\n✅ All detectives have slugs!`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  }
}

testDetectiveSlugEndpoint();
