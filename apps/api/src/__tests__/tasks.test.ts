import request from "supertest";

import { app } from "../app";
import { pool } from "../db/pool";

describe("Task API", () => {
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE TABLE tasks RESTART IDENTITY",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  test("GET /tasks returns a list", async () => {
    const response = await request(app).get("/tasks");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("POST /tasks creates a task", async () => {
    const response = await request(app)
      .post("/tasks")
      .send({
        title: "Create API tests",
        description: "Test task creation",
        status: "todo",
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(1);
    expect(response.body.title).toBe("Create API tests");
    expect(response.body.description).toBe(
      "Test task creation",
    );
    expect(response.body.status).toBe("todo");
  });

  test("POST /tasks rejects a missing title", async () => {
    const response = await request(app)
      .post("/tasks")
      .send({
        status: "todo",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Title is required",
    });
  });

  test("GET /tasks/:id returns one task", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({
        title: "Find this task",
      });

    const response = await request(app).get(
      `/tasks/${created.body.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.title).toBe("Find this task");
  });

  test("GET /tasks/:id returns 404 for a missing task", async () => {
    const response = await request(app).get(
      "/tasks/999999",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Task not found",
    });
  });

  test("PATCH /tasks/:id updates a task", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({
        title: "Task to update",
        status: "todo",
      });

    const response = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({
        status: "done",
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe(
      "Task to update",
    );
    expect(response.body.status).toBe("done");
  });

  test("DELETE /tasks/:id deletes a task", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({
        title: "Task to delete",
      });

    const deleteResponse = await request(app).delete(
      `/tasks/${created.body.id}`,
    );

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get(
      `/tasks/${created.body.id}`,
    );

    expect(getResponse.status).toBe(404);
  });

  test("DELETE /tasks/:id returns 404 for a missing task", async () => {
    const response = await request(app).delete(
      "/tasks/999999",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Task not found",
    });
  });

  test("invalid task IDs return 400", async () => {
    const response = await request(app).get(
      "/tasks/not-a-number",
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid task ID",
    });
  });
});
