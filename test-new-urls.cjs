const http = require('http');

function testUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const status = res.statusCode;
        let responseData = null;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          responseData = data;
        }
        resolve({ status, data: responseData });
      });
    }).on('error', (err) => {
      resolve({ status: 'ERROR', data: err.message });
    });
  });
}

async function testNewUrls() {
  const baseUrl = 'http://localhost:5000';
  
  const urls = [
    '/api/detectives/US/Arizona/Glendale/changappa-a-k',
    '/api/detectives/IN/Assam/Barpeta/meghana-shubin',
    '/api/detectives/IN/Kerala/Bangalore/test-1'
  ];
  
  console.log('🧪 Testing NEW Detective URLs with proper slugs\n');
  
  for (const path of urls) {
    const url = baseUrl + path;
    console.log(`Testing: ${path}`);
    const result = await testUrl(url);
    
    if (result.status === 200 && result.data.detective) {
      console.log(`✅ WORKS!`);
      console.log(`   Detective: ${result.data.detective.businessName}`);
      console.log(`   🔗 URL: http://localhost:5000/detectives/${result.data.detective.country}/${result.data.detective.state}/${result.data.detective.city}/${result.data.detective.slug}/`);
    } else {
      console.log(`❌ Failed (${result.status})`);
    }
    console.log();
  }
  
  process.exit(0);
}

testNewUrls();
