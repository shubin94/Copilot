import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const baseUrl = 'http://127.0.0.1:5000';
let cookies: string[] = [];

function makeFetch(url: string, options: any = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(
      {
        host: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookies.length && { Cookie: cookies.join('; ') }),
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const setCookies = res.headers['set-cookie'];
            if (setCookies) {
              setCookies.forEach((cookie: string) => {
                const cookieName = cookie.split('=')[0];
                const cookieValue = cookieName + '=' + cookie.split('=').slice(1).join('=').split(';')[0];
                // Deduplicate by name: remove existing cookie with same name, then add new one
                cookies = cookies.filter(c => !c.startsWith(cookieName + '='));
                cookies.push(cookieValue);
              });
            }
            resolve({
              status: res.statusCode,
              data: data ? JSON.parse(data) : {},
              headers: res.headers,
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function testFullFlow() {
  try {
    const testAdminEmail = process.env.TEST_ADMIN_EMAIL || 'testadmin@test.com';
    const testAdminPassword = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin123!';

    console.log('🔐 Step 1: Admin login to create test employee...');
    let csrfRes: any = await makeFetch(`${baseUrl}/api/csrf-token`);
    let csrfToken = csrfRes.data.csrfToken;

    const adminLoginRes: any = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: testAdminEmail, password: testAdminPassword }),
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data.user) {
      console.log('❌ Admin login failed:', adminLoginRes.data.error);
      return;
    }

    console.log('✅ Admin logged in successfully');
    csrfToken = adminLoginRes.data.csrfToken;

    console.log('\n👤 Step 2: Creating test employee...');
    const testEmail = `testemployee${Date.now()}@test.com`;
    const createRes: any = await makeFetch(`${baseUrl}/api/admin/employees`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestEmployee123!',
        name: 'Test Employee',
        allowedPages: ['dashboard', 'cms'],
      }),
    });

    if (createRes.status !== 201) {
      console.log('❌ Employee creation failed:', createRes.status, createRes.data);
      return;
    }

    console.log(`✅ Employee created: ${testEmail}`);

    console.log('\n🚪 Step 3: Logout and test employee login...');
    // Logout admin
    cookies.length = 0;
    
    csrfRes = await makeFetch(`${baseUrl}/api/csrf-token`);
    csrfToken = csrfRes.data.csrfToken;

    const empLoginRes: any = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: testEmail, password: 'TestEmployee123!' }),
    });

    if (empLoginRes.status !== 200 || !empLoginRes.data.user) {
      console.log('❌ Employee login failed:', empLoginRes.data.error);
      return;
    }

    console.log('✅ Employee login successful!');
    console.log(`  Email: ${empLoginRes.data.user.email}`);
    console.log(`  Role: ${empLoginRes.data.user.role}`);

    csrfToken = empLoginRes.data.csrfToken;

    console.log('\n📋 Step 4: Fetching employee allowed pages...');
    const pagesRes: any = await makeFetch(`${baseUrl}/api/employee/pages`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });

    console.log(`Status: ${pagesRes.status}`);
    if (Array.isArray(pagesRes.data)) {
      console.log('✅ Allowed pages:');
      pagesRes.data.forEach((p: any) => console.log(`  ✅ ${p.key}: ${p.name}`));
    } else {
      console.log('Response:', pagesRes.data);
    }

    console.log('\n🎯 Step 5: Trying to access admin routes...');
    const dashRes: any = await makeFetch(`${baseUrl}/api/admin/dashboard`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    console.log('  GET /api/admin/dashboard:', dashRes.status);

    const cmsRes: any = await makeFetch(`${baseUrl}/api/admin/cms/categories`, {
      method: 'GET',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    console.log('  GET /api/admin/cms/categories:', cmsRes.status);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testFullFlow();
