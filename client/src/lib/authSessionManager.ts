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
 */
export function createAuthInterceptor() {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override global fetch
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        let url = '';
        if (typeof args[0] === 'string') {
          url = args[0];
        } else if (args[0] instanceof Request) {
          url = args[0].url;
        } else if (args[0] instanceof URL) {
          url = args[0].toString();
        }
        
        // CRITICAL: Only trigger logout if we're on a PROTECTED route
        // Don't redirect if already on login/signup/public pages
        const currentPath = window.location.pathname;
        const publicPaths = ['/login', '/signup', '/detective-signup', '/', '/search', '/category', '/service', '/about', '/privacy', '/terms', '/contact', '/support', '/blog', '/packages', '/p/'];
        const isPublicPage = publicPaths.some(path => currentPath.startsWith(path)) || currentPath === '/';
        
        // Skip interceptor for:
        // 1. /api/auth/me endpoint (to prevent infinite loops)
        // 2. Public pages (401 is expected when not logged in)
        // 3. Login/signup pages (already on auth pages)
        if (!url.includes('/api/auth/me') && !isPublicPage) {
          console.warn(`[AUTH] Received ${response.status} from ${url} on protected route - session invalid`);
          
          // Trigger logout after returning response (non-blocking)
          setTimeout(() => {
            handleSessionInvalid(`api_${response.status}`);
          }, 100);
        }
      }
      
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
 * AUTH STATE MONITOR
 * Periodically checks auth state and detects session expiry
 */
export function startAuthMonitor() {
  // Check auth state every 30 seconds
  const checkInterval = 30 * 1000;
  
  const checkAuthState = async () => {
    try {
      // Check if we're on a protected route
      const protectedPaths = [
        '/admin',
        '/detective/dashboard',
        '/detective/profile',
        '/detective/services',
        '/detective/reviews',
        '/detective/subscription',
        '/detective/billing',
        '/detective/settings',
        '/user/dashboard',
        '/user/favorites'
      ];
      
      const currentPath = window.location.pathname;
      const isProtectedRoute = protectedPaths.some(path => currentPath.startsWith(path));
      
      if (!isProtectedRoute) {
        // Reset state tracking if not on protected route
        lastAuthState = null;
        return; // Only monitor on protected routes
      }
      
      // Fetch current auth state
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      const isAuthenticated = response.ok;
      
      // Store current state for comparison
      if (lastAuthState === null) {
        lastAuthState = isAuthenticated;
        localStorage.setItem('auth_state', isAuthenticated.toString());
        return;
      }
      
      // Detect auth state change (was authenticated, now not)
      if (lastAuthState && !isAuthenticated) {
        console.warn('[AUTH] Auth state changed - was authenticated, now unauthenticated');
        handleSessionInvalid('state_change_detected');
      }
      
      lastAuthState = isAuthenticated;
      localStorage.setItem('auth_state', isAuthenticated.toString());
      
    } catch (error) {
      console.error('[AUTH] Error checking auth state:', error);
    }
  };
  
  // Run initial check
  checkAuthState();
  
  // Set up periodic checks
  const intervalId = setInterval(checkAuthState, checkInterval);
  
  console.log(`[AUTH] State monitor started (checking every ${checkInterval/1000}s on protected routes)`);
  
  return () => {
    clearInterval(intervalId);
    console.log('[AUTH] State monitor stopped');
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
