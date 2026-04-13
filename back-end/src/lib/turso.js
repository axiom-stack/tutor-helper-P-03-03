import { createClient } from "@libsql/client";

function createUnavailableClient() {
  const error = new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set");

  return {
    async execute() {
      throw error;
    },
    async batch() {
      throw error;
    },
  };
}

let cachedClient = null;

function getTursoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    cachedClient = createUnavailableClient();
    return cachedClient;
  }

  cachedClient = createClient({
    url,
    authToken,
  });

  return cachedClient;
}

export const turso = {
  execute(query) {
    return getTursoClient().execute(query);
  },
  batch(statements, mode) {
    return getTursoClient().batch(statements, mode);
  },
};

// Ensure relational integrity checks run in SQLite/libSQL connections.
try {
  await turso.execute({ sql: "PRAGMA foreign_keys = ON" });
} catch {
  // Some test environments run without a reachable DB and mock at higher layers.
}
