import bcrypt from "bcrypt";
import jwt, {
  type JwtPayload,
} from "jsonwebtoken";
import request from "supertest";

import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";

describe("Authentication API", () => {
  beforeEach(async () => {
    /*
     * Clear dependent tables first and restart all generated IDs.
     */
    await pool.query(`
      TRUNCATE TABLE
        tasks,
        projects,
        users
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("POST /auth/register creates a normal user with a hashed password", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "example-password",
        role: "admin",
      });

    expect(response.status).toBe(201);

    expect(response.body.user).toMatchObject({
      id: 1,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "user",
    });

    /*
     * Public responses must never expose password information.
     */
    expect(response.body.user).not.toHaveProperty(
      "password",
    );

    expect(response.body.user).not.toHaveProperty(
      "password_hash",
    );

    expect(response.body.user).not.toHaveProperty(
      "passwordHash",
    );

    const result = await pool.query<{
      password_hash: string;
      role: string;
    }>(
      `
        SELECT
          password_hash,
          role
        FROM users
        WHERE email = $1
      `,
      ["ada@example.com"],
    );

    expect(result.rows).toHaveLength(1);

    const storedUser = result.rows[0];

    /*
     * The client attempted to register as an administrator,
     * but registration must always create a normal user.
     */
    expect(storedUser.role).toBe("user");

    expect(storedUser.password_hash).not.toBe(
      "example-password",
    );

    const passwordMatches = await bcrypt.compare(
      "example-password",
      storedUser.password_hash,
    );

    expect(passwordMatches).toBe(true);
  });

  test("POST /auth/register normalizes email addresses", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Grace Hopper",
        email: "  GRACE@EXAMPLE.COM  ",
        password: "example-password",
      });

    expect(response.status).toBe(201);

    expect(response.body.user.email).toBe(
      "grace@example.com",
    );
  });

  test("POST /auth/register rejects a duplicate email", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "First User",
        email: "duplicate@example.com",
        password: "example-password",
      });

    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Second User",
        email: "duplicate@example.com",
        password: "different-password",
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error:
        "An account with that email already exists",
    });
  });

  test("POST /auth/register rejects missing required fields", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Incomplete User",
        email: "incomplete@example.com",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error:
        "Name, email, and password are required",
    });
  });

  test("POST /auth/register rejects a short password", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Short Password",
        email: "short@example.com",
        password: "short",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error:
        "Password must contain at least 8 characters",
    });
  });

  test("POST /auth/login returns a valid JWT", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Login User",
        email: "login@example.com",
        password: "example-password",
      });

    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "login@example.com",
        password: "example-password",
      });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe(
      "string",
    );

    const decoded = jwt.verify(
      response.body.token,
      env.jwtSecret,
    ) as JwtPayload;

    expect(decoded).toMatchObject({
      userId: 1,
      email: "login@example.com",
      role: "user",
    });

    expect(decoded).not.toHaveProperty(
      "password",
    );

    expect(decoded).not.toHaveProperty(
      "password_hash",
    );

    expect(decoded).not.toHaveProperty(
      "passwordHash",
    );

    expect(typeof decoded.iat).toBe("number");
    expect(typeof decoded.exp).toBe("number");
  });

  test("POST /auth/login accepts normalized email capitalization", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Case User",
        email: "case@example.com",
        password: "example-password",
      });

    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "CASE@EXAMPLE.COM",
        password: "example-password",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "token",
    );
  });

  test("POST /auth/login rejects an incorrect password", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Password User",
        email: "password@example.com",
        password: "correct-password",
      });

    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "password@example.com",
        password: "incorrect-password",
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: "Invalid email or password",
    });
  });

  test("POST /auth/login rejects an unknown email", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "unknown@example.com",
        password: "example-password",
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: "Invalid email or password",
    });
  });

  test("GET /auth/me rejects a missing token", async () => {
    const response = await request(app)
      .get("/auth/me");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });

  test("GET /auth/me accepts a valid token", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Protected User",
        email: "protected@example.com",
        password: "example-password",
      });

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "protected@example.com",
        password: "example-password",
      });

    const response = await request(app)
      .get("/auth/me")
      .set(
        "Authorization",
        `Bearer ${loginResponse.body.token}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.user).toEqual({
      userId: 1,
      email: "protected@example.com",
      role: "user",
    });
  });

  test("GET /auth/me rejects an invalid token", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set(
        "Authorization",
        "Bearer invalid-token",
      );

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: "Authentication required",
    });
  });
});