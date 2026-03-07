import { turso } from "../lib/turso.js";
import { verifyToken } from "../lib/jwt.js";

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Verify the JWT token
    const decoded = await verifyToken(token);

    // Get user details from database including role
    const userResult = await turso.execute({
      sql: "SELECT id, username, role FROM users WHERE id = ?",
      args: [decoded.sub],
    });

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    // Populate req.user with user data
    req.user = {
      id: userResult.rows[0].id,
      username: userResult.rows[0].username,
      role: userResult.rows[0].role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}