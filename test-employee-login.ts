import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const baseUrl = 'http://127.0.0.1:5000';
const cookies: string[] = [];

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
          // Collect Set-Cookie headers
          const setCookies = res.headers['set-cookie'];
          if (setCookies) {
            setCookies.forEach((cookie: string) => {
              const cookieName = cookie.split('=')[0];
              cookies.push(
                cookieName + '=' + cookie.split('=').slice(1).join('=').split(';')[0]
              );
            });
          }
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : {},
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

async function testEmployeeLogin() {
  try {
    console.log('🔐 Step 1: Getting CSRF token...');
    const csrfRes: any = await makeFetch(`${baseUrl}/api/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    console.log('✅ CSRF:', csrfToken.substring(0, 20) + '...');
    console.log('✅ Cookies:', cookies);

    console.log('\n📝 Step 2: Logging in as employee (sam@s.com)...');
    const loginRes: any = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ email: 'sam@s.com', password: 'Sam@123456!' }),
    });

    console.log('Login status:', loginRes.status);
    console.log('Login response:', JSON.stringify(loginRes.data).substring(0, 300));

    if (loginRes.data.user) {
      console.log('\n✅ Login successful!');
      console.log('  User role:', loginRes.data.user.role);
      console.log('  User email:', loginRes.data.user.email);

      console.log('\n📌 Step 3: Checking /api/employee/pages endpoint...');
      const pagesRes: any = await makeFetch(`${baseUrl}/api/employee/pages`, {
        method: 'GET',
        headers: {
          'X-CSRF-Token': loginRes.data.csrfToken || csrfToken,
        },
      });

      console.log('Pages status:', pagesRes.status);
      if (Array.isArray(pagesRes.data)) {
        console.log('✅ Allowed pages for employee:');
        pagesRes.data.forEach((p: any) => console.log(`  - ${p.key}: ${p.name}`));
      } else {
        console.log('Response:', pagesRes.data);
      }
    } else {
      console.log('❌ Login failed:', loginRes.data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEmployeeLogin();
