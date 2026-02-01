import http from 'http';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';

const jar = new CookieJar();
const httpAgent = new HttpCookieAgent({ cookies: { jar } });

const testMessage = "I want to check if my partner is cheating on me";

// Step 1: GET a page to establish session and get CSRF token
function getToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/',
      method: 'GET',
      agent: httpAgent,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Extract CSRF token from HTML (look for window.__csrf or similar)
        const tokenMatch = data.match(/csrfToken["\']?\s*:\s*["\']([^"\']+)/i);
        const token = tokenMatch ? tokenMatch[1] : null;
        console.log(`[Step 1] Got session and CSRF token: ${token ? token.substring(0, 20) + '...' : 'NOT FOUND'}`);
        resolve(token);
      });
    });

    req.on('error', (error) => {
      console.error('Failed to get token:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Step 2: Make the smart-search request
function makeSearchRequest(csrfToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/smart-search',
      method: 'POST',
      agent: httpAgent,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': csrfToken || '',
        'Origin': 'http://localhost:5000',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      console.log(`\n========== REQUEST SENT ==========`);
      console.log(`Test Message: "${testMessage}"`);
      console.log(`CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'NONE'}`);
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
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('Request failed:', error.message);
      reject(error);
    });

    const body = JSON.stringify({ query: testMessage });
    console.log(`Sending POST to http://localhost:5000/api/smart-search`);
    console.log(`Body: ${body}`);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    const token = await getToken();
    await makeSearchRequest(token);
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
