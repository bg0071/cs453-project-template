
# CS453/553 Client-Server Architecture Project

This repository contains the **starter template** for the semester project in  
**CS453 / CS553 – Client/Server Architectures**.

Students will build and extend a distributed web application over the course
of the semester. The system will evolve through several architectural stages,
mirroring the historical evolution of modern web systems.

The goal of the project is to help students understand **how real client/server
systems are designed and built**, including:

- REST API design
- database integration
- authentication and authorization
- multi-service architectures
- real-time communication
- modern API technologies

---

# Project Overview

The semester project is a **Task / Project Management System**.

The application allows users to:

- create projects
- create tasks within projects
- assign tasks to users
- track task status
- comment on tasks
- view project activity

This domain is intentionally simple so that the focus remains on **system
architecture and communication between components**, rather than complex
business logic.

---

# Architecture Overview

The system follows a typical web architecture.

```shell
Browser Client
|
v
REST API
|
v
PostgreSQL
```


Over the semester, the architecture will evolve to include additional
components such as authentication services, real-time communication,
and potentially additional APIs.

Example extended architecture:

```shell
Browser Client
|
v
API Layer
/
Auth API Task API
|
v
PostgreSQL
```

---

# Technology Stack

The default project stack is:

Server
- Node.js
- TypeScript
- Express

Database
- PostgreSQL

Development Tools
- Docker (for database)
- npm
- Git

Students who prefer Python may implement the server using **FastAPI**, but
all examples and starter code will use **TypeScript**.

---

# Repository Structure

```shell
cs453-project-template
│
├── apps
│ ├── api
│ │ Server-side application
│ │
│ └── client
│ Simple browser client
│
├── database
│ Database schema, migrations, and seed data
│
├── docs
│ Architecture documentation
│
├── scripts
│ Utility scripts for development
│
├── docker-compose.yml
│ Starts PostgreSQL database
│
└── README.md
```

---

# Development Setup

## 1. Clone the repository

```shell
git clone <your-repository-url>
cd cs453-project-template
```

## 2. Start the database

This project uses Docker to run PostgreSQL locally.

```shell
docker-compose up -d
```

This will start a PostgreSQL database container.

---

## 3. Install dependencies

```shell
cd apps/api
npm install
```

---

## 4. Run the server
```shell
npm run dev
```


The API server should start locally.

---

# Project Milestones

The project will evolve over several milestones during the semester.

### Milestone 1 – REST API

Students will implement:

- REST endpoints
- database integration
- CRUD operations
- request validation

---

### Milestone 2 – Authentication

Students will add:

- user accounts
- password hashing
- login endpoints
- JWT authentication
- protected routes

---

### Milestone 3 – Architectural Extensions

Students will extend the system with at least one of the following:

- WebSockets for real-time updates
- GraphQL API
- multi-service architecture
- asynchronous messaging
- advanced API documentation

Graduate students will complete an additional architecture extension and
design analysis.

---

# Learning Goals

By completing this project students should understand:

- how client/server systems communicate
- how APIs are designed and implemented
- how databases integrate with web services
- how authentication works in distributed systems
- how modern web architectures evolve over time

---

# Academic Integrity

All work submitted for this project must be your own.

Students may use documentation and external references, but copying code
from other students or online repositories is considered academic misconduct.

---

# License

This repository is provided for educational use in CS453/553.