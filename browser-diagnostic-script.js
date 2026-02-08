/**
 * Browser Console Diagnostic Script
 * 
 * Copy & paste this entire script into DevTools Console on https://www.askdetectives.com/login
 * and press Enter. It will check the API URL, attempt the CSRF request, and log detailed info.
 */

(async function runDiagnostic() {
  console.log('%c=== AskDetectives Frontend Diagnostic ===', 'color: blue; font-weight: bold; font-size: 14px;');
  
  // Step 1: Check import.meta.env values (with guard for DevTools)
  console.log('\n%c1. Environment Variables:', 'font-weight: bold; color: darkblue;');
  
  // Guard - check if import.meta.env exists using try/catch
  let hasImportMeta = false;
  let viteApiUrl = undefined;
  let isProd = false;
  let mode = 'unknown';
  
  try {
    viteApiUrl = import.meta.env.VITE_API_URL;
    isProd = import.meta.env.PROD;
    mode = import.meta.env.MODE;
    hasImportMeta = true;
  } catch (e) {
    hasImportMeta = false;
  }
  
  if (!hasImportMeta) {
    console.warn('⚠️  import.meta.env not available (running in DevTools or different context)');
  } else {
    console.log('VITE_API_URL:', viteApiUrl);
    console.log('PROD:', isProd);
    console.log('MODE:', mode);
  }
  
  // Deduce the actual API_BASE_URL with fallback
  const API_BASE_URL = viteApiUrl || 
    (isProd ? "https://copilot-06s5.onrender.com" : "") ||
    (typeof window !== "undefined" && window.location ? window.location.protocol + "//" + window.location.host : "");
  console.log('Computed API_BASE_URL:', API_BASE_URL || '(empty - will use relative path)');
  
  // Step 2: Check Navigator/Network info
  console.log('\n%c2. Browser & Network Info:', 'font-weight: bold; color: darkblue;');
  console.log('User Agent:', navigator.userAgent);
  console.log('Online:', navigator.onLine);
  console.log('Current Origin:', window.location.origin);
  
  // Step 3: Check for Service Workers
  console.log('\n%c3. Service Workers:', 'font-weight: bold; color: darkblue;');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length === 0) {
        console.log('✅ No Service Workers registered');
      } else {
        console.log(`⚠️  ${regs.length} Service Worker(s) found:`);
        regs.forEach((reg, idx) => {
          console.log(`  ${idx + 1}. Scope: ${reg.scope}`);
          console.log(`     State: ${reg.active ? 'ACTIVE' : 'INACTIVE'}`);
        });
      }
    }).catch(e => console.error('Error checking Service Workers:', e));
  } else {
    console.log('❌ Service Worker API not supported');
  }
  
  // Step 4: Attempt CSRF token fetch
  console.log('\n%c4. Attempting CSRF Token Fetch:', 'font-weight: bold; color: darkblue;');
  const csrfUrl = API_BASE_URL ? `${API_BASE_URL}/api/csrf-token` : "/api/csrf-token";
  console.log('Request URL:', csrfUrl);
  console.log('Method:', 'GET');
  console.log('Credentials:', 'include');
  console.log('Headers:', {
    'Cache-Control': 'no-store',
    'Origin': window.location.origin
  });
  
  try {
    const startTime = performance.now();
    const response = await fetch(csrfUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' }
    });
    const endTime = performance.now();
    
    console.log(`✅ Response received in ${(endTime - startTime).toFixed(2)}ms`);
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', {
      'content-type': response.headers.get('content-type'),
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
      'set-cookie': response.headers.get('set-cookie') || '(not exposed in fetch)',
    });
    
    const data = await response.json();
    console.log('Response Body:', data);
    
    if (response.ok && data.csrfToken) {
      console.log(`%c✅ SUCCESS: Got CSRF token (${data.csrfToken.substring(0, 16)}...)`, 'color: green; font-weight: bold;');
    } else {
      console.log(`%c❌ FAILED: Response was not OK or missing CSRF token`, 'color: red; font-weight: bold;');
    }
  } catch (error) {
    console.log(`%c❌ FETCH ERROR: ${error.message}`, 'color: red; font-weight: bold;');
    console.error('Full error:', error);
  }
  
  // Step 5: Cookies check
  console.log('\n%c5. Current Cookies:', 'font-weight: bold; color: darkblue;');
  const cookies = document.cookie.split('; ').filter(c => c.length > 0);
  if (cookies.length === 0) {
    console.log('(No cookies set for this origin)');
  } else {
    cookies.forEach(c => console.log('  -', c));
  }
  
  console.log('\n%c=== End of Diagnostic ===', 'color: blue; font-weight: bold; font-size: 14px;');
})();
