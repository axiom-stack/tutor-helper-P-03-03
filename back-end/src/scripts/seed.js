import bcrypt from "bcryptjs";
import { turso } from "../lib/turso.js";

const hash = await bcrypt.hash("admin", 10);
await turso.execute({
  sql: "DELETE FROM users WHERE username = ?",
  args: ["admin"],
});
await turso.execute({
  sql: "INSERT INTO users (username, password) VALUES (?, ?)",
  args: ["admin", hash],
});
console.log("Seeded user admin (password: admin)");
process.exit(0);