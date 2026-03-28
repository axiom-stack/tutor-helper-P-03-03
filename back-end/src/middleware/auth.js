import { turso } from "../lib/turso.js";
import { verifyToken } from "../lib/jwt.js";

function isJwtVerificationError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const name = typeof error.name === "string" ? error.name : "";

  return (
    code.startsWith("ERR_JWT_") ||
    code.startsWith("ERR_JWS_") ||
    name === "JWTExpired" ||
    name === "JWTInvalid" ||
    name === "JWTClaimValidationFailed"
  );
}

export function createAuthenticateToken({
  verifyTokenFn = verifyToken,
  db = turso,
} = {}) {
  return async function authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

      if (!token) {
        return res
          .status(401)
          .json({ error: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى" });
      }

      const decoded = await verifyTokenFn(token);

      const userResult = await db.execute({
        sql: "SELECT id, username, display_name, role FROM Users WHERE id = ?",
        args: [decoded.sub],
      });

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: "المستخدم غير موجود" });
      }

      req.user = {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        display_name: userResult.rows[0].display_name,
        role: userResult.rows[0].role,
      };

      next();
    } catch (error) {
      req.log?.warn?.(
        { err: error?.message, code: error?.code, name: error?.name },
        "Auth middleware error",
      );

      if (isJwtVerificationError(error)) {
        return res
          .status(401)
          .json({ error: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى" });
      }

      return res
        .status(500)
        .json({ error: "حدث خطأ غير متوقع أثناء التحقق من جلسة العمل" });
    }
  };
}

export const authenticateToken = createAuthenticateToken();
