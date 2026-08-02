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
  ProjectAccessDeniedError,
  ProjectNotFoundError,
} from "../services/projectService";
import {
  AssignedUserNotFoundError,
  type CreateTaskInput,
  createTaskForUser,
  deleteTaskForUser,
  getTaskForUser,
  listTasksForUser,
  TaskAccessDeniedError,
  TaskModificationDeniedError,
  TaskNotFoundError,
  type TaskStatus,
  type UpdateTaskInput,
  updateTaskForUser,
} from "../services/taskService";

const router = Router();

/*
 * All task routes require a valid JWT.
 */
router.use(authenticate);

function isObjectBody(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseTaskId(
  rawId: string | string[] | undefined,
): number | null {
  if (
    rawId === undefined ||
    Array.isArray(rawId)
  ) {
    return null;
  }

  const id = Number(rawId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function parsePositiveInteger(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

function isTaskStatus(
  value: unknown,
): value is TaskStatus {
  return (
    value === "todo" ||
    value === "in_progress" ||
    value === "done"
  );
}

/*
 * Convert expected service errors into their required
 * HTTP status codes.
 */
function handleTaskError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (
    error instanceof TaskNotFoundError ||
    error instanceof ProjectNotFoundError ||
    error instanceof AssignedUserNotFoundError
  ) {
    return res.status(404).json({
      error: error.message,
    });
  }

  if (
    error instanceof TaskAccessDeniedError ||
    error instanceof
      TaskModificationDeniedError ||
    error instanceof ProjectAccessDeniedError
  ) {
    return res.status(403).json({
      error: error.message,
    });
  }

  return next(error);
}

/*
 * GET /tasks
 *
 * Return tasks available to the authenticated user.
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
      const tasks = await listTasksForUser(
        req.user.userId,
        req.user.role,
      );

      /*
       * Preserve the Checkpoint 1 response shape: a bare array.
       */
      return res.status(200).json(tasks);
    } catch (error: unknown) {
      return next(error);
    }
  },
);

/*
 * POST /tasks
 *
 * Create a task in a project managed by the authenticated
 * user.
 */
router.post(
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

    if (!isObjectBody(req.body)) {
      return res.status(400).json({
        error:
          "Request body must be a JSON object",
      });
    }

    const {
      title,
      description,
      status,
      projectId,
      assignedTo,
    } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        error:
          "Description must be a string or null",
      });
    }

    if (
      status !== undefined &&
      !isTaskStatus(status)
    ) {
      return res.status(400).json({
        error:
          "Status must be todo, in_progress, or done",
      });
    }

    const normalizedProjectId =
      parsePositiveInteger(projectId);

    if (normalizedProjectId === null) {
      return res.status(400).json({
        error:
          "projectId must be a positive integer",
      });
    }

    let normalizedAssignedTo:
      | number
      | null
      | undefined;

    if (assignedTo === null) {
      normalizedAssignedTo = null;
    } else if (assignedTo !== undefined) {
      normalizedAssignedTo =
        parsePositiveInteger(assignedTo) ??
        undefined;

      if (
        normalizedAssignedTo === undefined
      ) {
        return res.status(400).json({
          error:
            "assignedTo must be a positive integer or null",
        });
      }
    }

    const input: CreateTaskInput = {
      title: title.trim(),
      projectId: normalizedProjectId,
    };

    if (description !== undefined) {
      input.description = description;
    }

    if (status !== undefined) {
      input.status = status;
    }

    if (assignedTo !== undefined) {
      input.assignedTo =
        normalizedAssignedTo ?? null;
    }

    try {
      const task = await createTaskForUser(
        input,
        req.user.userId,
        req.user.role,
      );

      return res.status(201).json(task);
    } catch (error: unknown) {
      return handleTaskError(
        error,
        res,
        next,
      );
    }
  },
);

/*
 * GET /tasks/:id
 *
 * Return one task if the authenticated user may view it.
 */
router.get(
  "/:id",
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

    const id = parseTaskId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    try {
      const task = await getTaskForUser(
        id,
        req.user.userId,
        req.user.role,
      );

      return res.status(200).json(task);
    } catch (error: unknown) {
      return handleTaskError(
        error,
        res,
        next,
      );
    }
  },
);

/*
 * PATCH /tasks/:id
 *
 * Only the project owner or an administrator may update
 * the task.
 */
router.patch(
  "/:id",
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

    const id = parseTaskId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    if (!isObjectBody(req.body)) {
      return res.status(400).json({
        error:
          "Request body must be a JSON object",
      });
    }

    const updates: UpdateTaskInput = {};

    if ("title" in req.body) {
      const title = req.body.title;

      if (
        typeof title !== "string" ||
        title.trim().length === 0
      ) {
        return res.status(400).json({
          error:
            "Title must be a non-empty string",
        });
      }

      updates.title = title.trim();
    }

    if ("description" in req.body) {
      const description =
        req.body.description;

      if (
        description !== null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          error:
            "Description must be a string or null",
        });
      }

      updates.description = description;
    }

    if ("status" in req.body) {
      const status = req.body.status;

      if (!isTaskStatus(status)) {
        return res.status(400).json({
          error:
            "Status must be todo, in_progress, or done",
        });
      }

      updates.status = status;
    }

    if ("assignedTo" in req.body) {
      const assignedTo =
        req.body.assignedTo;

      if (assignedTo === null) {
        updates.assignedTo = null;
      } else {
        const normalizedAssignedTo =
          parsePositiveInteger(assignedTo);

        if (
          normalizedAssignedTo === null
        ) {
          return res.status(400).json({
            error:
              "assignedTo must be a positive integer or null",
          });
        }

        updates.assignedTo =
          normalizedAssignedTo;
      }
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return res.status(400).json({
        error:
          "Provide at least one field: title, description, status, or assignedTo",
      });
    }

    try {
      const task = await updateTaskForUser(
        id,
        updates,
        req.user.userId,
        req.user.role,
      );

      return res.status(200).json(task);
    } catch (error: unknown) {
      return handleTaskError(
        error,
        res,
        next,
      );
    }
  },
);

/*
 * DELETE /tasks/:id
 *
 * Only the project owner or an administrator may delete
 * the task.
 */
router.delete(
  "/:id",
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

    const id = parseTaskId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    try {
      await deleteTaskForUser(
        id,
        req.user.userId,
        req.user.role,
      );

      return res.status(204).send();
    } catch (error: unknown) {
      return handleTaskError(
        error,
        res,
        next,
      );
    }
  },
);

export default router;