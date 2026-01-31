# AUTH SESSION HANDLING — QUICK REFERENCE

## WHAT WAS IMPLEMENTED

✅ **Global API interceptor** - Catches all 401/403 responses  
✅ **Automatic logout** - Immediate redirect to /login  
✅ **Cross-tab sync** - Logout in one tab → all tabs redirect  
✅ **Session monitoring** - Checks every 30s on protected routes  
✅ **Centralized handler** - Single logout function for all cases  

---

## HOW IT WORKS

### Scenario 1: User Clicks Logout
1. User clicks logout button
2. `logout()` called in UserContext
3. Backend API `/api/auth/logout` called
4. `handleSessionInvalid('manual_logout')` triggered
5. **Immediate redirect to /login**

### Scenario 2: Session Expires
1. User idle or session timeout on backend
2. Next API call returns 401
3. Global interceptor catches response
4. `handleSessionInvalid('api_401')` triggered
5. **Automatic redirect to /login**

### Scenario 3: Multi-Tab Logout
1. User logs out in Tab A
2. `logout_event` written to localStorage
3. Tabs B, C, D detect storage change
4. All tabs redirect to /login

### Scenario 4: Direct Protected Route Access
1. User navigates to `/admin/dashboard`
2. Component mounts
3. `useAuth()` hook checks session
4. No user found
5. **Redirect to /login**

---

## KEY FILES

### `client/src/lib/authSessionManager.ts`
- Central logout handler: `handleSessionInvalid()`
- Global fetch interceptor: `createAuthInterceptor()`
- Cross-tab sync: `setupCrossTabLogout()`
- Auth monitor: `startAuthMonitor()`
- Initialization: `initializeAuthSession()`

### `client/src/App.tsx`
- Calls `initializeAuthSession()` on mount
- Configures features (cross-tab, monitor, idle timeout)

### `client/src/lib/user-context.tsx`
- Updated `logout()` to use `handleSessionInvalid()`
- No more direct `window.location.href` calls

### `client/src/lib/queryClient.ts`
- Added global mutation error handler
- Catches 401/403 in mutations

### `client/src/lib/authProtection.tsx` (Optional)
- HOC for route protection: `withAuthProtection()`
- Hook: `useRequireAuth()`

---

## CONFIGURATION

```typescript
// In App.tsx
initializeAuthSession({
  enableIdleTimeout: false,       // Idle timeout (optional)
  idleTimeoutMinutes: 60,         // If enabled
  enableCrossTabLogout: true,     // Cross-tab sync
  enableAuthMonitor: true,        // Periodic checks
});
```

---

## LOGGING

All auth actions logged with `[AUTH]` prefix:

```
[AUTH] Session invalid: manual_logout - triggering cleanup
[AUTH] Redirecting to login page...
[AUTH] Received 401 from /api/detectives/me - session invalid
[AUTH] Logout detected in another tab - synchronizing
```

---

## TESTING

### Manual Logout:
1. Login as any user
2. Click logout button
3. **Expected:** Immediate redirect to /login
4. Try back button
5. **Expected:** Cannot return to dashboard

### Session Expiry:
1. Login as any user
2. Stop backend server (simulate session loss)
3. Click any API-dependent action
4. **Expected:** Automatic redirect to /login

### Cross-Tab:
1. Open app in 2 tabs
2. Login in both
3. Logout in Tab 1
4. **Expected:** Tab 2 redirects automatically

### Direct Access:
1. Logout completely
2. Type `/admin/dashboard` in URL
3. **Expected:** Redirect to /login

---

## SUCCESS CRITERIA ✅

- ✅ No stale authenticated pages after logout
- ✅ Automatic redirect on session expiry
- ✅ Cross-tab logout synchronization
- ✅ Global 401/403 handling
- ✅ Centralized implementation
- ✅ Comprehensive logging

---

## TROUBLESHOOTING

### Issue: Still seeing protected page after logout
- Check browser console for `[AUTH]` logs
- Verify `initializeAuthSession()` called in App.tsx
- Clear browser cache and localStorage

### Issue: Redirect not happening
- Check Network tab for API responses
- Verify 401/403 being returned
- Check if interceptor installed (look for log)

### Issue: Cross-tab not working
- Verify `enableCrossTabLogout: true`
- Check localStorage for `logout_event` key
- Try incognito mode (fresh session)

---

## MAINTENANCE

### Adjust Monitor Frequency:
Edit `authSessionManager.ts`:
```typescript
const checkInterval = 30 * 1000; // 30s (default)
// Change to:
const checkInterval = 60 * 1000; // 60s (less frequent)
```

### Enable Idle Timeout:
Edit `App.tsx`:
```typescript
initializeAuthSession({
  enableIdleTimeout: true,      // Enable
  idleTimeoutMinutes: 30,       // 30min timeout
});
```

### Add Protected Route:
Edit `authSessionManager.ts` → `startAuthMonitor()`:
```typescript
const protectedPaths = [
  '/admin',
  '/detective/dashboard',
  '/new-protected-path',  // Add here
];
```

---

## SUPPORT

**Documentation:** [AUTH_SESSION_HANDLING_COMPLETE.md](AUTH_SESSION_HANDLING_COMPLETE.md)

**Key Functions:**
- `handleSessionInvalid(reason)` - Central logout
- `initializeAuthSession(options)` - Setup
- `withAuthProtection(Component)` - Route protection

**Logs to Monitor:**
- `[AUTH]` - Session management
- `[USER_CONTEXT]` - User actions
- `[QUERY_CLIENT]` - API errors
