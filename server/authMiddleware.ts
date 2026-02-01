import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: require authenticated session.
 * 401 if no session userId.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized - Please log in" });
    return;
  }
  next();
}

/**
 * Middleware: require one of the given roles.
 * 401 if not authenticated, 403 if authenticated but role not in list.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Unauthorized - Please log in" });
      return;
    }
    if (!roles.includes(req.session.userRole || "")) {
      res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      return;
    }
    next();
  };
}
