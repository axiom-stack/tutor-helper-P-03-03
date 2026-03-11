import { turso } from "../lib/turso.js";
import { signToken } from "../lib/jwt.js";
import { verifyPassword } from "../utils/utils.js";
import { createUsersRepository } from "../users/repositories/users.repository.js";

export async function login(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      req.log.warn(
        { username: !!username, password: !!password },
        "Missing login credentials",
      );
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    // Validation - we ensure that the password and username are of proper length
    if (typeof username !== "string" || username.length < 4) {
      req.log.warn({ username }, "Username too short");
      return res
        .status(400)
        .json({ error: "اسم المستخدم يجب أن يكون 4 أحرف على الأقل" });
    }

    if (typeof password !== "string" || password.length < 6) {
      req.log.warn("Password too short");
      return res
        .status(400)
        .json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }

    req.log.info({ username }, "Attempting login");

    const result = await turso.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });

    console.log(result.rows);

    if (result.rows.length === 0) {
      req.log.warn({ username }, "User not found");
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    const user = result.rows[0];
    req.log.debug(
      { userId: user.id, username: user.username },
      "User found, checking password",
    );

    const match = await verifyPassword(password, user.password);

    console.log(match);
    if (!match) {
      req.log.warn({ userId: user.id, username }, "Invalid password");
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    req.log.info(
      { userId: user.id, username },
      "Login successful, generating token",
    );

    const usersRepository = createUsersRepository();
    await usersRepository.ensureProfile(user.id);
    const profile = await usersRepository.getProfileByUserId(user.id);

    const token = await signToken({ sub: user.id, username: user.username });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        userRole: user.role,
        createdAt: user.created_at,
        profile: profile ?? undefined,
      },
    });
  } catch (err) {
    req.log.error(
      { err: err.message, stack: err.stack },
      "Login failed with error",
    );
    res.status(500).json({ error: "فشل تسجيل الدخول" });
  }
}

export async function logout(req, res) {
  res.json({ ok: true });
}
