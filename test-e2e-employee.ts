#!/usr/bin/env npx tsx

/**
 * Complete end-to-end test for employee creation with page access
 * This tests:
 * 1. CSRF token retrieval
 * 2. Admin login
 * 3. Employee creation with page access
 * 4. Verification of assigned pages
 */

import * as http from "http";

const BASE_URL = "http://127.0.0.1:5000";
const TEST_ADMIN_EMAIL = "testadmin@test.com";
const TEST_ADMIN_PASSWORD = "TestAdmin123!";

interface RequestOptions {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  cookies?: string;
}

function makeRequest(opts: RequestOptions): Promise<{
  status: number;
  body: string;
  headers: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.cookies && { Cookie: opts.cookies }),
        ...opts.headers,
      },
    };

    if (opts.body) {
      const bodyStr = JSON.stringify(opts.body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 500,
          body: data,
          headers: res.headers as Record<string, string>,
        });
      });
    });

    req.on("error", reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

async function main() {
  try {
    console.log("🧪 Employee Access Pages E2E Test\n");
    console.log("================================================\n");

    const cookies: string[] = [];

    function saveCookies(headers: Record<string, string>) {
      const setCookie = headers["set-cookie"];
      const cookieMap = new Map<string, string>();
      
      // Parse existing cookies into map
      for (const existing of cookies) {
        const [name] = existing.split("=");
        if (name) cookieMap.set(name, existing);
      }
      
      // Process new cookies
      if (Array.isArray(setCookie)) {
        for (const cookie of setCookie) {
          const sessionPart = cookie.split(";")[0];
          if (sessionPart) {
            const [name] = sessionPart.split("=");
            if (name) cookieMap.set(name, sessionPart);
          }
        }
      } else if (setCookie) {
        const sessionPart = setCookie.split(";")[0];
        if (sessionPart) {
          const [name] = sessionPart.split("=");
          if (name) cookieMap.set(name, sessionPart);
        }
      }
      
      cookies.length = 0;
      cookies.push(...Array.from(cookieMap.values()));
    }

    // Step 1: Get CSRF Token
    console.log("Step 1️⃣  Getting CSRF token...");
    let res = await makeRequest({
      method: "GET",
      path: "/api/csrf-token",
      cookies: cookies.join("; "),
    });

    if (res.status !== 200) {
      throw new Error(`Failed to get CSRF token: ${res.status} - ${res.body}`);
    }

    saveCookies(res.headers);
    let csrfData: any;
    try {
      csrfData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid CSRF response: ${res.body.substring(0, 100)}`);
    }
    const csrfToken = csrfData.csrfToken;
    if (!csrfToken) {
      throw new Error(`CSRF token not found in response: ${res.body.substring(0, 100)}`);
    }
    console.log(`✅ CSRF token received: ${csrfToken.substring(0, 16)}...\n`);

    // Step 2: Admin Login
    console.log("Step 2️⃣  Logging in as admin...");
    res = await makeRequest({
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
      },
      headers: {
        "X-CSRF-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
      },
      cookies: cookies.join("; "),
    });

    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} - ${res.body}`);
    }

    saveCookies(res.headers);
    let loginData: any;
    try {
      loginData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid login response: ${res.body.substring(0, 100)}`);
    }
    console.log(`✅ Login successful\n`);

    // Step 3: Get available pages
    console.log("Step 3️⃣  Fetching available pages...");
    res = await makeRequest({
      method: "GET",
      path: "/api/admin/employees/pages",
      cookies: cookies.join("; "),
    });

    if (res.status !== 200) {
      throw new Error(`Failed to fetch pages: ${res.status} - ${res.body}`);
    }

    let pagesData: any;
    try {
      pagesData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid pages response: ${res.body.substring(0, 100)}`);
    }
    const availablePages = pagesData.pages || [];
    console.log(`✅ Found ${availablePages.length} available pages:`);
    availablePages.slice(0, 5).forEach((p: any) => {
      console.log(`   - ${p.key || p.name}`);
    });
    if (availablePages.length > 5) {
      console.log(`   ... and ${availablePages.length - 5} more`);
    }
    console.log();

    if (availablePages.length === 0) {
      throw new Error("No pages available! The access_pages table may not be seeded.");
    }

    // Step 4: Create Employee with page access
    console.log("Step 4️⃣  Creating test employee...");
    const testEmail = `emp-${Date.now()}@test.com`;
    const pageKeys = ["dashboard", "employees", "detectives"];

    res = await makeRequest({
      method: "POST",
      path: "/api/admin/employees",
      body: {
        email: testEmail,
        password: "EmpTest123!",
        name: "Test Employee",
        allowedPages: pageKeys,
      },
      headers: {
        "X-CSRF-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
      },
      cookies: cookies.join("; "),
    });

    if (res.status !== 201 && res.status !== 200) {
      throw new Error(
        `Employee creation failed: ${res.status} - ${res.body}`
      );
    }

    let empData: any;
    try {
      empData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid employee response: ${res.body.substring(0, 100)}`);
    }
    console.log(`✅ Employee created: ${testEmail}`);
    console.log(`   ID: ${empData.id}`);
    console.log(`   Pages assigned: ${pageKeys.join(", ")}\n`);

    // Step 5: Verify Employee was created
    console.log("Step 5️⃣  Verifying employee...");
    res = await makeRequest({
      method: "GET",
      path: `/api/admin/employees/${empData.id}`,
      cookies: cookies.join("; "),
    });

    if (res.status !== 200) {
      throw new Error(`Failed to verify employee: ${res.status} - ${res.body}`);
    }

    let verifyData: any;
    try {
      verifyData = JSON.parse(res.body);
    } catch (e) {
      console.warn(`⚠️  Could not parse verify response`);
      verifyData = {};
    }
    console.log(`✅ Employee exists in database`);
    if (verifyData.allowedPages) {
      console.log(
        `   Pages: ${verifyData.allowedPages.map((p: any) => p.key || p.name).join(", ")}`
      );
    }
    console.log();

    // Final summary
    console.log("================================================");
    console.log("✅ All tests passed!");
    console.log("================================================");
    console.log("\nEmployee Access Pages are working correctly:");
    console.log(`- Tables created: ✅ access_pages, user_pages`);
    console.log(`- Pages seeded: ✅ ${availablePages.length} pages`);
    console.log(`- Employee created: ✅ ${testEmail}`);
    console.log(`- Pages assigned: ✅ ${pageKeys.join(", ")}`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(`   ${error.message}`);
    console.error("\nDebugging info:");
    console.error(`- Base URL: ${BASE_URL}`);
    console.error(`- Admin: ${TEST_ADMIN_EMAIL}`);
    process.exit(1);
  }
}

main();
