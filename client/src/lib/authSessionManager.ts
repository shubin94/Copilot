/**
 * AUTH SESSION MANAGER
 * 
 * Centralized authentication state management with automatic
 * session expiry handling and forced redirects.
 * 
 * CRITICAL FEATURES:
 * - Global 401/403 interceptor
 * - Automatic logout on session expiry
 * - Cross-tab logout detection
 * - Immediate page refresh/redirect
 * - No stale authenticated pages
 */

import { queryClient } from "./queryClient";
import { buildApiUrl, clearCsrfToken } from "./api";

// Flag to prevent multiple simultaneous logout triggers
let isLoggingOut = false;

// Track last known auth state for cross-tab detection
let lastAuthState: boolean | null = null;

/**
 * CENTRAL LOGOUT HANDLER
 * Called whenever session becomes invalid (logout, expiry, 401, etc.)
 */
export async function handleSessionInvalid(reason: string = 'session_expired') {
  // Prevent multiple simultaneous logout calls
  if (isLoggingOut) {
    console.log('[AUTH] Logout already in progress, ignoring duplicate call');
    return;
  }
  
  // CRITICAL: Don't redirect if already on login/public pages
  const currentPath = window.location.pathname;
  const publicPaths = ['/login', '/signup', '/detective-signup'];
  if (publicPaths.some(path => currentPath.startsWith(path))) {
    console.log('[AUTH] Already on auth page, skipping redirect');
    // Still clear cache but don't redirect
    queryClient.clear();
    localStorage.removeItem('favorites');
    localStorage.removeItem('auth_state');
    return;
  }
  
  isLoggingOut = true;
  console.log(`[AUTH] Session invalid: ${reason} - triggering cleanup`);
  
  try {
    // Clear all query cache
    queryClient.clear();
    clearCsrfToken();
    
    // Clear local storage auth-related data
    localStorage.removeItem('favorites');
    localStorage.removeItem('auth_state');
    
    // Clear session storage
    sessionStorage.clear();
    
    // Mark logout event for cross-tab detection
    localStorage.setItem('logout_event', Date.now().toString());
    
    console.log('[AUTH] Redirecting to login page...');
    
    // IMMEDIATE REDIRECT - No silent state updates
    // Use replace to prevent back button issues
    window.location.replace('/login');
    
  } catch (error) {
    console.error('[AUTH] Error during logout:', error);
    // Force redirect even if cleanup fails
    window.location.replace('/login');
  } finally {
    // Reset flag after short delay (in case redirect fails)
    setTimeout(() => {
      isLoggingOut = false;
    }, 2000);
  }
}

/**
 * GLOBAL API RESPONSE INTERCEPTOR
 * Wraps fetch to automatically handle 401/403 responses
 * 
 * CRITICAL: This interceptor ONLY logs out on protected routes.
 * It NEVER triggers logout for:
 * 1. /api/auth/me endpoint (returns 401 for unauthenticated users, that's valid)
 * 2. Public pages (401 responses are expected and normal)
 * 3. Public API endpoints (401 doesn't mean invalid session, just "not authenticated")
 * 
 * Only logout when:
 * - User is on a PROTECTED page (admin, detective dashboard, user dashboard)
 * - API call to a PROTECTED endpoint returns 401/403
 * - This signals a lost session (previously authenticated, now invalid)
 */
export function createAuthInterceptor() {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override global fetch
  window.fetch = async (...args: any[]) => {
    try {
      const response = await (originalFetch as any)(...args);
      
      // Extract URL from different argument types
      if (!(response.status === 401 || response.status === 403)) {
        // Not an auth error, return response as-is
        return response;
      }
      
      // Get the request URL
      let url = '';
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
      } else if (args[0] instanceof URL) {
        url = args[0].toString();
      }
      
      // CRITICAL: Skip interceptor for auth/me endpoint
      // The endpoint returns 401 for unauthenticated users - that's valid behavior
      // This is NOT a "lost session", it's "no session yet"
      if (url.includes('/api/auth/me')) {
        console.debug(`[AUTH] Ignoring ${response.status} from ${url} - auth check endpoint`);
        return response;
      }
      
      // Get current page
      const currentPath = window.location.pathname;
      
      // List of public pages where 401 is expected and normal
      const publicPages = [
        '/login', 
        '/signup', 
        '/detective-signup', 
        '/',                  // Homepage
        '/search', 
        '/category', 
        '/service', 
        '/about', 
        '/privacy', 
        '/terms', 
        '/contact', 
        '/support', 
        '/blog', 
        '/packages', 
        '/p/',
      ];
      
      // Check if we're on a public page
      const isPublicPage = publicPages.some(path => currentPath.startsWith(path)) || currentPath === '/';
      
      // Skip logout if on public page (401 is normal here)
      if (isPublicPage) {
        console.debug(`[AUTH] Ignoring ${response.status} from ${url} - user on public page`);
        return response;
      }
      
      // If we reach here:
      // - Status is 401/403
      // - NOT from /api/auth/me endpoint
      // - NOT on a public page
      // This means user lost their session on a protected page
      console.warn(`[AUTH] Received ${response.status} from ${url} on protected page - session invalid`);
      
      // Trigger logout after returning response (non-blocking)
      setTimeout(() => {
        handleSessionInvalid(`api_${response.status}`);
      }, 100);
      
      return response;
    } catch (error) {
      throw error;
    }
  };
  
  console.log('[AUTH] Global API interceptor installed');
}

/**
 * CROSS-TAB LOGOUT DETECTION
 * Detects when user logs out in another tab
 */
export function setupCrossTabLogout() {
  window.addEventListener('storage', (e) => {
    // Detect logout event from another tab
    if (e.key === 'logout_event' && e.newValue) {
      console.log('[AUTH] Logout detected in another tab - synchronizing');
      
      // Clear local state
      queryClient.clear();
      
      // Redirect to login
      window.location.replace('/login');
    }
  });
  
  console.log('[AUTH] Cross-tab logout detection enabled');
}

/**
 * AUTH STATE MONITOR - DISABLED
 * 
 * This was calling /api/auth/me every 30 seconds causing excessive API calls
 * on route changes and page navigation.
 * 
 * REPLACED WITH: One-time auth check via React Query hook + API interceptor
 * 
 * Auth flow is now:
 * 1. useAuth() hook calls /api/auth/me ONCE on component mount
 * 2. React Query caches result with staleTime: 0 (always stale but cached)
 * 3. Route changes don't remount UserProvider (stable context)
 * 4. API interceptor automatically handles 401/403 responses
 * 5. Manual invalidation only on login/logout
 */
export function startAuthMonitor() {
  // DISABLED - Use React Query + API interceptor instead
  console.log('[AUTH] State monitor DISABLED - using React Query instead');
  
  return () => {
    // No-op cleanup
  };
}

/**
 * SESSION ACTIVITY TRACKER
 * Tracks user activity and triggers logout after idle timeout
 */
export function setupIdleTimeout(timeoutMinutes: number = 60) {
  let idleTimer: NodeJS.Timeout;
  let isIdle = false;
  
  const resetIdleTimer = () => {
    if (isIdle) {
      isIdle = false;
      console.log('[AUTH] User activity detected - idle timer reset');
    }
    
    clearTimeout(idleTimer);
    
    idleTimer = setTimeout(() => {
      isIdle = true;
      console.warn(`[AUTH] User idle for ${timeoutMinutes} minutes - session expired`);
      handleSessionInvalid('idle_timeout');
    }, timeoutMinutes * 60 * 1000);
  };
  
  // Activity events to monitor
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
  });
  
  // Start timer
  resetIdleTimer();
  
  console.log(`[AUTH] Idle timeout set to ${timeoutMinutes} minutes`);
  
  return () => {
    clearTimeout(idleTimer);
    events.forEach(event => {
      document.removeEventListener(event, resetIdleTimer, true);
    });
    console.log('[AUTH] Idle timeout cleared');
  };
}

/**
 * INITIALIZE ALL AUTH SESSION HANDLERS
 * Call this once when app starts
 */
export function initializeAuthSession(options?: {
  enableIdleTimeout?: boolean;
  idleTimeoutMinutes?: number;
  enableCrossTabLogout?: boolean;
  enableAuthMonitor?: boolean;
}) {
  const {
    enableIdleTimeout = false, // Disabled by default (optional feature)
    idleTimeoutMinutes = 60,
    enableCrossTabLogout = true,
    enableAuthMonitor = true,
  } = options || {};
  
  console.log('[AUTH] Initializing auth session management...');
  
  // Install global API interceptor (CRITICAL - always enabled)
  createAuthInterceptor();
  
  // Setup cross-tab logout detection
  if (enableCrossTabLogout) {
    setupCrossTabLogout();
  }
  
  // Start auth state monitor
  let stopAuthMonitor: (() => void) | undefined;
  if (enableAuthMonitor) {
    stopAuthMonitor = startAuthMonitor();
  }
  
  // Setup idle timeout (optional)
  let stopIdleTimeout: (() => void) | undefined;
  if (enableIdleTimeout) {
    stopIdleTimeout = setupIdleTimeout(idleTimeoutMinutes);
  }
  
  console.log('[AUTH] Auth session management initialized ✅');
  
  // Return cleanup function
  return () => {
    if (stopAuthMonitor) stopAuthMonitor();
    if (stopIdleTimeout) stopIdleTimeout();
  };
}
