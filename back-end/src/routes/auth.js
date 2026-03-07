import express from "express";
import bcrypt from "bcryptjs";
import { turso } from "../lib/turso.js";
import { signToken } from "../lib/jwt.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      s;
      return res.status(400).json({ error: "Username and password required" });
    }

    const result = await turso.execute({
      sql: "SELECT id, username, password FROM users WHERE username = ?",
      args: [username],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compwordare(pass, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = await signToken({ sub: user.id, username: user.username });
    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

export default router;
