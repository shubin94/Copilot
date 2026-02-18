/**
 * Content Security Policy Configuration
 * 
 * Defines CSP headers to:
 * - Allow Google Fonts for typography
 * - Allow Radix UI inline scripts
 * - Allow API calls to Render backend
 * - Prevent XSS and injection attacks
 */

export const CSP_POLICY = [
  // Default: Only allow from self
  "default-src 'self'",
  
  // Scripts: Allow self, inline, eval (for Radix UI), Google services
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com",
  
  // Styles: Allow self, inline, and Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  
  // Style elements: Allow self, inline, and Google Fonts
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  
  // Fonts: Allow from self and Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com data:",
  
  // Images: Allow self, data URLs, and all https
  "img-src 'self' data: https:",
  
  // API connections: Allow Render backend and WebSocket
  "connect-src 'self' https://copilot-06s5.onrender.com wss:",
  
  // Framing: Only allow same origin
  "frame-ancestors 'self'",
  
  // Form submissions: Only to same origin
  "form-action 'self'",
  
  // Base URL resolution: Only same origin
  "base-uri 'self'"
].join('; ');

/**
 * Middleware function to apply CSP headers to all responses
 */
export function applyCspHeader(req: any, res: any, next: any) {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
  next();
}
