import bcrypt from "bcryptjs";
import { turso } from "../lib/turso.js";

const hash = await bcrypt.hash("admin", 10);
await turso.execute({
  sql: "DELETE FROM Users WHERE username = ?",
  args: ["admin"],
});
await turso.execute({
  sql: "INSERT INTO Users (username, password, role) VALUES (?, ?, ?)",
  args: ["admin", hash, "admin"],
});
console.log("Seeded user admin (password: admin)");
process.exit(0);