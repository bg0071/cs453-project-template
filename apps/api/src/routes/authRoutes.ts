import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import {
  DuplicateEmailError,
  registerUser,
} from "../services/authService";

const router = Router();

interface RegisterRequestBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

/*
 * POST /auth/register
 *
 * Create a new normal user account.
 */
router.post(
  "/register",
  async (
    req: Request<
      Record<string, never>,
      unknown,
      RegisterRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { name, email, password } = req.body;

    /*
     * Verify that all required values are strings.
     */
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        error:
          "Name, email, and password are required",
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (
      trimmedName.length === 0 ||
      trimmedEmail.length === 0 ||
      password.length === 0
    ) {
      return res.status(400).json({
        error:
          "Name, email, and password are required",
      });
    }

    /*
     * This is intentionally a basic email-format check.
     * PostgreSQL still enforces uniqueness separately.
     */
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      return res.status(400).json({
        error: "A valid email address is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          "Password must contain at least 8 characters",
      });
    }

    try {
      const user = await registerUser({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      return res.status(201).json({
        user,
      });
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError) {
        return res.status(409).json({
          error: error.message,
        });
      }

      return next(error);
    }
  },
);

export default router;