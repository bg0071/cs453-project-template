import { pool } from "../db/pool";
import type {
  UserRole,
} from "./authService";

interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PublicProject {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  ownerId: number;
}

/*
 * The requested project does not exist.
 */
export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

/*
 * The project exists, but the authenticated user does not
 * have permission to access it.
 */
export class ProjectAccessDeniedError extends Error {
  constructor() {
    super(
      "You do not have permission to access this project",
    );
    this.name = "ProjectAccessDeniedError";
  }
}

/*
 * Convert PostgreSQL column names into the API's
 * camelCase response format.
 */
function toPublicProject(
  row: ProjectRow,
): PublicProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
    updatedAt: new Date(
      row.updated_at,
    ).toISOString(),
  };
}

/*
 * Create a project owned by the authenticated user.
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<PublicProject> {
  const result = await pool.query<ProjectRow>(
    `
      INSERT INTO projects (
        name,
        description,
        owner_id
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        description,
        owner_id,
        created_at,
        updated_at
    `,
    [
      input.name.trim(),
      input.description ?? null,
      input.ownerId,
    ],
  );

  return toPublicProject(result.rows[0]);
}

/*
 * Return the projects visible to the authenticated user.
 *
 * Normal users receive only projects they own.
 * Administrators receive every project.
 */
export async function listProjectsForUser(
  userId: number,
  role: UserRole,
): Promise<PublicProject[]> {
  if (role === "admin") {
    const result = await pool.query<ProjectRow>(
      `
        SELECT
          id,
          name,
          description,
          owner_id,
          created_at,
          updated_at
        FROM projects
        ORDER BY id
      `,
    );

    return result.rows.map(toPublicProject);
  }

  const result = await pool.query<ProjectRow>(
    `
      SELECT
        id,
        name,
        description,
        owner_id,
        created_at,
        updated_at
      FROM projects
      WHERE owner_id = $1
      ORDER BY id
    `,
    [userId],
  );

  return result.rows.map(toPublicProject);
}

/*
 * Return one project if the authenticated user is allowed
 * to access it.
 *
 * We first retrieve the project by ID so the API can
 * distinguish between 404 Not Found and 403 Forbidden.
 */
export async function getProjectForUser(
  projectId: number,
  userId: number,
  role: UserRole,
): Promise<PublicProject> {
  const result = await pool.query<ProjectRow>(
    `
      SELECT
        id,
        name,
        description,
        owner_id,
        created_at,
        updated_at
      FROM projects
      WHERE id = $1
      LIMIT 1
    `,
    [projectId],
  );

  const project = result.rows[0];

  if (!project) {
    throw new ProjectNotFoundError();
  }

  const ownsProject =
    project.owner_id === userId;

  if (role !== "admin" && !ownsProject) {
    throw new ProjectAccessDeniedError();
  }

  return toPublicProject(project);
}