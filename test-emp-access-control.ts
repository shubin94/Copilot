import "./server/lib/loadEnv.ts";
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseUrl = 'http://127.0.0.1:5000';
let sessionId = '';
const testEmail = `emp${Date.now()}@test.com`;

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
          const setCookies = res.headers['set-cookie'];
          if (setCookies) {
            setCookies.forEach((cookie: string) => {
              if (cookie.includes('connect.sid')) {
                const match = cookie.match(/connect\.sid=([^;]+)/);
                if (match) sessionId = match[1];
              }
            });
          }
          let parsedData = {};
          try {
            parsedData = data ? JSON.parse(data) : {};
          } catch (e) {
            parsedData = { raw: data.substring(0, 100) };
          }
          resolve({
            status: res.statusCode,
            data: parsedData,
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
    console.log('📋 Creating employee with dashboard and cms access...');
    let res: any = await makeFetch(`${baseUrl}/api/csrf-token`);
    let csrfToken = res.data.csrfToken;

    res = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: 'testadmin@test.com', password: 'TestAdmin123!' }),
    });
    csrfToken = res.data.csrfToken;

    res = await makeFetch(`${baseUrl}/api/admin/employees`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestEmployee123!',
        name: 'Test Employee',
        allowedPages: ['dashboard', 'cms'],
      }),
    });

    if (res.status !== 201) {
      console.log('❌ Failed to create employee');
      return;
    }
    console.log(`✅ Employee created: ${testEmail}`);

    // New session for employee
    sessionId = '';

    console.log('\n🔐 Employee login...');
    res = await makeFetch(`${baseUrl}/api/csrf-token`);
    csrfToken = res.data.csrfToken;

    res = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: testEmail, password: 'TestEmployee123!' }),
    });

    if (res.status !== 200) {
      console.log('❌ Employee login failed:', res.data.error);
      return;
    }

    console.log('✅ Employee logged in!');
    console.log(`  User role: ${res.data.user.role}`);
    csrfToken = res.data.csrfToken;

    console.log('\n📄 Fetching allowed pages...');
    res = await makeFetch(`${baseUrl}/api/employee/pages`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });

    if (res.data.pages && Array.isArray(res.data.pages)) {
      console.log(`✅ Found ${res.data.pages.length} allowed pages:`);
      res.data.pages.forEach((p: any) => console.log(`  ✅ ${p.key}`));
    } else {
      console.log('❌ Response:', res.data);
      return;
    }

    console.log('\n🏠 Testing dashboard access...');
    res = await makeFetch(`${baseUrl}/api/admin/dashboard`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    console.log(`  Status: ${res.status}`);

    console.log('\n📰 Testing CMS access...');
    res = await makeFetch(`${baseUrl}/api/admin/cms/categories`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    console.log(`  Status: ${res.status}`);

    console.log('\n👥 Testing employees access (NOT GRANTED)...');
    res = await makeFetch(`${baseUrl}/api/admin/employees`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    console.log(`  Status: ${res.status}`);
    if (res.status === 403) {
      console.log(`  ✅ Correctly denied access`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
