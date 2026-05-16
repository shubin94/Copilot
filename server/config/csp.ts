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
  
  // Scripts: Allow self, inline, eval (for Radix UI), GTM, Vercel Live, Cloudflare Insights, and payment scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com https://*.paypal.com https://www.googletagmanager.com https://vercel.live https://static.cloudflareinsights.com",

  // Inline event handlers: temporarily allowed to avoid script-src-attr='none' runtime blocking
  "script-src-attr 'unsafe-inline'",
  
  // Styles: Allow self, inline, and Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  
  // Style elements: Allow self, inline, and Google Fonts
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  
  // Fonts: Allow from self and Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com data:",
  
  // Images: Allow self, data URLs, HTTPS, and Supabase storage
  "img-src 'self' data: https: https://*.supabase.co",
  
  // API connections: Allow API origin plus analytics, payments, Supabase, Vercel Live, Cloudflare Insights, and WebSocket
  "connect-src 'self' https://www.askdetectives.com https://api.askdetectives.com https://*.supabase.co https://*.paypal.com https://www.google-analytics.com https://region1.google-analytics.com https://vercel.live https://cloudflareinsights.com https://static.cloudflareinsights.com wss:",
  
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
export function applyCspHeader(_req: any, res: any, next: any) {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
  next();
}
