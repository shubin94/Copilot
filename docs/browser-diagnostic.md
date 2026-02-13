Browser Diagnostic Script

Location: browser-diagnostic-script.js

Usage:
- Open the site login page (e.g. https://www.askdetectives.com/login) in your browser.
- Open DevTools (F12) and go to the Console tab.
- Copy the entire contents of `browser-diagnostic-script.js` and paste it into the Console.
- Press Enter to run. The script will:
  - Inspect `import.meta.env` (when available)
  - Compute the API base URL
  - Check navigator and service workers
  - Attempt a CSRF request to `/api/csrf-token` (credentials included)
  - Log cookies and helpful diagnostics

Notes:
- This script must run in the browser Console; it will not run in Node.js.
- If the CSRF request fails, check CORS, API base URL, and that the API is reachable from the browser.
- The script intentionally avoids modifying site state; it only performs read-only checks and a GET request to the CSRF endpoint.

Example:
- Paste the script and look for `✅ SUCCESS: Got CSRF token(...)` to confirm the frontend can reach the API and receive a CSRF token.
