/**
 * ROUTE PROTECTION WRAPPER
 * 
 * Higher-order component that protects routes from unauthorized access.
 * Re-checks authentication on mount and redirects if invalid.
 * 
 * USAGE:
 * const ProtectedPage = withAuthProtection(MyPage, { redirectTo: '/login' });
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './hooks';
import { handleSessionInvalid } from './authSessionManager';
import type { User } from '@shared/schema';

interface AuthProtectionOptions {
  /** Where to redirect if not authenticated */
  redirectTo?: string;
  /** Required user role(s) */
  requiredRole?: User['role'] | User['role'][];
  /** Custom validation function */
  customValidation?: (user: User | null) => boolean;
  /** Show loading state while checking auth */
  showLoading?: boolean;
}

/**
 * HOC that wraps a component with auth protection
 */
export function withAuthProtection<P extends object>(
  Component: React.ComponentType<P>,
  options: AuthProtectionOptions = {}
) {
  return function ProtectedComponent(props: P) {
    const {
      redirectTo = '/login',
      requiredRole,
      customValidation,
      showLoading = true,
    } = options;

    const [, setLocation] = useLocation();
    const { data, isLoading, error } = useAuth();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
      // Wait for auth check to complete
      if (isLoading) return;

      const user = data?.user || null;

      // Check 1: User must be authenticated
      if (!user) {
        console.warn('[AUTH_PROTECTION] No authenticated user - redirecting');
        handleSessionInvalid('auth_check_failed');
        return;
      }

      // Check 2: Role-based access control
      if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!roles.includes(user.role)) {
          console.warn(`[AUTH_PROTECTION] User role '${user.role}' not in required roles [${roles.join(', ')}]`);
          setLocation('/'); // Redirect to home if role doesn't match
          return;
        }
      }

      // Check 3: Custom validation
      if (customValidation && !customValidation(user)) {
        console.warn('[AUTH_PROTECTION] Custom validation failed');
        setLocation(redirectTo);
        return;
      }

      // All checks passed
      setIsChecking(false);
    }, [isLoading, data, redirectTo, requiredRole, customValidation, setLocation]);

    // Handle errors
    useEffect(() => {
      if (error) {
        console.error('[AUTH_PROTECTION] Auth check error:', error);
        handleSessionInvalid('auth_error');
      }
    }, [error]);

    // Show loading state
    if (isLoading || isChecking) {
      if (!showLoading) return null;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
      );
    }

    // Render protected component
    return <Component {...props} />;
  };
}

/**
 * Hook for checking authentication in components
 * Triggers redirect if not authenticated
 */
export function useRequireAuth(options?: AuthProtectionOptions) {
  const { redirectTo = '/login', requiredRole, customValidation } = options || {};
  const [, setLocation] = useLocation();
  const { data, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const user = data?.user || null;

    if (!user) {
      console.warn('[USE_REQUIRE_AUTH] Not authenticated - redirecting');
      handleSessionInvalid('require_auth_failed');
      return;
    }

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(user.role)) {
        console.warn(`[USE_REQUIRE_AUTH] Insufficient permissions`);
        setLocation('/');
        return;
      }
    }

    if (customValidation && !customValidation(user)) {
      console.warn('[USE_REQUIRE_AUTH] Custom validation failed');
      setLocation(redirectTo);
      return;
    }
  }, [isLoading, data, redirectTo, requiredRole, customValidation, setLocation]);

  return { user: data?.user || null, isLoading };
}
