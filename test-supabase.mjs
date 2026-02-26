// Test Supabase connectivity
const testUrls = [
  'https://gjgrwxxtkyggwfrydpdb.supabase.co/storage/v1/health',
  'https://gjgrwxxtkyggwfrydpdb.supabase.co/storage/v1/object/public/detective-assets/',
];

console.log('🧪 Testing Supabase connectivity...\n');

for (const url of testUrls) {
  console.log(`Testing: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const start = Date.now();
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    const duration = Date.now() - start;
    
    clearTimeout(timeout);
    
    console.log(`✅ Status: ${response.status} (${duration}ms)`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
  } catch (error) {
    console.log(`❌ FAILED: ${error.name} - ${error.message}`);
  }
  console.log();
}

console.log('Testing full URL with actual image path...');
const imageUrl = 'https://gjgrwxxtkyggwfrydpdb.supabase.co/storage/v1/object/public/detective-assets/detectives/04ac1e33-66ed-4e67-804e-f2fe31dce37a-logo.png';

try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  const start = Date.now();
  const response = await fetch(imageUrl, {
    method: 'GET',
    signal: controller.signal,
  });
  const duration = Date.now() - start;
  
  clearTimeout(timeout);
  
  console.log(`✅ Status: ${response.status} (${duration}ms)`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
  console.log(`   Content-Length: ${response.headers.get('content-length')}`);
  
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    console.log(`   Downloaded: ${buffer.byteLength} bytes`);
  }
} catch (error) {
  console.log(`❌ FAILED: ${error.name} - ${error.message}`);
  if (error.name === 'AbortError') {
    console.log('   ⏱️  Request timed out after 10 seconds');
  }
}
