import type { User, Detective, Service, Review, Order, DetectiveApplication, ProfileClaim, ServiceCategory, InsertDetective, InsertService, InsertReview, InsertOrder, InsertServiceCategory, InsertDetectiveApplication } from "@shared/schema";

const VITE_ENV = ((import.meta as any)?.env ?? {}) as Record<string, any>;
const VITE_API_URL = VITE_ENV.VITE_API_URL as string | undefined;
const VITE_PORT = VITE_ENV.VITE_PORT as string | undefined;
const IS_PROD = !!VITE_ENV.PROD;

// API Base URL configuration for different environments

// Determine API base URL:
// 1. Environment variable (VITE_API_URL) - highest priority
// 2. All environments: Relative paths for same-origin /api
const determineApiBaseUrl = (): string => {
  // Priority 1: Environment variable (most reliable, set in Vercel dashboard)
  if (VITE_API_URL) {
    console.log('[API Config] ✅ Using VITE_API_URL:', VITE_API_URL);
    return VITE_API_URL;
  }

  // Same-origin relative paths keep CSRF and session cookies aligned
  if (IS_PROD) {
    console.log('[API Config] 🌐 Production mode - using same-origin /api');
  } else {
    console.log('[API Config] 🛠️ Development mode - using same-origin /api');
  }
  return ""; // Empty string = relative paths like /api/user
};

export const API_BASE_URL = determineApiBaseUrl();

export function buildApiUrl(path: string): string {
  if (path.startsWith("http")) return path;

  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

// Always use same-origin proxy for auth/CSRF to keep cookies first-party.
function buildProxyUrl(path: string): string {
  return buildApiUrl(path);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const ct = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (ct.includes("application/json")) {
      const body = await response.json().catch(() => ({}));
      const err = body && typeof body === "object" ? (body as any).error ?? (body as any).message : undefined;
      throw new ApiError(response.status, err || response.statusText);
    }
    const text = await response.text().catch(() => "");
    const isHtml = text.trim().startsWith("<") || text.toLowerCase().includes("<!doctype");
    if (isHtml) {
      throw new ApiError(response.status, "Unexpected HTML response. Please ensure you are logged in and the API route is correct.");
    }
    throw new ApiError(response.status, text || response.statusText);
  }
  if (ct.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as T;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 60000): Promise<Response> {
  console.log(`[API Request] ${options.method || 'GET'} ${url}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await csrfFetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[API Response] ${response.status} ${url}`);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      console.error(`[API Error] Request timeout: ${url}`);
      throw new ApiError(408, `Request timeout after ${timeout/1000} seconds. The file might be too large.`);
    }
    
    // Handle CORS errors specifically
    if (error instanceof TypeError) {
      const isNetworkError = error.message.includes('fetch') || error.message.includes('NetworkError');
      const isCORSError = error.message.includes('CORS') || error.message.includes('cross-origin');
      
      if (isCORSError) {
        console.error(`[API Error] CORS violation for ${url}:`, error.message);
        console.error('[API Error] Backend CORS headers likely not configured for this origin');
        
        throw new ApiError(0, 'CORS error: Backend API not accessible from this origin. Check network or contact support.');
      }
      
      if (isNetworkError) {
        console.error(`[API Error] Network error for ${url}:`, error);
        
        throw new ApiError(503, 'Network error. Please check your internet connection.');
      }
    }
    
    console.error(`[API Error] ${url}:`, error);
    throw error;
  }
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export async function getOrFetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const url = buildApiUrl("/api/csrf-token");
  try {
    const r = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    if (!r.ok) throw new ApiError(r.status, "Failed to get CSRF token");
    const d = (await r.json()) as { csrfToken: string };
    csrfToken = d.csrfToken;
    return csrfToken;
  } catch (error: any) {
    // Improve error message for network failures
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      throw new Error(`Cannot reach API server at ${url}. Is the backend running? Check: npm run dev`);
    }
    throw error;
  }
}

// Central fetch wrapper that adds CSRF headers for mutation methods
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const opts = options as RequestInit & { forceProxy?: boolean };
  const fullUrl = opts.forceProxy ? buildProxyUrl(url) : buildApiUrl(url);
  
  const method = (options.method || "GET").toUpperCase();
  const requiresCSRF = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(options.headers);
  if (requiresCSRF) {
    headers.set("X-Requested-With", "XMLHttpRequest");
    const token = await getOrFetchCsrfToken();
    headers.set("X-CSRF-Token", token);
  }
  options.headers = headers;
  if (!options.credentials) {
    options.credentials = "include";
  }

  try {
    if (opts.forceProxy) {
      delete (opts as { forceProxy?: boolean }).forceProxy;
    }
    return await fetch(fullUrl, opts);
  } catch (error: any) {
    // Improve error message for network failures (e.g., server not running)
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      const port = VITE_PORT || window.location.port || '5000';
      throw new Error(`Cannot reach API server at ${fullUrl}. Is the server running on port ${port}? Check: npm run dev`);
    }
    throw error;
  }
}

export const api = {
  // Generic HTTP methods for flexible API calls
  get: async <T = any>(url: string, options: RequestInit & { forceProxy?: boolean } = {}): Promise<T> => {
    const response = await csrfFetch(url, {
      method: "GET",
      credentials: "include",
      ...options,
    });
    return handleResponse(response);
  },
  
  // Public POST - no CSRF token required (for public endpoints like smart search)
  publicPost: async <T = any>(url: string, data?: any): Promise<T> => {
    const fullUrl = buildApiUrl(url);
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    return handleResponse(response);
  },
  
  post: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await csrfFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    const result = await handleResponse<T>(response);
    // Update CSRF token if server rotated it (for sensitive operations)
    if (result && typeof result === "object" && "newToken" in result && (result as any).newToken) {
      setCsrfToken((result as any).newToken);
    }
    return result;
  },

  put: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await csrfFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    const result = await handleResponse<T>(response);
    // Update CSRF token if server rotated it (for sensitive operations)
    if (result && typeof result === "object" && "newToken" in result && (result as any).newToken) {
      setCsrfToken((result as any).newToken);
    }
    return result;
  },

  patch: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await csrfFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    const result = await handleResponse<T>(response);
    // Update CSRF token if server rotated it (for sensitive operations)
    if (result && typeof result === "object" && "newToken" in result && (result as any).newToken) {
      setCsrfToken((result as any).newToken);
    }
    return result;
  },

  delete: async <T = any>(url: string): Promise<T> => {
    const response = await csrfFetch(url, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await handleResponse<T>(response);
    // Update CSRF token if server rotated it (for sensitive operations)
    if (result && typeof result === "object" && "newToken" in result && (result as any).newToken) {
      setCsrfToken((result as any).newToken);
    }
    return result;
  },

  auth: {
    login: async (email: string, password: string): Promise<{ user?: User; applicant?: { email: string; status: string }; csrfToken?: string }> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await csrfFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
          keepalive: true,
          signal: controller.signal,
        });
        const data = await handleResponse<{ user?: User; applicant?: { email: string; status: string }; csrfToken?: string }>(response);
        // Session regeneration invalidates CSRF token; force refresh on next mutation
        clearCsrfToken();
        return data;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new Error("Login timed out. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },

    logout: async (): Promise<{ message: string }> => {
      const response = await csrfFetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "include",
      });
      const result = await handleResponse<{ message: string }>(response);
      clearCsrfToken();
      return result;
    },

    me: async (): Promise<{ user?: User | null }> => {
      try {
        console.debug('[api.auth.me] Calling /api/auth/me endpoint');
        const response = await csrfFetch("/api/auth/me", {
          credentials: "include",
        });
        
        console.debug('[api.auth.me] Response status:', response.status);
        
        if (response.status === 401 || response.status === 403) {
          console.debug('[api.auth.me] User not authenticated - returning null');
          return { user: null } as any;
        }
        
        const result = await handleResponse<{ user?: User | null }>(response);
        console.debug('[api.auth.me] Auth successful - user data:', (result as any)?.user?.email || 'no email');
        return result;
      } catch (err: any) {
        if (err?.name === "AbortError" || /network|fetch|failed|suspend/i.test(String(err?.message || ""))) {
          console.warn('[api.auth.me] Network error - returning null');
          return { user: null } as any;
        }
        console.error('[api.auth.me] Unexpected error:', err);
        throw err;
      }
    },

    forgotPassword: async (email: string): Promise<{ success: boolean }> => {
      const response = await csrfFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      return handleResponse<{ success: boolean }>(response);
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
      const response = await csrfFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });;
      return handleResponse<{ message: string }>(response);
    },

    setPassword: async (newPassword: string): Promise<{ message: string }> => {
      const response = await csrfFetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });;
      if (!response.ok) {
        return handleResponse<{ message: string }>(response);
      }
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return handleResponse<{ message: string }>(response);
      }
      const text = await response.text();
      return { message: text || "Password set successfully" };
    },

    register: async (email: string, password: string, name: string): Promise<{ user: User }> => {
      const response = await csrfFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ email, password, name }),
        credentials: "include",
      });
      const data = await handleResponse<{ user: User }>(response);
      // After register, the backend regenerates the session and issues a new CSRF token
      // Always clear cache and let next request fetch fresh token
      clearCsrfToken();
      return data;
    },
  },

  detectives: {
    getCurrent: async (): Promise<{ detective: Detective & { 
      email?: string;
      subscriptionPackage?: any;
      pendingPackage?: any;
    } }> => {
      const response = await csrfFetch(buildApiUrl("/api/detectives/me"), {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getAll: async (limit = 50, offset = 0): Promise<{ detectives: Detective[] }> => {
      const response = await csrfFetch(`/api/detectives?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getById: async (id: string): Promise<{ detective: Detective & { subscriptionPackage?: any } }> => {
      const response = await csrfFetch(`/api/detectives/${id}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getBySlug: async (country: string, state: string, city: string, slug: string): Promise<{ detective: Detective & { subscriptionPackage?: any } }> => {
      const response = await csrfFetch(`/api/detectives/${country}/${state}/${city}/${slug}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByCountry: async (country: string): Promise<{ detectives: Detective[] }> => {
      const response = await csrfFetch(`/api/detectives?country=${encodeURIComponent(country)}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    search: async (params?: {
      country?: string;
      status?: "active" | "pending" | "suspended" | "inactive";
      plan?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ detectives: Detective[] }> => {
      const queryParams = new URLSearchParams();
      if (params?.country) queryParams.append("country", params.country);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.plan) queryParams.append("plan", params.plan);
      if (params?.search) queryParams.append("search", params.search);
      if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString());

      try {
        const response = await csrfFetch(`/api/detectives?${queryParams.toString()}`, { credentials: "include" });
        const result = await handleResponse<{ detectives: Detective[]; total?: number }>(response);
        if (Array.isArray(result?.detectives) && result.detectives.length === 0) {
          try {
            const adminResp = await csrfFetch(`/api/admin/detectives/raw`, {
              credentials: "include",
            });
            if (adminResp.ok) {
              const adminData = await adminResp.json();
              if (Array.isArray(adminData?.detectives) && adminData.detectives.length > 0) {
                return { detectives: adminData.detectives };
              }
            }
          } catch {}
        }
        return { detectives: result.detectives || [] };
      } catch (err: any) {
        throw err;
      }
    },

    adminSearch: async (params?: {
      status?: string;
      plan?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ detectives: Detective[]; total?: number }> => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append("status", params.status);
      if (params?.plan) queryParams.append("plan", params.plan);
      if (params?.search) queryParams.append("search", params.search);
      if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const response = await csrfFetch(`/api/admin/detectives/raw${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertDetective): Promise<{ detective: Detective }> => {
      const response = await csrfFetch(buildApiUrl("/api/detectives"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<Detective>): Promise<{ detective: Detective }> => {
      const response = await csrfFetch(`/api/detectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },
    createOnboardingServices: async (id: string, services: Array<{ category: string; basePrice: string }>): Promise<{ ok: boolean }> => {
      const response = await csrfFetch(`/api/detectives/${id}/onboarding/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
        credentials: "include",
      });
      return handleResponse(response);
    },

    adminUpdate: async (id: string, data: Partial<Detective>): Promise<{ detective: Detective }> => {
      const response = await csrfFetch(`/api/admin/detectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    resetPassword: async (id: string): Promise<{ message: string; temporaryPassword: string; email: string }> => {
      const response = await csrfFetch(`/api/admin/detectives/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      return handleResponse(response);
    },

    adminDelete: async (id: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/admin/detectives/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },

    getSubscriptionLimits: async (): Promise<{ limits: Record<string, number> }> => {
      const response = await csrfFetch(`/api/subscription-limits`, { credentials: "include" });
      return handleResponse(response);
    },
    getPublicServiceCount: async (id: string): Promise<{ count: number }> => {
      const response = await csrfFetch(`/api/detectives/${id}/public-service-count`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  },
  subscriptionPlans: {
    getAll: async (opts?: { includeInactive?: boolean }): Promise<{ plans: any[] }> => {
      const q = (opts?.includeInactive ? "?all=1" : "");
      const response = await csrfFetch(`/api/subscription-plans${q}`, { credentials: "include" });
      return handleResponse(response);
    },
    adminGetAll: async (): Promise<{ plans: any[] }> => {
      const response = await csrfFetch(`/api/admin/subscription-plans`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
    create: async (data: any): Promise<{ plan: any }> => {
      const response = await csrfFetch(`/api/subscription-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
    update: async (id: string, data: any): Promise<{ plan: any }> => {
      const response = await csrfFetch(`/api/subscription-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
    delete: async (id: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/subscription-plans/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
  },
  services: {
    search: async (params?: {
      category?: string;
      country?: string;
      state?: string;
      city?: string;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      sortBy?: string;
      minRating?: number;
      planName?: string;
      level?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ services: Array<Service & { detective: Detective; avgRating: number; reviewCount: number; planName?: string }> }> => {
      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.append("category", params.category);
      if (params?.country) queryParams.append("country", params.country);
      if (params?.state) queryParams.append("state", params.state);
      if (params?.city) queryParams.append("city", params.city);
      if (params?.search) queryParams.append("search", params.search);
      if (params?.minPrice !== undefined) queryParams.append("minPrice", params.minPrice.toString());
      if (params?.maxPrice !== undefined) queryParams.append("maxPrice", params.maxPrice.toString());
      if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
      if (params?.minRating !== undefined) queryParams.append("minRating", params.minRating.toString());
      if (params?.planName) queryParams.append("planName", params.planName);
      if (params?.level) queryParams.append("level", params.level);
      if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString());

      const response = await csrfFetch(`/api/services?${queryParams.toString()}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getAll: async (limit = 50, offset = 0): Promise<{ services: Service[] }> => {
      const response = await csrfFetch(`/api/services?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getById: async (id: string, options?: { preview?: boolean }): Promise<{ service: Service; detective: Detective; avgRating: number; reviewCount: number }> => {
      const qs = options?.preview ? "?preview=1" : "";
      const response = await csrfFetch(`/api/services/${id}${qs}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getBySlug: async (
      serviceSlug: string,
      detectiveSlug?: string | null,
      options?: { preview?: boolean },
      country?: string,
      state?: string,
      city?: string
    ): Promise<{ service: Service; detective: Detective; avgRating: number; reviewCount: number }> => {
      const params = new URLSearchParams();
      if (options?.preview) params.set("preview", "1");
      const qs = params.toString() ? `?${params.toString()}` : "";
      if (!country || !state || !city || !detectiveSlug || !serviceSlug) throw new Error("Missing location or slug params");
      const response = await csrfFetch(`/api/services/${country}/${state}/${city}/${detectiveSlug}/${serviceSlug}${qs}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByDetective: async (detectiveId: string): Promise<{ services: Service[] }> => {
      const response = await csrfFetch(`/api/services/detective/${detectiveId}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getFeaturedHome: async (country?: string): Promise<{ services: Service[] }> => {
      const queryParams = new URLSearchParams();
      if (country) queryParams.append("country", country);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const response = await csrfFetch(`/api/services/featured/home${qs}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    adminGetByDetective: async (detectiveId: string): Promise<{ services: Service[] }> => {
      const response = await csrfFetch(`/api/admin/detectives/${detectiveId}/services`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertService): Promise<{ service: Service }> => {
      const response = await csrfFetch(buildApiUrl("/api/services"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    adminCreateForDetective: async (detectiveId: string, data: Omit<InsertService, "detectiveId">): Promise<{ service: Service }> => {
      const response = await csrfFetch(`/api/admin/detectives/${detectiveId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<Service>): Promise<{ service: Service }> => {
      const response = await csrfFetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    adminUpdatePricing: async (id: string, data: { basePrice?: string | null; offerPrice?: string | null; isOnEnquiry?: boolean }): Promise<{ service: Service }> => {
      const response = await csrfFetch(`/api/admin/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/services/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  reviews: {
    getAll: async (limit = 50, offset = 0): Promise<{ reviews: Review[] }> => {
      const response = await csrfFetch(`/api/reviews?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByService: async (serviceId: string, limit = 20): Promise<{ reviews: Review[] }> => {
      const response = await csrfFetch(`/api/services/${serviceId}/reviews?limit=${limit}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByDetective: async (): Promise<{ reviews: Array<Review & { serviceTitle?: string }> }> => {
      const response = await csrfFetch(`/api/reviews/detective`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertReview): Promise<{ review: Review }> => {
      const response = await csrfFetch(buildApiUrl("/api/reviews"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<Review>): Promise<{ review: Review }> => {
      const response = await csrfFetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/reviews/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  orders: {
    getAll: async (limit = 50, offset = 0): Promise<{ orders: Order[] }> => {
      const response = await csrfFetch(`/api/orders?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getById: async (id: string): Promise<{ order: Order }> => {
      const response = await csrfFetch(`/api/orders/${id}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByUser: async (_userId: string): Promise<{ orders: Order[] }> => {
      const response = await csrfFetch(`/api/orders/user`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    getByDetective: async (_detectiveId: string): Promise<{ orders: Order[] }> => {
      const response = await csrfFetch(`/api/orders/detective`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertOrder): Promise<{ order: Order }> => {
      const response = await csrfFetch(buildApiUrl("/api/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<Order>): Promise<{ order: Order }> => {
      const response = await csrfFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  users: {
    getById: async (id: string): Promise<{ user: User }> => {
      const response = await csrfFetch(`/api/users/${id}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<User>): Promise<{ user: User }> => {
      const response = await csrfFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  favorites: {
    getByUser: async (userId: string): Promise<{ favorites: any[] }> => {
      const response = await csrfFetch(`/api/favorites/user/${userId}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    add: async (userId: string, detectiveId: string): Promise<{ favorite: any }> => {
      const response = await csrfFetch(buildApiUrl("/api/favorites"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, detectiveId }),
        credentials: "include",
      });
      return handleResponse(response);
    },

    remove: async (userId: string, detectiveId: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/favorites/${userId}/${detectiveId}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  applications: {
    getAll: async (params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<{ applications: DetectiveApplication[] }> => {
      const qp = new URLSearchParams();
      if (params?.status) qp.append("status", params.status);
      if (params?.search) qp.append("search", params.search);
      if (params?.limit !== undefined) qp.append("limit", String(params.limit));
      if (params?.offset !== undefined) qp.append("offset", String(params.offset));
      const response = await csrfFetch(`/api/applications?${qp.toString()}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
    getById: async (id: string): Promise<{ application: DetectiveApplication }> => {
      const response = await csrfFetch(`/api/applications/${id}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertDetectiveApplication): Promise<{ application: DetectiveApplication }> => {
      console.log("API: Starting fetch to /api/applications");
      console.log("API: Preparing request body...");
      
      let jsonBody: string;
      try {
        jsonBody = JSON.stringify(data);
        console.log("API: JSON body size:", jsonBody.length, "characters");
      } catch (error: any) {
        console.error("API: Failed to stringify data:", error);
        throw new ApiError(400, "Failed to prepare request data: " + error.message);
}
      
      try {
        console.log("API: Sending request...");
        const response = await fetchWithTimeout("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonBody,
          credentials: "include",
        }, 60000); // 60 second timeout for large file uploads
        console.log("API: Fetch completed with status:", response.status);
        return handleResponse(response);
      } catch (error: any) {
        console.error("API: Fetch failed:", error);
        console.error("API: Error name:", error.name);
        console.error("API: Error message:", error.message);
        throw error;
      }
    },

    updateStatus: async (id: string, data: { status?: "approved" | "rejected"; reviewNotes?: string }): Promise<{ application: DetectiveApplication }> => {
      const response = await csrfFetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  claims: {
    getAll: async (status: string = "pending", limit: number = 50): Promise<{ claims: ProfileClaim[] }> => {
      const qs = new URLSearchParams();
      if (status) qs.append("status", status);
      if (limit) qs.append("limit", String(limit));
      try {
        const response = await csrfFetch(`/api/claims?${qs.toString()}`, {
          credentials: "include",
        });
        return handleResponse(response);
      } catch (err: any) {
        return { claims: [] } as any;
      }
    },

    updateStatus: async (id: string, status: "approved" | "rejected"): Promise<{ claim: ProfileClaim }> => {
      const response = await csrfFetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      return handleResponse(response);
    },
  },

  serviceCategories: {
    getAll: async (activeOnly?: boolean): Promise<{ categories: ServiceCategory[] }> => {
      const queryParams = activeOnly ? "?activeOnly=true" : "";
      try {
        const response = await csrfFetch(`/api/service-categories${queryParams}`, {
          credentials: "include",
        });
        return handleResponse(response);
      } catch (err: any) {
        if (err?.name === "AbortError" || /network|fetch|failed|suspend/i.test(String(err?.message || ""))) {
          return { categories: [] } as any;
        }
        throw err;
      }
    },

    getById: async (id: string): Promise<{ category: ServiceCategory }> => {
      const response = await csrfFetch(`/api/service-categories/${id}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },

    create: async (data: InsertServiceCategory): Promise<{ category: ServiceCategory }> => {
      const response = await csrfFetch(buildApiUrl("/api/service-categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    update: async (id: string, data: Partial<ServiceCategory>): Promise<{ category: ServiceCategory }> => {
      const response = await csrfFetch(`/api/service-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<{ message: string }> => {
      const response = await csrfFetch(`/api/service-categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
  },
  settings: {
    getSite: async (): Promise<{ settings: any }> => {
      try {
        const response = await csrfFetch(`/api/site-settings`, { credentials: "include" });
        return handleResponse(response);
      } catch (err: any) {
        if (err?.name === "AbortError" || /network|fetch|failed|suspend/i.test(String(err?.message || ""))) {
          return { settings: { logoUrl: null, footerLinks: [] } } as any;
        }
        throw err;
      }
    },
    updateSite: async (data: { 
      logoUrl?: string | null;
      headerLogoUrl?: string | null;
      stickyHeaderLogoUrl?: string | null;
      footerLogoUrl?: string | null;
      heroBackgroundImage?: string | null;
      featuresImage?: string | null;
      footerLinks?: Array<{ label: string; href: string }>;
      footerSections?: any[];
      socialLinks?: any;
      copyrightText?: string;
    }): Promise<{ settings: any }> => {
      const response = await csrfFetch(`/api/admin/site-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(response);
    },
  },
  catalog: {
    getPopularCategories: async (): Promise<{ categories: Array<{ category: string; count: number }> }> => {
      try {
        const response = await csrfFetch(`/api/popular-categories`, { credentials: "include" });
        return handleResponse(response);
      } catch (err: any) {
        if (err?.name === "AbortError" || /abort|network.*failed/i.test(String(err?.message || ""))) {
          return { categories: [] } as any;
        }
        throw err;
      }
    },
  },
  locations: {
    getCountries: async (): Promise<{ countries: Array<{ id: string; code: string; name: string; slug: string }> }> => {
      const response = await csrfFetch(`/api/locations/countries`, { credentials: "include" });
      return handleResponse(response);
    },
    getStates: async (country: string): Promise<{ states: Array<{ id: string; countryId: string; name: string; slug: string }> }> => {
      const response = await csrfFetch(`/api/locations/states/${encodeURIComponent(country)}`, { credentials: "include" });
      return handleResponse(response);
    },
    getCities: async (country: string, state: string): Promise<{ cities: Array<{ id: string; stateId: string; name: string; slug: string }> }> => {
      const response = await csrfFetch(`/api/locations/cities/${encodeURIComponent(state)}?countryId=${encodeURIComponent(country)}`, { credentials: "include" });
      return handleResponse(response);
    },
  },
};

export { ApiError };
