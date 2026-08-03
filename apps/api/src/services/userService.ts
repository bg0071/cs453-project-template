import { pool } from "../db/pool";
import type {
  UserRole,
} from "./authService";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date | string;
}

export interface PublicUserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/*
 * Convert a PostgreSQL row into a safe public response.
 *
 * password_hash is deliberately not selected or returned.
 */
function toPublicUser(
  row: UserRow,
): PublicUserRecord {
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
 * Return every user account.
 *
 * This function must only be called from an
 * administrator-protected route.
 */
export async function listUsers(): Promise<
  PublicUserRecord[]
> {
  const result = await pool.query<UserRow>(
    `
      SELECT
        id,
        name,
        email,
        role,
        created_at
      FROM users
      ORDER BY id
    `,
  );

  return result.rows.map(toPublicUser);
}