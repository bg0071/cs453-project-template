import {
  NextFunction,
  Request,
  Response,
} from "express";

/*
 * Require the authenticated user to have the admin role.
 *
 * This middleware should normally run after authenticate.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Administrator access required",
    });
  }

  return next();
}