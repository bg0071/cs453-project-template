/*
 * Remove the tables in dependency order.
 *
 * Tasks reference projects and users, while projects reference users.
 * Therefore, tasks must be removed first.
 *
 * WARNING: Running this schema deletes existing data.
 */
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

/*
 * Application users.
 *
 * Passwords are never stored directly. The password_hash column stores
 * the bcrypt result created during registration.
 */
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/*
 * Projects are owned by users.
 *
 * ON DELETE CASCADE means that deleting a user also deletes projects
 * owned by that user.
 */
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/*
 * Each task belongs to one project.
 *
 * A task may optionally be assigned to a user. If that user is deleted,
 * assigned_to becomes NULL rather than deleting the task.
 */
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
    project_id INTEGER NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    assigned_to INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/*
 * Index the foreign-key columns used frequently in joins and filters.
 */
CREATE INDEX idx_projects_owner_id
    ON projects(owner_id);

CREATE INDEX idx_tasks_project_id
    ON tasks(project_id);

CREATE INDEX idx_tasks_assigned_to
    ON tasks(assigned_to);