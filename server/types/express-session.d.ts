import "express-session";

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    userId?: string;
    userRole?: string;
    userName?: string;
    userEmail?: string;
    csrfToken?: string;
    csrfTokenGeneratedAt?: number;
    oauthState?: string;
    oauthStateGeneratedAt?: number;
    oauthIntent?: string;
  }
}
