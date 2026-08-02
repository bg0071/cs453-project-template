import { pool } from "../db/pool";
import type {
  UserRole,
} from "./authService";
import {
  ProjectAccessDeniedError,
  ProjectNotFoundError,
} from "./projectService";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "done";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  projectId: number;
  assignedTo: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskAccessRow extends Task {
  ownerId: number;
}

interface ProjectOwnerRow {
  owner_id: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  projectId: number;
  assignedTo?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assignedTo?: number | null;
}

export class TaskNotFoundError extends Error {
  constructor() {
    super("Task not found");
    this.name = "TaskNotFoundError";
  }
}

export class TaskAccessDeniedError extends Error {
  constructor() {
    super(
      "You do not have permission to access this task",
    );
    this.name = "TaskAccessDeniedError";
  }
}

export class TaskModificationDeniedError extends Error {
  constructor() {
    super(
      "You do not have permission to modify this task",
    );
    this.name = "TaskModificationDeniedError";
  }
}

export class AssignedUserNotFoundError extends Error {
  constructor() {
    super("Assigned user not found");
    this.name = "AssignedUserNotFoundError";
  }
}

const taskSelectColumns = `
  t.id,
  t.title,
  t.description,
  t.status,
  t.project_id AS "projectId",
  t.assigned_to AS "assignedTo",
  t.created_at AS "createdAt",
  t.updated_at AS "updatedAt"
`;

const taskReturningColumns = `
  id,
  title,
  description,
  status,
  project_id AS "projectId",
  assigned_to AS "assignedTo",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function removeOwnerInformation(
  row: TaskAccessRow,
): Task {
  const { ownerId: _ownerId, ...task } = row;
  return task;
}

/*
 * Verify that a project exists and that the authenticated
 * user is permitted to manage it.
 */
async function assertCanManageProject(
  projectId: number,
  userId: number,
  role: UserRole,
): Promise<void> {
  const result = await pool.query<ProjectOwnerRow>(
    `
      SELECT owner_id
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

  if (
    role !== "admin" &&
    project.owner_id !== userId
  ) {
    throw new ProjectAccessDeniedError();
  }
}

/*
 * Verify that an optional assignee exists.
 */
async function assertAssignedUserExists(
  assignedTo: number | null | undefined,
): Promise<void> {
  if (
    assignedTo === undefined ||
    assignedTo === null
  ) {
    return;
  }

  const result = await pool.query(
    `
      SELECT id
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [assignedTo],
  );

  if (result.rows.length === 0) {
    throw new AssignedUserNotFoundError();
  }
}

/*
 * Retrieve a task together with its project owner.
 *
 * ownerId is used only for permission checks and is not
 * returned as part of the public task response.
 */
async function getTaskAccessRow(
  taskId: number,
): Promise<TaskAccessRow> {
  const result = await pool.query<TaskAccessRow>(
    `
      SELECT
        ${taskSelectColumns},
        p.owner_id AS "ownerId"
      FROM tasks t
      JOIN projects p
        ON p.id = t.project_id
      WHERE t.id = $1
      LIMIT 1
    `,
    [taskId],
  );

  const task = result.rows[0];

  if (!task) {
    throw new TaskNotFoundError();
  }

  return task;
}

/*
 * Return tasks available to the authenticated user.
 *
 * Normal users see:
 *   1. Tasks in projects they own.
 *   2. Tasks assigned directly to them.
 *
 * Administrators see every task.
 */
export async function listTasksForUser(
  userId: number,
  role: UserRole,
): Promise<Task[]> {
  if (role === "admin") {
    const result = await pool.query<Task>(
      `
        SELECT ${taskSelectColumns}
        FROM tasks t
        ORDER BY t.id
      `,
    );

    return result.rows;
  }

  const result = await pool.query<Task>(
    `
      SELECT ${taskSelectColumns}
      FROM tasks t
      JOIN projects p
        ON p.id = t.project_id
      WHERE
        p.owner_id = $1
        OR t.assigned_to = $1
      ORDER BY t.id
    `,
    [userId],
  );

  return result.rows;
}

/*
 * Return one task if the authenticated user may view it.
 */
export async function getTaskForUser(
  taskId: number,
  userId: number,
  role: UserRole,
): Promise<Task> {
  const task = await getTaskAccessRow(taskId);

  const ownsProject =
    task.ownerId === userId;

  const isAssigned =
    task.assignedTo === userId;

  if (
    role !== "admin" &&
    !ownsProject &&
    !isAssigned
  ) {
    throw new TaskAccessDeniedError();
  }

  return removeOwnerInformation(task);
}

/*
 * Create a task in a project the authenticated user manages.
 */
export async function createTaskForUser(
  input: CreateTaskInput,
  userId: number,
  role: UserRole,
): Promise<Task> {
  await assertCanManageProject(
    input.projectId,
    userId,
    role,
  );

  await assertAssignedUserExists(
    input.assignedTo,
  );

  const result = await pool.query<Task>(
    `
      INSERT INTO tasks (
        title,
        description,
        status,
        project_id,
        assigned_to
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${taskReturningColumns}
    `,
    [
      input.title,
      input.description ?? null,
      input.status ?? "todo",
      input.projectId,
      input.assignedTo ?? null,
    ],
  );

  return result.rows[0];
}

/*
 * Update a task if the authenticated user owns its project
 * or is an administrator.
 *
 * Being assigned to a task grants view access, but not
 * permission to modify it.
 */
export async function updateTaskForUser(
  taskId: number,
  input: UpdateTaskInput,
  userId: number,
  role: UserRole,
): Promise<Task> {
  const existingTask =
    await getTaskAccessRow(taskId);

  const ownsProject =
    existingTask.ownerId === userId;

  if (
    role !== "admin" &&
    !ownsProject
  ) {
    throw new TaskModificationDeniedError();
  }

  await assertAssignedUserExists(
    input.assignedTo,
  );

  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    values.push(input.title);
    assignments.push(
      `title = $${values.length}`,
    );
  }

  if (input.description !== undefined) {
    values.push(input.description);
    assignments.push(
      `description = $${values.length}`,
    );
  }

  if (input.status !== undefined) {
    values.push(input.status);
    assignments.push(
      `status = $${values.length}`,
    );
  }

  if (input.assignedTo !== undefined) {
    values.push(input.assignedTo);
    assignments.push(
      `assigned_to = $${values.length}`,
    );
  }

  if (assignments.length === 0) {
    throw new Error(
      "No task fields were provided for update",
    );
  }

  assignments.push("updated_at = NOW()");

  values.push(taskId);
  const idParameter = `$${values.length}`;

  const result = await pool.query<Task>(
    `
      UPDATE tasks
      SET ${assignments.join(", ")}
      WHERE id = ${idParameter}
      RETURNING ${taskReturningColumns}
    `,
    values,
  );

  const updatedTask = result.rows[0];

  if (!updatedTask) {
    throw new TaskNotFoundError();
  }

  return updatedTask;
}

/*
 * Delete a task if the authenticated user owns its project
 * or is an administrator.
 */
export async function deleteTaskForUser(
  taskId: number,
  userId: number,
  role: UserRole,
): Promise<void> {
  const task = await getTaskAccessRow(taskId);

  const ownsProject =
    task.ownerId === userId;

  if (
    role !== "admin" &&
    !ownsProject
  ) {
    throw new TaskModificationDeniedError();
  }

  const result = await pool.query(
    `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING id
    `,
    [taskId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new TaskNotFoundError();
  }
}