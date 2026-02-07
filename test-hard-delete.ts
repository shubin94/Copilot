import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const baseUrl = 'http://127.0.0.1:5000';
let sessionId = '';

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
    console.log('🔐 Step 1: Admin login...');
    let res: any = await makeFetch(`${baseUrl}/api/csrf-token`);
    let csrfToken = res.data.csrfToken;

    res = await makeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: 'testadmin@test.com', password: 'TestAdmin123!' }),
    });
    
    if (res.status !== 200) {
      console.log('❌ Login failed');
      return;
    }
    
    console.log('✅ Logged in\n');
    csrfToken = res.data.csrfToken;

    console.log('📝 Step 2: Create test category...');
    res = await makeFetch(`${baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ name: 'Test Category', slug: 'test-category', status: 'published' }),
    });

    if (res.status !== 200 && res.status !== 201) {
      console.log('❌ Failed to create category:', res.data);
      return;
    }

    const categoryId = res.data.category.id;
    console.log(`✅ Category created: ${res.data.category.name} (ID: ${categoryId.substring(0, 8)}...)\n`);

    console.log('📋 Step 3: Get all categories...');
    res = await makeFetch(`${baseUrl}/api/admin/categories`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });

    console.log(`✅ Found ${res.data.categories.length} categories:\n`);
    res.data.categories.forEach((cat: any) => {
      console.log(`  - ${cat.name} (status: ${cat.status})`);
    });

    console.log('\n🗑️  Step 4: Delete category...');
    res = await makeFetch(`${baseUrl}/api/admin/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken },
    });

    if (res.status === 200) {
      console.log('✅ Category deleted\n');
    } else {
      console.log('❌ Delete failed:', res.status, res.data);
      return;
    }

    console.log('📋 Step 5: Verify category is gone...');
    res = await makeFetch(`${baseUrl}/api/admin/categories`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });

    console.log(`✅ ${res.data.categories.length} categories remain\n`);
    
    if (res.data.categories.length === 0) {
      console.log('✅ SUCCESS: Category was permanently deleted from database!\n');
    } else {
      console.log('❌ FAIL: Category still exists');
      res.data.categories.forEach((cat: any) => {
        console.log(`  - ${cat.name} (status: ${cat.status})`);
      });
    }

    // Test with tag
    console.log('\n📝 Step 6: Create and delete test tag...');
    res = await makeFetch(`${baseUrl}/api/admin/tags`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ name: 'Test Tag', slug: 'test-tag', status: 'published' }),
    });

    const tagId = res.data.tag.id;
    console.log(`✅ Tag created: ${res.data.tag.name}`);

    res = await makeFetch(`${baseUrl}/api/admin/tags/${tagId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken },
    });

    console.log(`✅ Tag deleted (status: ${res.status})`);

    res = await makeFetch(`${baseUrl}/api/admin/tags`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });

    console.log(`✅ ${res.data.tags.length} tags remain\n`);
    
    if (res.data.tags.length === 0) {
      console.log('✅ SUCCESS: Tag was permanently deleted from database!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
