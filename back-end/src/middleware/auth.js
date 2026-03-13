import { turso } from "../lib/turso.js";
import { verifyToken } from "../lib/jwt.js";

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى" });
    }

    // Verify the JWT token
    const decoded = await verifyToken(token);

    // Get user details from database including role
    const userResult = await turso.execute({
      sql: "SELECT id, username, display_name, role FROM Users WHERE id = ?",
      args: [decoded.sub],
    });

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "المستخدم غير موجود" });
    }

    // Populate req.user with user data
    req.user = {
      id: userResult.rows[0].id,
      username: userResult.rows[0].username,
      display_name: userResult.rows[0].display_name,
      role: userResult.rows[0].role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(403).json({ error: "جلسة العمل غير صالحة أو منتهية" });
  }
}