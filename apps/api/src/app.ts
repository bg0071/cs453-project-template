import express, {
  NextFunction,
  Request,
  Response,
} from "express";

import { pool } from "./db/pool";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import taskRoutes from "./routes/taskRoutes";


export const app = express();

/*
 * Parse incoming JSON request bodies.
 */
app.use(express.json());

/*
 * Basic server health check.
 */
app.get(
  "/health",
  (_req: Request, res: Response) => {
    return res.status(200).json({
      status: "ok",
      service: "cs453-api",
    });
  },
);

/*
 * Verify that PostgreSQL can be reached.
 */
app.get(
  "/db-health",
  async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await pool.query(
        "SELECT NOW() AS current_time",
      );

      return res.status(200).json({
        status: "ok",
        database: "connected",
        currentTime: result.rows[0].current_time,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Registration and login endpoints begin with /auth.
 */
app.use("/auth", authRoutes);

/*
 * Authenticated project endpoints begin with /projects.
 */
app.use("/projects", projectRoutes);

/*
 * All task endpoints begin with /tasks.
 */
app.use("/tasks", taskRoutes);

/*
 * Handle routes that do not exist.
 */
app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    error: "Route not found",
  });
});

/*
 * Convert malformed JSON and unexpected errors into JSON responses.
 */
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const parseError = error as SyntaxError & {
      status?: number;
      type?: string;
    };

    if (
      parseError instanceof SyntaxError &&
      parseError.status === 400 &&
      parseError.type === "entity.parse.failed"
    ) {
      return res.status(400).json({
        error: "Invalid JSON body",
      });
    }

    console.error("Unhandled server error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  },
);
