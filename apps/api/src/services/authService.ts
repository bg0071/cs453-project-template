import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";

import { env } from "../config/env";
import { pool } from "../db/pool";

export type UserRole = "user" | "admin";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date | string;
}

/*
 * This row includes the password hash and is used only
 * internally while checking login credentials.
 */
interface LoginUserRow extends UserRow {
  password_hash: string;
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

export interface LoginUserInput {
  email: string;
  password: string;
}

/*
 * This describes the information placed inside the JWT.
 *
 * Password information must never be placed in this object.
 */
export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
}

/*
 * Represents an attempted registration using an email
 * address that already belongs to another account.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "DuplicateEmailError";
  }
}

/*
 * Used for both an unknown email and an incorrect password.
 *
 * Returning the same error for both cases avoids revealing
 * whether a particular email address is registered.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

/*
 * Convert a database row into a user object that may safely
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
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
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
     * PostgreSQL error 23505 indicates a UNIQUE
     * constraint violation.
     */
    if (databaseError.code === "23505") {
      throw new DuplicateEmailError();
    }

    throw error;
  }
}

/*
 * Verify a user's credentials and return a signed JWT.
 */
export async function loginUser(
  input: LoginUserInput,
): Promise<string> {
  const normalizedEmail = input.email
    .trim()
    .toLowerCase();

  const result = await pool.query<LoginUserRow>(
    `
      SELECT
        id,
        name,
        email,
        password_hash,
        role,
        created_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizedEmail],
  );

  const user = result.rows[0];

  /*
   * Do not reveal whether the email address exists.
   */
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  /*
   * The TypeScript definitions restrict expiresIn to the
   * values accepted by jsonwebtoken.
   */
  const signOptions: SignOptions = {
    expiresIn:
      env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    env.jwtSecret,
    signOptions,
  );
}