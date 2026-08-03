# Project Checkpoint 1 Reflection Answers

## 1. What is the difference between an in-memory API and a database-backed API?

An in-memory API stores its data in variables or data structures inside the running server process. The data is temporary and is normally lost when the server stops or restarts. It can also be difficult to share the same in-memory data between multiple server processes.

A database-backed API stores its data in an external database such as PostgreSQL. The data remains available after the API restarts and can be queried, updated, and protected using database features. This checkpoint uses PostgreSQL so that created tasks persist independently of the Express server process.

## 2. Why is it useful to separate routes, services, and database logic?

Separating the application into routes, services, and database modules gives each part a specific responsibility.

The routes handle HTTP concerns such as request parameters, validation, status codes, and JSON responses. The service handles task-related database operations and SQL queries. The database module creates and exports the PostgreSQL connection pool.

This separation makes the code easier to understand, test, debug, and extend. For example, a database query can be changed in the task service without placing additional SQL code inside the route handlers or main server file.

## 3. What HTTP status codes did you use, and why?

The API uses the following status codes:

* `200 OK` when tasks are successfully returned or updated.
* `201 Created` when a new task is successfully created.
* `204 No Content` when a task is successfully deleted.
* `400 Bad Request` when input is invalid, such as a missing title, an invalid task ID, an empty update, or malformed JSON.
* `404 Not Found` when a requested task or API route does not exist.
* `500 Internal Server Error` when an unexpected server or database error occurs.

These status codes allow clients to determine whether a request succeeded and, when it failed, what general type of problem occurred.

## 4. What happens when a client requests a task ID that does not exist?

The service queries PostgreSQL for the requested ID. If PostgreSQL returns no matching row, the service returns `null` to the route handler. The route handler then returns HTTP status `404 Not Found` with the following JSON response:

```json
{
  "error": "Task not found"
}
```

The server continues running and can process later requests.

## 5. What was the hardest part of connecting the API to PostgreSQL?

The most difficult part was making sure every part of the database configuration matched. Docker needed to be running, WSL needed permission to access Docker, the PostgreSQL container needed the correct database name and credentials, the connection string in `.env` needed to match those settings, and `schema.sql` needed to be applied before the API could query the tasks table.

Separating the normal development database from the automated test database also required the environment configuration to select the correct connection string when the tests run.

# Project Checkpoint 2 — Reflection Answers

## 1. What is the difference between authentication and authorization?

Authentication determines who a user is. In this application, a user authenticates by logging in with an email address and password. After the credentials are verified, the server returns a signed JSON Web Token that identifies the user.

Authorization determines what an authenticated user is allowed to do. After the JWT has been verified, the application checks the user’s role and ownership relationships. For example, a normal user cannot access `GET /users` and cannot modify a task in another user’s project, while an administrator can access or modify any project or task.

## 2. Why should passwords be hashed instead of stored directly?

Passwords should be hashed so the original password is not stored in the database. If plain-text passwords were stored and the database were exposed, every user password would be immediately readable.

This application uses bcrypt to create a one-way password hash during registration. During login, bcrypt compares the submitted password with the stored hash. The application does not need to decrypt or recover the original password. Passwords and password hashes are also excluded from API responses and JWT payloads.

## 3. What information did you include in your JWT, and why?

The JWT contains the user ID, email address, and role. It also receives the standard issued-at and expiration fields when the token is signed.

The user ID identifies the authenticated database user and is used for project ownership and task permission checks. The email helps identify the account represented by the token. The role is used to determine whether the user is a normal user or an administrator.

The JWT does not contain the password or password hash because those values are not needed for authorization and should not be exposed to clients.

## 4. What is the difference between a 401 response and a 403 response?

A `401 Unauthorized` response means the request is not successfully authenticated. The token may be missing, malformed, invalid, or expired.

A `403 Forbidden` response means the user is authenticated, but the user does not have permission to perform the requested operation. For example, a normal user receives `403` when requesting the administrator-only `/users` route or attempting to modify a task owned through another user’s project.

## 5. Where does your application perform role or ownership checks?

JWT authentication is performed in `middleware/authenticate.ts`. This middleware reads the Bearer token, verifies its signature, validates the payload, and places the authenticated identity in `req.user`.

Administrator role checking is performed in `middleware/requireAdmin.ts`. The `/users` router uses this middleware to reject normal users.

Project ownership checks are performed in `services/projectService.ts`. That service determines whether the authenticated user owns the requested project or has the administrator role.

Task ownership and permission checks are performed in `services/taskService.ts`. A normal user may manage tasks in a project they own. A user assigned to a task may view the task, but assignment alone does not provide permission to update or delete it. Administrators are permitted to access and modify all tasks.

## 6. How are users, projects, and tasks related in your database?

A user may own multiple projects. The `projects.owner_id` foreign key references `users.id`.

A project may contain multiple tasks. The `tasks.project_id` foreign key references `projects.id`.

A task may optionally be assigned to a user. The `tasks.assigned_to` foreign key also references `users.id`.

Deleting a project deletes the tasks that belong to that project. Deleting a user removes projects owned by that user. If an assigned user is deleted, the task remains, but its `assigned_to` value becomes `NULL`.

## 7. What was the hardest part of adding authentication or authorization?

The hardest part was preserving the distinction between authentication, authorization, and resource existence while updating the original task API.

The application needed to return `401` when no valid token was supplied, `403` when an authenticated user lacked permission, and `404` when a resource did not exist. To handle this correctly, the services first retrieve the resource and then perform the ownership or role check.

It was also challenging to update the original task CRUD operations so that every task belongs to a valid project while maintaining the existing response format and automated tests. The task tests now create users, projects, JWTs, and foreign-key relationships before testing the task routes.
