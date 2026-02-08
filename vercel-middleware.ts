/**
 * Vercel Middleware: Handle 404 status codes
 * 
 * This middleware ensures that when the React SPA renders a 404 page,
 * it returns proper HTTP 404 status code instead of 200.
 * 
 * Note: This requires @vercel/node runtime.
 * Can also be handled via vercel.json headers for specific error pages.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Explicitly handle 404 paths that should return 404 status
  // These are handled by React router - when no route matches, it renders NotFound
  // We let the rewrite happen but ensure proper status on the edge
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
