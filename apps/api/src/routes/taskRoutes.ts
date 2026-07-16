import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import {
  CreateTaskInput,
  UpdateTaskInput,
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  updateTask,
} from "../services/taskService";

const router = Router();

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
  if (rawId === undefined || Array.isArray(rawId)) {
    return null;
  }

  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

/*
 * GET /tasks
 * Return all tasks.
 */
router.get(
  "/",
  async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const tasks = await getAllTasks();
      return res.status(200).json(tasks);
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * POST /tasks
 * Create a new task.
 */
router.post(
  "/",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!isObjectBody(req.body)) {
        return res.status(400).json({
          error: "Request body must be a JSON object",
        });
      }

      const { title, description, status } = req.body;

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
          error: "Description must be a string or null",
        });
      }

      if (
        status !== undefined &&
        (typeof status !== "string" ||
          status.trim().length === 0)
      ) {
        return res.status(400).json({
          error: "Status must be a non-empty string",
        });
      }

      const input: CreateTaskInput = {
        title: title.trim(),
      };

      if (description !== undefined) {
        input.description = description;
      }

      if (typeof status === "string") {
        input.status = status.trim();
      }

      const task = await createTask(input);

      return res.status(201).json(task);
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * GET /tasks/:id
 * Return one task by ID.
 */
router.get(
  "/:id",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = parseTaskId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          error: "Invalid task ID",
        });
      }

      const task = await getTaskById(id);

      if (task === null) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      return res.status(200).json(task);
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * PATCH /tasks/:id
 * Update one or more task fields.
 */
router.patch(
  "/:id",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = parseTaskId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          error: "Invalid task ID",
        });
      }

      if (!isObjectBody(req.body)) {
        return res.status(400).json({
          error: "Request body must be a JSON object",
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
            error: "Title must be a non-empty string",
          });
        }

        updates.title = title.trim();
      }

      if ("description" in req.body) {
        const description = req.body.description;

        if (
          description !== null &&
          typeof description !== "string"
        ) {
          return res.status(400).json({
            error: "Description must be a string or null",
          });
        }

        updates.description = description;
      }

      if ("status" in req.body) {
        const status = req.body.status;

        if (
          typeof status !== "string" ||
          status.trim().length === 0
        ) {
          return res.status(400).json({
            error: "Status must be a non-empty string",
          });
        }

        updates.status = status.trim();
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error:
            "Provide at least one field: title, description, or status",
        });
      }

      const task = await updateTask(id, updates);

      if (task === null) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      return res.status(200).json(task);
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * DELETE /tasks/:id
 * Delete a task.
 */
router.delete(
  "/:id",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = parseTaskId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          error: "Invalid task ID",
        });
      }

      const wasDeleted = await deleteTask(id);

      if (!wasDeleted) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
