import express from "express";
import bcrypt from "bcryptjs";
import { turso } from "../lib/turso.js";
import { signToken } from "../lib/jwt.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      req.log.warn(
        { username: !!username, password: !!password },
        "Missing login credentials",
      );
      return res.status(400).json({ error: "Username and password required" });
    }

    req.log.info({ username }, "Attempting login");

    const result = await turso.execute({
      sql: "SELECT id, username, password FROM users WHERE username = ?",
      args: [username],
    });

    if (result.rows.length === 0) {
      req.log.warn({ username }, "User not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    req.log.debug(
      { userId: user.id, username: user.username },
      "User found, checking password",
    );

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.log.warn({ userId: user.id, username }, "Invalid password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.log.info(
      { userId: user.id, username },
      "Login successful, generating token",
    );

    const token = await signToken({ sub: user.id, username: user.username });
    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    req.log.error(
      { err: err.message, stack: err.stack },
      "Login failed with error",
    );
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

export default router;
