import * as http from "http";
import * as https from "https";

const BASE_URL = "http://127.0.0.1:5000";

function makeRequest(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === "https:";
    const protocol = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = protocol.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({
          status: res.statusCode || 500,
          body: data,
          headers: res.headers as Record<string, string>,
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  const cookies: Record<string, string> = {};

  function saveCookies(headers: Record<string, string>) {
    const setCookie = headers["set-cookie"];
    if (Array.isArray(setCookie)) {
      for (const cookie of setCookie) {
        const sessionPart = cookie.split(";")[0];
        const eqIndex = sessionPart.indexOf("=");
        if (eqIndex > 0) {
          const name = sessionPart.substring(0, eqIndex).trim();
          const value = sessionPart.substring(eqIndex + 1).trim();
          cookies[name] = value;
        }
      }
    } else if (setCookie) {
      const sessionPart = setCookie.split(";")[0];
      const eqIndex = sessionPart.indexOf("=");
      if (eqIndex > 0) {
        const name = sessionPart.substring(0, eqIndex).trim();
        const value = sessionPart.substring(eqIndex + 1).trim();
        cookies[name] = value;
      }
    }
  }

  function getCookieHeader() {
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  try {
    // Step 1: Get CSRF token
    console.log("Step 1: Getting CSRF token...");
    let res = await makeRequest("GET", "/api/csrf-token", null, {
      "Cookie": getCookieHeader(),
    });
    saveCookies(res.headers);
    let csrfData: any;
    try {
      csrfData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid CSRF response: ${res.body.substring(0, 100)}`);
    }
    const csrfToken = csrfData.csrfToken;
    const csrfDisplay = typeof csrfToken === 'string' && csrfToken.length >= 16 
      ? csrfToken.substring(0, 16) + '...'
      : '<missing CSRF token>';
    console.log(`✅ CSRF: ${csrfDisplay}\n`);

    // Step 2: Login
    console.log("Step 2: Logging in...");
    res = await makeRequest("POST", "/api/auth/login", {
      email: "testadmin@test.com",
      password: "TestAdmin123!",
    }, {
      "X-CSRF-Token": csrfToken,
      "Cookie": getCookieHeader(),
    });
    saveCookies(res.headers);
    let loginData: any;
    try {
      loginData = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Invalid login response: ${res.body.substring(0, 100)}`);
    }
     const newCsrfToken = loginData.csrfToken; // Get new CSRF token from login
     if (!newCsrfToken || typeof newCsrfToken !== 'string') {
       throw new Error('Invalid or missing CSRF token in login response');
     }
     console.log(`✅ Login status: ${res.status}`);
     console.log(`✅ Using new CSRF token: ${newCsrfToken.substring(0, 16)}...`);
    console.log(`Cookies after login:`, Object.keys(cookies), "\n");

    // Step 3: Create employee
    console.log("Step 3: Creating employee...");
    const dynamicEmail = `test.emp.${Date.now()}@company.com`;
    const cookies_before = getCookieHeader();
    
    res = await makeRequest("POST", "/api/admin/employees", {
      email: dynamicEmail,
      password: "EmpPass123",
      name: "Test Employee",
      allowedPages: ["dashboard"],
    }, {
       "X-CSRF-Token": newCsrfToken,
      "Cookie": getCookieHeader(),
    });
    console.log(`✅ Employee creation status: ${res.status}`);
    console.log(`Response: ${res.body}`);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }

  process.exit(0);
}

test();
