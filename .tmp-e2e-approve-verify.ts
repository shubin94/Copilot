import { db } from "./db/index";
import { detectiveApplications, detectives, services } from "./shared/schema";
import { eq } from "drizzle-orm";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@askdetectives.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345678";

type CookieJar = Record<string, string>;

function mergeSetCookies(jar: CookieJar, setCookie: string[] | undefined) {
  if (!setCookie) return;
  for (const c of setCookie) {
    const [cookiePair] = c.split(";");
    const [k, v] = cookiePair.split("=");
    if (k && v) jar[k.trim()] = v.trim();
  }
}

function jarToHeader(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function httpRequest<T>(url: string, options: RequestInit, jar: CookieJar): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (Object.keys(jar).length > 0) headers.set("Cookie", jarToHeader(jar));

  const res = await fetch(url, { ...options, headers, redirect: "manual" });
  const setCookie = (res.headers as any).getSetCookie?.() || (res.headers as any).raw?.()["set-cookie"];
  mergeSetCookies(jar, setCookie);

  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = body && typeof body === "object" ? (body.error || body.message || JSON.stringify(body)) : String(body);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return body as T;
}

async function getCsrfToken(jar: CookieJar): Promise<string> {
  const data = await httpRequest<{ csrfToken: string }>(`${BASE_URL}/api/csrf-token`, { method: "GET", credentials: "include" }, jar);
  return data.csrfToken;
}

async function login(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = {};
  const csrfToken = await getCsrfToken(jar);
  await httpRequest(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  }, jar);
  return jar;
}

async function run() {
  const unique = Date.now();
  const email = `e2e.detective.${unique}@example.com`;
  const selectedCategories = ["Intercity Travels", "Cyber Security"];

  const jar = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const createCsrf = await getCsrfToken(jar);
  const createBody = {
    fullName: `E2E Detective ${unique}`,
    email,
    password: "Detective@12345",
    phoneCountryCode: "+91",
    phoneNumber: `9${String(unique).slice(-9)}`,
    businessType: "individual",
    companyName: "E2E Verification Agency",
    country: "IN",
    state: "Karnataka",
    city: "Bangalore",
    fullAddress: "MG Road, Bangalore",
    pincode: "560001",
    serviceCategories: selectedCategories,
    categoryPricing: [
      { category: "Intercity Travels", price: "1500", currency: "INR", isOnEnquiry: false },
      { category: "Cyber Security", price: "2500", currency: "INR", isOnEnquiry: false }
    ],
    about: "E2E verification application",
    documents: ["https://example.com/id-proof.png"],
    isClaimable: false
  };

  const created = await httpRequest<{ application: { id: string } }>(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": createCsrf,
    },
    body: JSON.stringify(createBody),
    credentials: "include",
  }, jar);

  const appId = created.application.id;

  const approveCsrf = await getCsrfToken(jar);
  await httpRequest(`${BASE_URL}/api/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": approveCsrf,
    },
    body: JSON.stringify({ status: "approved", reviewNotes: "E2E approval test" }),
    credentials: "include",
  }, jar);

  const [detective] = await db.select().from(detectives).where(eq(detectives.contactEmail, email)).limit(1);
  if (!detective) {
    throw new Error("Detective profile not found after approval");
  }

  const createdServices = await db.select().from(services).where(eq(services.detectiveId, detective.id));
  const categories = createdServices.map((s) => s.category).sort();

  const okCount = createdServices.length >= 2;
  const hasBoth = selectedCategories.every((c) => categories.includes(c));

  console.log("E2E_RESULT", JSON.stringify({
    applicationId: appId,
    detectiveId: detective.id,
    detectiveStatus: detective.status,
    servicesCount: createdServices.length,
    categories,
    expectedCategories: selectedCategories,
    pass: okCount && hasBoth,
  }));

  if (!(okCount && hasBoth)) {
    throw new Error(`Verification failed: expected >=2 services with both categories, got ${createdServices.length} (${categories.join(", ")})`);
  }

  await db.delete(detectiveApplications).where(eq(detectiveApplications.email, email));
}

run().catch((e) => {
  console.error("E2E_FAIL", e?.message || e);
  process.exit(1);
});
