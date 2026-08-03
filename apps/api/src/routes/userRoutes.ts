import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import {
  authenticate,
} from "../middleware/authenticate";
import {
  requireAdmin,
} from "../middleware/requireAdmin";
import {
  listUsers,
} from "../services/userService";

const router = Router();

/*
 * Every users route requires authentication and the
 * administrator role.
 */
router.use(authenticate);
router.use(requireAdmin);

/*
 * GET /users
 *
 * Return all users without password hashes.
 */
router.get(
  "/",
  async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const users = await listUsers();

      return res.status(200).json({
        users,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },
);

export default router;