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
