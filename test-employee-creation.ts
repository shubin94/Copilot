import * as http from "http";

const BASE_URL = "http://127.0.0.1:5000";

function makeRequest(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === "https:";
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

    const req = http.request(options, (res) => {
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
        const parts = cookie.split(";")[0].split("=");
        if (parts.length === 2) {
          cookies[parts[0].trim()] = parts[1].trim();
        }
      }
    } else if (setCookie) {
      const parts = setCookie.split(";")[0].split("=");
      if (parts.length === 2) {
        cookies[parts[0].trim()] = parts[1].trim();
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
    const csrfData = JSON.parse(res.body) as any;
    const csrfToken = csrfData.csrfToken;
    console.log(`✅ CSRF: ${csrfToken.substring(0, 16)}...\n`);

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
    const loginData = JSON.parse(res.body) as any;
     const newCsrfToken = loginData.csrfToken; // Get new CSRF token from login
     console.log(`✅ Login status: ${res.status}`);
     console.log(`✅ Using new CSRF token: ${newCsrfToken.substring(0, 16)}...`);
    console.log(`Cookies after login:`, Object.keys(cookies), "\n");

    // Step 3: Create employee
    console.log("Step 3: Creating employee...");
    const cookies_before = getCookieHeader();
    
    res = await makeRequest("POST", "/api/admin/employees", {
      email: "test.emp@company.com",
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
