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
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      console.warn("[auth] Access attempt without session");
      res.status(401).json({ error: "Unauthorized - Please log in" });
      return;
    }

    // Check if user role is in allowed roles
    const userRole = req.session.userRole || "";
    const employeeAdminAllowed = (req as any).employeeAdminAllowed === true;

    if (!roles.includes(userRole) && !(employeeAdminAllowed && roles.includes("admin"))) {
      console.warn("[auth] Access denied - insufficient permissions", {
        userId: req.session.userId,
        userRole: userRole,
        requiredRoles: roles,
      });
      res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Middleware: require admin role specifically
 * More explicit than requireRole("admin")
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.userId) {
    console.warn("[auth] Admin access attempt without session");
    res.status(401).json({ error: "Unauthorized - Please log in" });
    return;
  }

  if (req.session.userRole !== "admin") {
    console.warn("[auth] Admin access denied - user not admin", {
      userId: req.session.userId,
      userRole: req.session.userRole,
    });
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }

  next();
}

