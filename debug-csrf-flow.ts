import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const baseUrl = 'http://127.0.0.1:5000';
const cookies: string[] = [];
let sessionId = '';

// Test credentials from environment variables (required)
if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
  console.error('❌ TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables are required');
  process.exit(1);
}
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

function makeFetch(url: string, options: any = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(
      {
        host: urlObj.hostname,
        port: parseInt(urlObj.port || '80'),
        path: urlObj.pathname + (urlObj.search || ''),
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(sessionId && { Cookie: `connect.sid=${sessionId}` }),
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          // Extract Set-Cookie for connect.sid
          const setCookies = res.headers['set-cookie'];
          if (setCookies) {
            setCookies.forEach((cookie: string) => {
              if (cookie.includes('connect.sid')) {
                const match = cookie.match(/connect\.sid=([^;]+)/);
                if (match) sessionId = match[1];
              }
            });
          }
          let parsedData: any = { message: 'No response' };
          if (data) {
            try {
              parsedData = JSON.parse(data);
            } catch (e) {
              parsedData = { message: 'Invalid JSON response', raw: data.substring(0, 200) };
            }
          }
          resolve({
            status: res.statusCode,
            data: parsedData,
            headers: res.headers,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function test() {
  try {
    console.log('\n=== Test 1: Get CSRF token ===');
    let res: any = await makeFetch(`${baseUrl}/api/csrf-token`);
    let csrfToken = res.data.csrfToken;
    console.log('Status:', res.status);
    console.log('CSRF token:', csrfToken?.substring(0, 20) + '...');
    console.log('Session ID:', sessionId?.substring(0, 20) + '...');

    console.log('\n=== Test 2: Admin login with CSRF ===');
    res = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
    });
    console.log('Status:', res.status);
    console.log('Has user:', !!res.data.user);
    console.log('New CSRF token:', res.data.csrfToken?.substring(0, 20) + '...');
    console.log('New Session ID:', sessionId?.substring(0, 20) + '...');

    if (res.status === 200 && res.data.csrfToken) {
      csrfToken = res.data.csrfToken;
      console.log('✅ Updated CSRF token for next request');
    } else {
      console.log('❌ Login failed or no CSRF token in response');
      return;
    }

    console.log('\n=== Test 3: Create employee with NEW CSRF ===');
    res = await makeFetch(`${baseUrl}/api/admin/employees`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        email: `emp${Date.now()}@test.com`,
        password: 'Test123!',
        name: 'Test',
        allowedPages: ['dashboard'],
      }),
    });
    console.log('Status:', res.status);
    if (res.status === 201) {
      console.log('✅ Employee created successfully');
    } else {
      console.log('Response:', res.data);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
