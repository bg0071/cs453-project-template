import {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type {
  AuthTokenPayload,
} from "../services/authService";

/*
 * Check that an unknown decoded value contains the fields
 * expected in one of our authentication tokens.
 */
function isAuthTokenPayload(
  value: unknown,
): value is AuthTokenPayload {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  const validRole =
    candidate.role === "user" ||
    candidate.role === "admin";

  return (
    typeof candidate.userId === "number" &&
    Number.isInteger(candidate.userId) &&
    typeof candidate.email === "string" &&
    candidate.email.length > 0 &&
    validRole
  );
}

/*
 * Require a valid Bearer JWT.
 *
 * Successful verification places the authenticated user's
 * identity in req.user for later route handlers.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorizationHeader =
    req.get("Authorization");

  if (!authorizationHeader) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  /*
   * A valid header contains exactly:
   *
   * Authorization: Bearer <token>
   */
  const headerParts = authorizationHeader
    .trim()
    .split(/\s+/);

  if (
    headerParts.length !== 2 ||
    headerParts[0] !== "Bearer" ||
    headerParts[1].length === 0
  ) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = headerParts[1];

  try {
    const decodedToken = jwt.verify(
      token,
      env.jwtSecret,
    );

    if (!isAuthTokenPayload(decodedToken)) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    /*
     * Copy only the fields our application needs. Standard JWT
     * fields such as iat and exp do not need to be placed here.
     */
    req.user = {
      userId: decodedToken.userId,
      email: decodedToken.email,
      role: decodedToken.role,
    };

    return next();
  } catch {
    /*
     * This handles invalid signatures, malformed tokens, and
     * expired tokens without exposing internal JWT details.
     */
    return res.status(401).json({
      error: "Authentication required",
    });
  }
}