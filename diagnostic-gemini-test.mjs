import http from 'http';

const testMessage = "I want to check if my partner is cheating on me";
let sessionCookie = '';
let csrfToken = '';

// Step 1: Get CSRF token and session
async function getCSRFToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/csrf-token',
      method: 'GET',
      family: 4,  // Force IPv4
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      // Capture session cookie from Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      if (setCookie && Array.isArray(setCookie)) {
        sessionCookie = setCookie[0].split(';')[0];
        console.log(`[Step 1] Got session cookie (first 30 chars): ${sessionCookie.substring(0, 30)}...`);
      }

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          csrfToken = parsed.csrfToken;
          console.log(`[Step 1] Got CSRF token (first 20 chars): ${csrfToken.substring(0, 20)}...\n`);
          resolve(csrfToken);
        } catch (e) {
          console.error('Failed to parse CSRF response:', e);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 2: Make the smart-search request with CSRF token
async function makeSearchRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/smart-search',
      method: 'POST',
      family: 4,  // Force IPv4
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
      console.log(`Test Message: "${testMessage}"`);
      console.log(`\nSending POST to http://localhost:5000/api/smart-search`);
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
        console.log(`✓ Check the server terminal below for [gemini-debug] logs:\n`);
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
    console.log(`Starting diagnostic test for Gemini category mapping...\n`);
    await getCSRFToken();
    await makeSearchRequest();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
