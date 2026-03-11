import { createClient } from "@libsql/client";

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set");
}

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Ensure relational integrity checks run in SQLite/libSQL connections.
try {
  await turso.execute({ sql: "PRAGMA foreign_keys = ON" });
} catch {
  // Some test environments run without a reachable DB and mock at higher layers.
}
