import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import {
  DuplicateEmailError,
  InvalidCredentialsError,
  loginUser,
  registerUser,
} from "../services/authService";

const router = Router();

interface RegisterRequestBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

interface LoginRequestBody {
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

/*
 * POST /auth/login
 *
 * Verify a registered user's credentials and return a JWT.
 */
router.post(
  "/login",
  async (
    req: Request<
      Record<string, never>,
      unknown,
      LoginRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const trimmedEmail = email.trim();

    if (
      trimmedEmail.length === 0 ||
      password.length === 0
    ) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    try {
      const token = await loginUser({
        email: trimmedEmail,
        password,
      });

      return res.status(200).json({
        token,
      });
    } catch (error: unknown) {
      if (
        error instanceof InvalidCredentialsError
      ) {
        return res.status(401).json({
          error: error.message,
        });
      }

      return next(error);
    }
  },
);

export default router;