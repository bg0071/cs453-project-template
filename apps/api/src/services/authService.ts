import bcrypt from "bcrypt";

import { pool } from "../db/pool";

export type UserRole = "user" | "admin";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date | string;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

/*
 * Represents an attempted registration with an email address
 * that already belongs to another account.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "DuplicateEmailError";
  }
}

/*
 * Convert a database row into the user object that may safely
 * be returned by the API.
 *
 * The password hash is intentionally not included.
 */
function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/*
 * Create a normal user account.
 *
 * The role is hard-coded to "user" so a client cannot create
 * an administrator account by including role: "admin".
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<PublicUser> {
  const normalizedName = input.name.trim();
  const normalizedEmail = input.email
    .trim()
    .toLowerCase();

  /*
   * A cost factor of 12 provides deliberate computational work
   * when hashing the password.
   */
  const passwordHash = await bcrypt.hash(
    input.password,
    12,
  );

  try {
    const result = await pool.query<UserRow>(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, 'user')
        RETURNING
          id,
          name,
          email,
          role,
          created_at
      `,
      [
        normalizedName,
        normalizedEmail,
        passwordHash,
      ],
    );

    return toPublicUser(result.rows[0]);
  } catch (error: unknown) {
    const databaseError = error as {
      code?: string;
    };

    /*
     * PostgreSQL error 23505 means a UNIQUE constraint was
     * violated. In this table, that normally means the email
     * address is already registered.
     */
    if (databaseError.code === "23505") {
      throw new DuplicateEmailError();
    }

    throw error;
  }
}