# CS453 Project Checkpoint 2 — Users, Authentication, and Access Control

This repository contains a database-backed REST API for managing users, projects, and tasks. It builds on Project Checkpoint 1 by adding user registration, password hashing, JSON Web Token authentication, protected routes, project ownership, task assignment, and role-based authorization.

## Completed Milestones

* Milestone 1 — Basic Task API
* Milestone 2 — Full Task CRUD
* Milestone 3 — Database Integration
* Milestone 4 — Expand the Data Model
* Milestone 5 — Authentication
* Milestone 6 — Authorization and Ownership

## Technology Stack

* Node.js
* TypeScript
* Express
* PostgreSQL
* Docker Compose
* bcrypt
* JSON Web Tokens
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
├── middleware/
│   ├── authenticate.ts
│   └── requireAdmin.ts
├── routes/
│   ├── authRoutes.ts
│   ├── projectRoutes.ts
│   ├── taskRoutes.ts
│   └── userRoutes.ts
├── services/
│   ├── authService.ts
│   ├── projectService.ts
│   ├── taskService.ts
│   └── userService.ts
├── types/
│   └── express.d.ts
└── __tests__/
    ├── auth.test.ts
    ├── projects.test.ts
    ├── tasks.test.ts
    └── users.test.ts

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

The root `.env` file should contain:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cs453
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cs453_test
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
```

A random development secret may be generated with:

```bash
openssl rand -hex 32
```

Copy the generated value into `JWT_SECRET`.

The real `.env` file must not be committed to GitHub. The repository includes `.env.example` to document the required variables without exposing real secrets.

## Start PostgreSQL

From the repository root, run:

```bash
docker compose up -d
```

Verify the PostgreSQL container:

```bash
docker compose ps
```

The Docker container is named:

```text
cs453-postgres
```

## Create or Update the Development Database

Apply the database schema:

```bash
docker exec -i cs453-postgres \
  psql -U postgres -d cs453 \
  < database/schema.sql
```

The schema recreates the `users`, `projects`, and `tasks` tables. Running it deletes existing application data.

## Create the Test Database

Create the separate test database:

```bash
docker exec cs453-postgres \
  psql -U postgres -d postgres \
  -c "CREATE DATABASE cs453_test;"
```

If `cs453_test` already exists, PostgreSQL may report that the database already exists. In that case, skip the creation command.

Apply the schema to the test database:

```bash
docker exec -i cs453-postgres \
  psql -U postgres -d cs453_test \
  < database/schema.sql
```

## Database Model

The application uses three related tables.

### Users

A user contains:

* `id`
* `name`
* `email`
* `password_hash`
* `role`
* `created_at`

The supported roles are:

```text
user
admin
```

Public registration always creates the account with the `user` role.

### Projects

A project contains:

* `id`
* `name`
* `description`
* `owner_id`
* `created_at`
* `updated_at`

`projects.owner_id` references `users.id`.

The authenticated user who creates a project automatically becomes its owner.

### Tasks

A task contains:

* `id`
* `title`
* `description`
* `status`
* `project_id`
* `assigned_to`
* `created_at`
* `updated_at`

`tasks.project_id` references `projects.id`.

`tasks.assigned_to` optionally references `users.id`.

Supported task statuses are:

```text
todo
in_progress
done
```

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

Run:

```bash
npm run build
```

A successful build compiles the TypeScript source without errors.

## Run Automated Tests

Make sure PostgreSQL is running and the `cs453_test` database has the current schema.

Then run:

```bash
npm test
```

The test suites use the separate `cs453_test` database and cover:

* User registration
* Password hashing
* Duplicate-email rejection
* User login
* JWT creation and verification
* Missing and invalid JWTs
* Protected task and project routes
* Project ownership
* Task ownership and assignment
* Administrator-only access
* `401`, `403`, and `404` behavior

## Authentication

### Register a User

Route:

```text
POST /auth/register
```

Example:

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": "example-password"
  }'
```

A successful request returns `201 Created` and a safe user object.

Passwords are hashed with bcrypt before being stored. Plain-text passwords and password hashes are never returned by the API.

A client cannot register itself as an administrator. A supplied property such as `"role": "admin"` is ignored, and the new account receives the `user` role.

### Log In

Route:

```text
POST /auth/login
```

Example:

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ada@example.com",
    "password": "example-password"
  }'
```

A successful login returns:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

The JWT contains:

* User ID
* Email address
* Role
* Issued-at time
* Expiration time

The JWT does not contain the password or password hash.

### Send an Authenticated Request

Protected routes require the Bearer authorization format:

```http
Authorization: Bearer <token>
```

Example:

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

A missing, invalid, malformed, or expired token returns:

```text
401 Unauthorized
```

## Create an Administrator Account

Public registration always creates a normal user. To create an administrator, first register the account normally:

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Administrator",
    "email": "admin@example.com",
    "password": "admin-password-123"
  }'
```

Promote the account through PostgreSQL:

```bash
docker exec cs453-postgres \
  psql -U postgres -d cs453 \
  -c "
    UPDATE users
    SET role = 'admin'
    WHERE email = 'admin@example.com';
  "
```

Verify the account:

```bash
docker exec cs453-postgres \
  psql -U postgres -d cs453 \
  -c "
    SELECT id, name, email, role
    FROM users
    ORDER BY id;
  "
```

After promoting an account, log in again to receive a new JWT containing the `admin` role. Tokens issued before the promotion still contain the previous `user` role.

## API Routes

### Public Routes

| Method | Route            | Description                      | Success |
| ------ | ---------------- | -------------------------------- | ------: |
| GET    | `/health`        | Check whether the API is running |     200 |
| GET    | `/db-health`     | Check the PostgreSQL connection  |     200 |
| POST   | `/auth/register` | Register a normal user           |     201 |
| POST   | `/auth/login`    | Log in and receive a JWT         |     200 |

### Authenticated Routes

| Method | Route           | Description                             | Success |
| ------ | --------------- | --------------------------------------- | ------: |
| GET    | `/auth/me`      | Return the authenticated token identity |     200 |
| GET    | `/projects`     | Return projects available to the user   |     200 |
| POST   | `/projects`     | Create a project                        |     201 |
| GET    | `/projects/:id` | Return one permitted project            |     200 |
| GET    | `/tasks`        | Return tasks available to the user      |     200 |
| POST   | `/tasks`        | Create a task in a permitted project    |     201 |
| GET    | `/tasks/:id`    | Return one permitted task               |     200 |
| PATCH  | `/tasks/:id`    | Update a permitted task                 |     200 |
| DELETE | `/tasks/:id`    | Delete a permitted task                 |     204 |

### Administrator-Only Routes

| Method | Route    | Description                  | Success |
| ------ | -------- | ---------------------------- | ------: |
| GET    | `/users` | Return all safe user records |     200 |

## Project Examples

### Create a Project

```bash
curl -i -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkpoint 2",
    "description": "Authentication and authorization work"
  }'
```

Example response:

```json
{
  "project": {
    "id": 1,
    "name": "Checkpoint 2",
    "description": "Authentication and authorization work",
    "ownerId": 1,
    "createdAt": "2026-08-02T20:00:00.000Z",
    "updatedAt": "2026-08-02T20:00:00.000Z"
  }
}
```

The API determines `ownerId` from the authenticated JWT. A client cannot choose another account as the project owner.

### List Projects

```bash
curl http://localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN"
```

A normal user receives only projects they own.

An administrator receives every project.

### Return One Project

```bash
curl http://localhost:3000/projects/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Task Examples

### Create a Task

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Finish Checkpoint 2",
    "description": "Complete documentation and testing",
    "status": "in_progress",
    "projectId": 1,
    "assignedTo": 1
  }'
```

Example task response:

```json
{
  "id": 1,
  "title": "Finish Checkpoint 2",
  "description": "Complete documentation and testing",
  "status": "in_progress",
  "projectId": 1,
  "assignedTo": 1,
  "createdAt": "2026-08-02T20:00:00.000Z",
  "updatedAt": "2026-08-02T20:00:00.000Z"
}
```

The `title` and `projectId` fields are required.

The project must exist, and a normal user may create a task only in a project they own.

### List Tasks

```bash
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN"
```

A normal user receives:

* Tasks in projects they own
* Tasks assigned directly to them

An administrator receives every task.

### Update a Task

```bash
curl -i -X PATCH http://localhost:3000/tasks/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done"
  }'
```

A project owner or administrator may update the task.

Being assigned to a task provides permission to view it, but it does not provide permission to update or delete it.

### Delete a Task

```bash
curl -i -X DELETE http://localhost:3000/tasks/1 \
  -H "Authorization: Bearer $TOKEN"
```

A successful deletion returns:

```text
204 No Content
```

## Administrator Route Example

```bash
curl http://localhost:3000/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

A normal user receives:

```text
403 Forbidden
```

An administrator receives safe user records containing:

* ID
* Name
* Email
* Role
* Creation time

Password hashes are not selected or returned.

## Authorization Rules

The application enforces the following rules:

1. Registration and login are public.
2. Project and task routes require a valid JWT.
3. A normal user can create projects.
4. The authenticated project creator becomes the owner.
5. A normal user can list and retrieve their own projects.
6. A normal user cannot access another user’s project.
7. A project owner can create tasks in that project.
8. A normal user can view tasks in projects they own.
9. A user can also view tasks assigned directly to them.
10. An assignee cannot update or delete a task unless they also own its project.
11. A project owner can update or delete tasks in the project.
12. An administrator can access and modify any project or task.
13. Only an administrator can access `GET /users`.

## Status Codes

The API distinguishes between the following cases:

| Status                      | Meaning                                                |
| --------------------------- | ------------------------------------------------------ |
| `200 OK`                    | Successful read, login, or update                      |
| `201 Created`               | User, project, or task created                         |
| `204 No Content`            | Task deleted                                           |
| `400 Bad Request`           | Invalid request data                                   |
| `401 Unauthorized`          | Missing, malformed, invalid, or expired authentication |
| `403 Forbidden`             | Authenticated user lacks permission                    |
| `404 Not Found`             | Requested user-controlled resource does not exist      |
| `409 Conflict`              | Duplicate email address                                |
| `500 Internal Server Error` | Unexpected server or database failure                  |

Errors are returned as JSON:

```json
{
  "error": "Authentication required"
}
```

## Separation of Concerns

The application separates responsibilities across several layers:

* Route files validate requests and return HTTP responses.
* Service files contain database operations and ownership logic.
* `authenticate.ts` verifies JWTs.
* `requireAdmin.ts` checks the administrator role.
* `pool.ts` manages the PostgreSQL connection.
* `env.ts` loads configuration from environment variables.
* `app.ts` mounts the routes and central error handling.
* `server.ts` starts the HTTP server.

Password hashing and JWT creation are centralized in `authService.ts` instead of being duplicated across routes.

## OpenAPI

The API contract is documented in:

```text
openapi.yaml
```

The specification documents:

* Public and protected routes
* Bearer JWT authentication
* Request bodies
* Path parameters
* User, project, and task schemas
* Success responses
* Common `400`, `401`, `403`, `404`, and `409` errors

Lint the specification with:

```bash
npx @redocly/cli lint openapi.yaml
```

## Stop PostgreSQL

Stop the container while preserving database data:

```bash
docker compose down
```

To remove the PostgreSQL volume and all stored database data:

```bash
docker compose down -v
```

The `-v` option permanently deletes the PostgreSQL volume.

## Reflection Answers

The reflection questions are answered in:

```text
answers.md
```
