import jwt from "jsonwebtoken";
import request from "supertest";

import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";

let userToken: string;
let adminToken: string;

describe("Administrator user API", () => {
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
          'Normal User',
          'user@example.com',
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

    userToken = jwt.sign(
      {
        userId: 1,
        email: "user@example.com",
        role: "user",
      },
      env.jwtSecret,
      {
        expiresIn: "1h",
      },
    );

    adminToken = jwt.sign(
      {
        userId: 2,
        email: "admin@example.com",
        role: "admin",
      },
      env.jwtSecret,
      {
        expiresIn: "1h",
      },
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  test("GET /users returns 401 without a token", async () => {
    const response = await request(app)
      .get("/users");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });

  test("GET /users returns 401 for an invalid token", async () => {
    const response = await request(app)
      .get("/users")
      .set(
        "Authorization",
        "Bearer invalid-token",
      );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });

  test("GET /users returns 403 for a normal user", async () => {
    const response = await request(app)
      .get("/users")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Administrator access required",
    });
  });

  test("GET /users returns users for an administrator", async () => {
    const response = await request(app)
      .get("/users")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(2);

    expect(response.body.users[0]).toMatchObject({
      id: 1,
      name: "Normal User",
      email: "user@example.com",
      role: "user",
    });

    expect(response.body.users[1]).toMatchObject({
      id: 2,
      name: "Administrator",
      email: "admin@example.com",
      role: "admin",
    });
  });

  test("GET /users does not return password hashes", async () => {
    const response = await request(app)
      .get("/users")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    expect(response.status).toBe(200);

    for (const user of response.body.users) {
      expect(user).not.toHaveProperty(
        "password",
      );

      expect(user).not.toHaveProperty(
        "password_hash",
      );

      expect(user).not.toHaveProperty(
        "passwordHash",
      );
    }
  });
});