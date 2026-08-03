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

async function insertProject(
  name: string,
  ownerId: number,
): Promise<number> {
  const result = await pool.query<{
    id: number;
  }>(
    `
      INSERT INTO projects (
        name,
        description,
        owner_id
      )
      VALUES ($1, NULL, $2)
      RETURNING id
    `,
    [name, ownerId],
  );

  return result.rows[0].id;
}

describe("Project API", () => {
  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        tasks,
        projects,
        users
      RESTART IDENTITY CASCADE
    `);

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

    ownerToken = createToken(owner);
    otherToken = createToken(otherUser);
    adminToken = createToken(admin);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("GET /projects rejects a missing token", async () => {
    const response = await request(app)
      .get("/projects");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });

  test("POST /projects rejects a missing token", async () => {
    const response = await request(app)
      .post("/projects")
      .send({
        name: "Unauthorized Project",
      });

    expect(response.status).toBe(401);
  });

  test("POST /projects creates a project owned by the authenticated user", async () => {
    const response = await request(app)
      .post("/projects")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        name: "Checkpoint 2",
        description:
          "Authentication and authorization",
        ownerId: 2,
      });

    expect(response.status).toBe(201);

    expect(response.body.project).toMatchObject({
      id: 1,
      name: "Checkpoint 2",
      description:
        "Authentication and authorization",
      ownerId: 1,
    });

    /*
     * The submitted ownerId must be ignored. Ownership comes
     * from the authenticated JWT.
     */
    expect(response.body.project.ownerId).not.toBe(
      2,
    );
  });

  test("POST /projects rejects a missing name", async () => {
    const response = await request(app)
      .post("/projects")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      )
      .send({
        description: "Missing project name",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Project name is required",
    });
  });

  test("GET /projects returns only projects owned by a normal user", async () => {
    await insertProject(
      "Owner Project",
      owner.id,
    );

    await insertProject(
      "Other Project",
      otherUser.id,
    );

    const response = await request(app)
      .get("/projects")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(1);

    expect(response.body.projects[0]).toMatchObject({
      name: "Owner Project",
      ownerId: owner.id,
    });
  });

  test("GET /projects/:id returns an owned project", async () => {
    const projectId = await insertProject(
      "Owned Project",
      owner.id,
    );

    const response = await request(app)
      .get(`/projects/${projectId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.project).toMatchObject({
      id: projectId,
      name: "Owned Project",
      ownerId: owner.id,
    });
  });

  test("GET /projects/:id returns 403 for another user's project", async () => {
    const projectId = await insertProject(
      "Private Project",
      otherUser.id,
    );

    const response = await request(app)
      .get(`/projects/${projectId}`)
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      error:
        "You do not have permission to access this project",
    });
  });

  test("GET /projects/:id returns 404 for a missing project", async () => {
    const response = await request(app)
      .get("/projects/999999")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "Project not found",
    });
  });

  test("GET /projects/:id rejects an invalid project ID", async () => {
    const response = await request(app)
      .get("/projects/not-a-number")
      .set(
        "Authorization",
        `Bearer ${ownerToken}`,
      );

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error:
        "Project ID must be a positive integer",
    });
  });

  test("an administrator can list every project", async () => {
    await insertProject(
      "Owner Project",
      owner.id,
    );

    await insertProject(
      "Other Project",
      otherUser.id,
    );

    const response = await request(app)
      .get("/projects")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(2);
  });

  test("an administrator can access another user's project", async () => {
    const projectId = await insertProject(
      "Other Project",
      otherUser.id,
    );

    const response = await request(app)
      .get(`/projects/${projectId}`)
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.project).toMatchObject({
      id: projectId,
      ownerId: otherUser.id,
    });
  });
});