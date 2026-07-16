# CS453 Project Checkpoint 1 — Core API Structure

This repository contains a database-backed REST API for managing tasks. It was created for CS453 Project Checkpoint 1.

## Completed Milestones

* Milestone 1 — Basic Task API
* Milestone 2 — Full Task CRUD
* Milestone 3 — Database Integration

## Technology Stack

* Node.js
* TypeScript
* Express
* PostgreSQL
* Docker Compose
* Jest
* Supertest

## Project Structure

```text
apps/api/src/
├── app.ts
├── server.ts
├── config/
│   └── env.ts
├── db/
│   └── pool.ts
├── routes/
│   └── taskRoutes.ts
├── services/
│   └── taskService.ts
└── __tests__/
    └── tasks.test.ts

database/
└── schema.sql
```

## Requirements

Install the following before running the project:

* Node.js
* npm
* Docker Desktop
* Docker Compose
* Git

When using Windows, Docker Desktop should have WSL integration enabled for the Linux distribution being used.

## Installation

Clone the repository:

```bash
git clone https://github.com/bg0071/cs453-project-template.git
cd cs453-project-template
```

Install the root dependencies:

```bash
npm install
```

Install the API dependencies:

```bash
cd apps/api
npm install
cd ../..
```

## Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

The local environment should contain:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cs453
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cs453_test
PORT=3000
JWT_SECRET=changeme
```

The `.env` file should not be committed to Git.

## Start PostgreSQL

From the repository root, run:

```bash
docker compose up -d
```

Verify the container:

```bash
docker compose ps
```

## Create the Development Database Table

Apply the provided schema:

```bash
docker exec -i cs453-postgres \
  psql -U postgres -d cs453 \
  < database/schema.sql
```

## Create the Test Database

Create the separate test database:

```bash
docker exec cs453-postgres \
  psql -U postgres -d postgres \
  -c "CREATE DATABASE cs453_test;"
```

Apply the schema:

```bash
docker exec -i cs453-postgres \
  psql -U postgres -d cs453_test \
  < database/schema.sql
```

If `cs453_test` already exists, the database creation command may be skipped.

## Start the API

From the repository root:

```bash
npm run dev
```

The API runs at:

```text
http://localhost:3000
```

## Build the API

```bash
npm run build
```

## Run Automated Tests

Make sure PostgreSQL is running and that the test database has been created.

Then run:

```bash
npm test
```

The automated tests use the `cs453_test` database. The tasks table in that test database is cleared before each test.

## API Routes

| Method | Route        | Description                      | Success Status |
| ------ | ------------ | -------------------------------- | -------------: |
| GET    | `/health`    | Check whether the API is running |            200 |
| GET    | `/db-health` | Check the PostgreSQL connection  |            200 |
| GET    | `/tasks`     | Return all tasks                 |            200 |
| POST   | `/tasks`     | Create a task                    |            201 |
| GET    | `/tasks/:id` | Return one task                  |            200 |
| PATCH  | `/tasks/:id` | Update a task                    |            200 |
| DELETE | `/tasks/:id` | Delete a task                    |            204 |

## Task Format

A task may contain:

```json
{
  "id": 1,
  "title": "Create task API",
  "description": "Implement CRUD routes",
  "status": "todo",
  "createdAt": "2026-07-15T12:00:00.000Z",
  "updatedAt": "2026-07-15T12:00:00.000Z"
}
```

The `title` field is required when creating a task. The default status is `todo`.

## Example Requests

### Return all tasks

```bash
curl http://localhost:3000/tasks
```

### Create a task

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Create task API",
    "description": "Complete CRUD routes",
    "status": "todo"
  }'
```

### Return one task

```bash
curl http://localhost:3000/tasks/1
```

### Update a task

```bash
curl -X PATCH http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done"
  }'
```

### Delete a task

```bash
curl -X DELETE http://localhost:3000/tasks/1
```

## Error Responses

Errors are returned as JSON.

Example:

```json
{
  "error": "Task not found"
}
```

Common status codes include:

* `200 OK` for successful reads and updates
* `201 Created` after creating a task
* `204 No Content` after deleting a task
* `400 Bad Request` for invalid input
* `404 Not Found` for missing tasks or routes
* `500 Internal Server Error` for unexpected server or database errors

## Stop PostgreSQL

```bash
docker compose down
```

To also remove all database data:

```bash
docker compose down -v
```

The `-v` option permanently deletes the PostgreSQL volume and its stored data.
