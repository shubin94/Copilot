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

async function testDetectiveUrls() {
  const baseUrl = 'http://localhost:5000';
  
  const urls = [
    '/api/detectives/US/Arizona/Glendale/detective',
    '/api/detectives/IN/Assam/Barpeta/detective-861',
    '/api/detectives/IN/Kerala/Bangalore/detective-490'
  ];
  
  console.log('🧪 Testing Detective URLs\n');
  
  for (const path of urls) {
    const url = baseUrl + path;
    console.log(`Testing: ${url}`);
    const result = await testUrl(url);
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200 && result.data.detective) {
      console.log(`✅ WORKS! Detective: ${result.data.detective.businessName || 'N/A'}`);
      console.log(`   URL: ${baseUrl}/detectives/${result.data.detective.country}/${result.data.detective.state}/${result.data.detective.city}/${result.data.detective.slug}/`);
    } else if (result.status === 404) {
      console.log(`❌ 404 - Not found`);
    } else {
      console.log(`❌ Error: ${result.status}`);
    }
    console.log();
  }
  
  process.exit(0);
}

testDetectiveUrls();
