import jwt from "jsonwebtoken";
import request from "supertest";

import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";
import type {
  UserRole,
} from "../services/authService";

interface TestUser {
  id: number;
  email: string;
  role: UserRole;
}

const owner: TestUser = {
  id: 1,
  email: "owner@example.com",
  role: "user",
};

const otherUser: TestUser = {
  id: 2,
  email: "other@example.com",
  role: "user",
};

const admin: TestUser = {
  id: 3,
  email: "admin@example.com",
  role: "admin",
};

let ownerToken: string;
let otherToken: string;
let adminToken: string;

function createToken(
  user: TestUser,
): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: "1h",
    },
  );
}

async function insertTask(
  title: string,
  projectId: number,
  assignedTo: number | null = null,
): Promise<number> {
  const result = await pool.query<{
    id: number;
  }>(
    `
      INSERT INTO tasks (
        title,
        description,
        status,
        project_id,
        assigned_to
      )
      VALUES ($1, NULL, 'todo', $2, $3)
      RETURNING id
    `,
    [
      title,
      projectId,
      assignedTo,
    ],
  );

  return result.rows[0].id;
}

describe("Task API", () => {
  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        tasks,
        projects,
        users
      RESTART IDENTITY CASCADE
    `);

    /*
     * These hashes are placeholders because task tests do not
     * perform password login. The database only requires the
     * field to be non-null.
     */
    await pool.query(`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES
        (
          'Project Owner',
          'owner@example.com',
          'unused-test-hash',
          'user'
        ),
        (
          'Other User',
          'other@example.com',
          'unused-test-hash',
          'user'
        ),
        (
          'Administrator',
          'admin@example.com',
          'unused-test-hash',
          'admin'
        )
    `);

    await pool.query(`
      INSERT INTO projects (
        name,
        description,
        owner_id
      )
      VALUES
        (
          'Owner Project',
          'Owned by user one',
          1
        ),
        (
          'Other Project',
          'Owned by user two',
          2
        )
    `);

    ownerToken = createToken(owner);
    otherToken = createToken(otherUser);
    adminToken = createToken(admin);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("GET /tasks rejects a missing token", async () => {
    const response = await request(app)
      .get("/tasks");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });

  test("GET /tasks returns an empty list for a user with no tasks", async () => {
    const response = await request(app)
      .get("/tasks")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("POST /tasks creates a task in an owned project", async () => {
    const response = await request(app)
      .post("/tasks")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        title: "Create API tests",
        description: "Test task creation",
        status: "todo",
        projectId: 1,
        assignedTo: 2,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(1);
    expect(response.body.title).toBe(
      "Create API tests",
    );
    expect(response.body.description).toBe(
      "Test task creation",
    );
    expect(response.body.status).toBe(
      "todo",
    );
    expect(response.body.projectId).toBe(1);
    expect(response.body.assignedTo).toBe(2);
  });

  test("POST /tasks rejects a missing title", async () => {
    const response = await request(app)
      .post("/tasks")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        projectId: 1,
        status: "todo",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Title is required",
    });
  });

  test("POST /tasks returns 404 for a missing project", async () => {
    const response = await request(app)
      .post("/tasks")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        title: "Missing project",
        projectId: 999999,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Project not found",
    });
  });

  test("POST /tasks returns 403 for another user's project", async () => {
    const response = await request(app)
      .post("/tasks")
      .set(
        "Authorization",
        `Bearer ${otherToken}`,
      )
      .send({
        title: "Unauthorized task",
        projectId: 1,
      });

    expect(response.status).toBe(403);
  });

  test("GET /tasks returns owned and assigned tasks", async () => {
    await insertTask(
      "Owned task",
      1,
      null,
    );

    await insertTask(
      "Assigned task",
      2,
      1,
    );

    await insertTask(
      "Hidden task",
      2,
      null,
    );

    const response = await request(app)
      .get("/tasks")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);

    const titles = response.body.map(
      (task: { title: string }) =>
        task.title,
    );

    expect(titles).toEqual([
      "Owned task",
      "Assigned task",
    ]);
  });

  test("GET /tasks/:id returns an assigned task", async () => {
    const taskId = await insertTask(
      "Assigned task",
      2,
      1,
    );

    const response = await request(app)
      .get(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.title).toBe(
      "Assigned task",
    );
  });

  test("GET /tasks/:id returns 403 for an unrelated task", async () => {
    const taskId = await insertTask(
      "Private task",
      2,
      null,
    );

    const response = await request(app)
      .get(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(403);
  });

  test("GET /tasks/:id returns 404 for a missing task", async () => {
    const response = await request(app)
      .get("/tasks/999999")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Task not found",
    });
  });

  test("PATCH /tasks/:id updates an owned task", async () => {
    const taskId = await insertTask(
      "Task to update",
      1,
      null,
    );

    const response = await request(app)
      .patch(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        status: "done",
        assignedTo: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe(
      "Task to update",
    );
    expect(response.body.status).toBe(
      "done",
    );
    expect(response.body.assignedTo).toBe(2);
  });

  test("PATCH /tasks/:id rejects an assignee who does not own the project", async () => {
    const taskId = await insertTask(
      "Assigned but protected",
      1,
      2,
    );

    const response = await request(app)
      .patch(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${otherToken}`,
      )
      .send({
        status: "done",
      });

    expect(response.status).toBe(403);
  });

  test("DELETE /tasks/:id deletes an owned task", async () => {
    const taskId = await insertTask(
      "Task to delete",
      1,
      null,
    );

    const deleteResponse =
      await request(app)
        .delete(`/tasks/${taskId}`)
        .set(
          "Authorization",
          `Bearer ${ownerToken}`,
        );

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(getResponse.status).toBe(404);
  });

  test("an administrator can access another user's task", async () => {
    const taskId = await insertTask(
      "Administrative task",
      2,
      null,
    );

    const response = await request(app)
      .get(`/tasks/${taskId}`)
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.title).toBe(
      "Administrative task",
    );
  });

  test("invalid task IDs return 400", async () => {
    const response = await request(app)
      .get("/tasks/not-a-number")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid task ID",
    });
  });
});