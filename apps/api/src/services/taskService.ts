import { pool } from "../db/pool";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
}

const taskColumns = `
  id,
  title,
  description,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function getAllTasks(): Promise<Task[]> {
  const result = await pool.query<Task>(`
    SELECT ${taskColumns}
    FROM tasks
    ORDER BY id
  `);

  return result.rows;
}

export async function getTaskById(id: number): Promise<Task | null> {
  const result = await pool.query<Task>(
    `
      SELECT ${taskColumns}
      FROM tasks
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createTask(
  input: CreateTaskInput,
): Promise<Task> {
  const result = await pool.query<Task>(
    `
      INSERT INTO tasks (title, description, status)
      VALUES ($1, $2, $3)
      RETURNING ${taskColumns}
    `,
    [
      input.title,
      input.description ?? null,
      input.status ?? "todo",
    ],
  );

  return result.rows[0];
}

export async function updateTask(
  id: number,
  input: UpdateTaskInput,
): Promise<Task | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    values.push(input.title);
    assignments.push(`title = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    assignments.push(`description = $${values.length}`);
  }

  if (input.status !== undefined) {
    values.push(input.status);
    assignments.push(`status = $${values.length}`);
  }

  if (assignments.length === 0) {
    throw new Error("No task fields were provided for update");
  }

  assignments.push("updated_at = NOW()");

  values.push(id);
  const idParameter = `$${values.length}`;

  const result = await pool.query<Task>(
    `
      UPDATE tasks
      SET ${assignments.join(", ")}
      WHERE id = ${idParameter}
      RETURNING ${taskColumns}
    `,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteTask(id: number): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}
