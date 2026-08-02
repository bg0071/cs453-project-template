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
  createProject,
  getProjectForUser,
  listProjectsForUser,
  ProjectAccessDeniedError,
  ProjectNotFoundError,
} from "../services/projectService";

const router = Router();

interface CreateProjectRequestBody {
  name?: unknown;
  description?: unknown;
}

/*
 * Every project route requires authentication.
 */
router.use(authenticate);

/*
 * GET /projects
 *
 * Return the projects available to the authenticated user.
 */
router.get(
  "/",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    try {
      const projects =
        await listProjectsForUser(
          req.user.userId,
          req.user.role,
        );

      return res.status(200).json({
        projects,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },
);

/*
 * POST /projects
 *
 * Create a project owned by the authenticated user.
 */
router.post(
  "/",
  async (
    req: Request<
      Record<string, never>,
      unknown,
      CreateProjectRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const { name, description } = req.body;

    if (
      typeof name !== "string" ||
      name.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Project name is required",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        error:
          "Project description must be a string",
      });
    }

    const normalizedDescription =
      typeof description === "string" &&
      description.trim().length > 0
        ? description.trim()
        : null;

    try {
      const project = await createProject({
        name: name.trim(),
        description: normalizedDescription,
        ownerId: req.user.userId,
      });

      return res.status(201).json({
        project,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },
);

/*
 * GET /projects/:id
 *
 * Return one project if it exists and the user is allowed
 * to access it.
 */
router.get(
  "/:id",
  async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const projectId = Number(req.params.id);

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        error: "Project ID must be a positive integer",
      });
    }

    try {
      const project = await getProjectForUser(
        projectId,
        req.user.userId,
        req.user.role,
      );

      return res.status(200).json({
        project,
      });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (
        error instanceof
        ProjectAccessDeniedError
      ) {
        return res.status(403).json({
          error: error.message,
        });
      }

      return next(error);
    }
  },
);

export default router;