import http from 'http';

const testMessage = "I want to check if my partner is cheating on me";
let sessionCookie = '';
let csrfToken = '';

// Step 1: Get CSRF token
async function getCSRFToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/csrf-token',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      // Capture session cookie
      const setCookie = res.headers['set-cookie'];
      if (setCookie && Array.isArray(setCookie)) {
        sessionCookie = setCookie[0];
      }

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          csrfToken = parsed.csrfToken;
          console.log(`✓ Got session and CSRF token\n`);
          resolve(csrfToken);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 2: Make the smart-search request
async function makeSearchRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/smart-search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'http://localhost:5000',
        'X-CSRF-Token': csrfToken,
        'Cookie': sessionCookie,
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      console.log(`========== DIAGNOSTIC TEST REQUEST ==========`);
      console.log(`Message: "${testMessage}"`);
      console.log(`\n========== SERVER RESPONSE (Status: ${res.statusCode}) ==========\n`);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(data);
        }
        console.log(`\n========== END RESPONSE ==========\n`);
        console.log(`\n📋 SERVER DEBUG LOGS (see server terminal):\n`);
        resolve();
      });
    });

    req.on('error', reject);

    const body = JSON.stringify({ query: testMessage });
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log(`🔍 Starting Gemini category mapping diagnostic test...\n`);
    await getCSRFToken();
    await makeSearchRequest();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
