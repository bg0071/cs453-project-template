import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const isTestEnvironment =
  process.env.NODE_ENV === "test";

/*
 * JWT_SECRET is required because the application cannot safely
 * create or verify authentication tokens without it.
 */
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    "JWT_SECRET must be defined in the root .env file",
  );
}

export const env = {
  port: Number(process.env.PORT || 3000),

  databaseUrl: isTestEnvironment
    ? process.env.TEST_DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/cs453_test"
    : process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/cs453",

  jwtSecret,

  jwtExpiresIn:
    process.env.JWT_EXPIRES_IN || "1h",
};