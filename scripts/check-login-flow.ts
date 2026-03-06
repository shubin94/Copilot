import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.BASE_URL || "http://localhost:5000";
const email = process.env.LOGIN_EMAIL;
const password = process.env.LOGIN_PASSWORD;

if (!email || !password) {
  console.error("Missing LOGIN_EMAIL or LOGIN_PASSWORD env vars.");
  console.error("Example: set LOGIN_EMAIL=you@example.com; set LOGIN_PASSWORD=secret; npm run check:login");
  process.exit(1);
}

function parseSetCookie(setCookie: string | null): string[] {
  if (!setCookie) return [];
  return setCookie
    .split(/,(?=[^;]+?=)/g)
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);
}

function upsertCookies(store: Map<string, string>, cookies: string[]) {
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf("=");
    if (eqIndex === -1) continue;
    const name = cookie.slice(0, eqIndex).trim();
    const value = cookie.slice(eqIndex + 1).trim();
    if (!name) continue;
    store.set(name, `${name}=${value}`);
  }
}

async function fetchWithCookies(url: string, options: RequestInit, cookies: Map<string, string>) {
  const headers = new Headers(options.headers || {});
  if (cookies.size) {
    headers.set("Cookie", Array.from(cookies.values()).join("; "));
  }
  const res = await fetch(url, { ...options, headers });
  const setCookie = res.headers.get("set-cookie");
  const newCookies = parseSetCookie(setCookie);
  if (setCookie) {
    console.log(`[check-login] set-cookie from ${url}:`, setCookie);
  }
  return { res, newCookies };
}

async function run() {
  const cookies = new Map<string, string>();

  console.log(`[check-login] Base URL: ${baseUrl}`);

  const csrfResp = await fetchWithCookies(`${baseUrl}/api/csrf-token`, { method: "GET" }, cookies);
  upsertCookies(cookies, csrfResp.newCookies);
  console.log("[check-login] cookies after csrf:", Array.from(cookies.values()));
  const csrfBody = (await csrfResp.res.json()) as { csrfToken: string };
  const csrfToken = csrfBody.csrfToken;
  console.log(`[check-login] csrf token received: ${Boolean(csrfToken)}`);

  const loginResp = await fetchWithCookies(
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ email, password }),
    },
    cookies,
  );
  upsertCookies(cookies, loginResp.newCookies);
  console.log("[check-login] cookies after login:", Array.from(cookies.values()));
  const loginJson = await loginResp.res.json().catch(() => ({}));
  console.log(`[check-login] login status: ${loginResp.res.status}`);
  console.log("[check-login] login response:", loginJson);

  await delay(200);

  const meResp = await fetchWithCookies(`${baseUrl}/api/auth/me`, { method: "GET" }, cookies);
  const meJson = await meResp.res.json().catch(() => ({}));
  console.log(`[check-login] auth/me status: ${meResp.res.status}`);
  console.log("[check-login] auth/me response:", meJson);

  if (meJson?.user?.role === "employee" || meJson?.user?.role === "admin") {
    const pagesResp = await fetchWithCookies(`${baseUrl}/api/employee/pages`, { method: "GET" }, cookies);
    const pagesJson = await pagesResp.res.json().catch(() => ({}));
    console.log(`[check-login] employee/pages status: ${pagesResp.res.status}`);
    console.log("[check-login] employee/pages response:", pagesJson);
  }
}

run().catch((err) => {
  console.error("[check-login] failed:", err);
  process.exit(1);
});
