import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const isTestEnvironment = process.env.NODE_ENV === "test";

export const env = {
  port: Number(process.env.PORT || 3000),

  databaseUrl: isTestEnvironment
    ? process.env.TEST_DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/cs453_test"
    : process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/cs453",
};
