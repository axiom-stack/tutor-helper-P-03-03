# 11. AUTHENTICATION & SECURITY

## 11.1 Authentication Flow

### Login Process (JWT-Based)

```
User (Frontend)
    │
    ├─ 1. Enter credentials (email, password)
    ├─ 2. POST /api/auth/login { email, password }
    │
    │   Backend
    │   │
    │   ├─ 3. Validate input (email format, password length)
    │   ├─ 4. Query database: SELECT * FROM users WHERE email = ?
    │   │
    │   ├─ 5. Hash comparison: bcryptjs.compare(password, user.password_hash)
    │   │   ├─ If match: Continue
    │   │   └─ If no match: Return 401 "Invalid credentials"
    │   │
    │   ├─ 6. Generate JWT:
    │   │   ├─ Header: { alg: "HS256", typ: "JWT" }
    │   │   ├─ Payload: { sub: user_id, role: user_role, iat: now, exp: now+24h }
    │   │   ├─ Secret: process.env.JWT_SECRET (256-bit)
    │   │   └─ Token: Header.Payload.Signature
    │   │
    │   └─ 7. Return 200 { token, user: { id, name, email, role } }
    │
    ├─ 8. Store token: localStorage.setItem('auth_token', token)
    ├─ 9. Store user: context.setUser(user)
    └─ 10. Redirect: router.push('/')

Example JWT Payload:
{
  "sub": "42",
  "role": "teacher",
  "iat": 1705339200,
  "exp": 1705425600
}
```

### Token Usage in Requests

```
Every API Request:
    │
    ├─ Headers: {
    │   Authorization: "Bearer eyJhbGc..."
    │ }
    │
    ├─ Backend middleware (auth.js):
    │   ├─ Extract token from header
    │   ├─ Verify signature: jwtVerify(token, SECRET_KEY)
    │   │   ├─ If valid:
    │   │   │   ├─ Extract payload
    │   │   │   ├─ Check expiration
    │   │   │   ├─ Load user from DB
    │   │   │   └─ Set req.user = user
    │   │   │
    │   │   └─ If invalid/expired:
    │   │       └─ Return 401 "Invalid token"
    │   │
    │   └─ Pass to next handler
    │
    └─ Handler access: req.user.id, req.user.role
```

---

## 11.2 Password Security

### Password Hashing

```typescript
import bcryptjs from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10); // Cost factor: 10
  return bcryptjs.hash(password, salt);
}

export async function comparePasswords(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcryptjs.compare(plaintext, hash);
}

// Usage in login:
const passwordMatch = await comparePasswords(
  req.body.password,
  user.password_hash,
);
if (!passwordMatch) {
  return res.status(401).json({ error: "Invalid credentials" });
}
```

### Password Requirements

```
• Minimum 8 characters
• Must include:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 digit (0-9)
  - At least 1 special character (!@#$%^&*)

Examples:
✅ Correct123!
✅ TeacherPass2024
❌ password (no uppercase, no digits, no special)
❌ Pass1 (too short, no special)
```

---

## 11.3 Role-Based Access Control (RBAC)

### User Roles & Permissions

```typescript
enum UserRole {
  TEACHER = "teacher",
  ADMIN = "admin",
}

interface Permissions {
  [role: string]: {
    [resource: string]: string[]; // Array of allowed actions
  };
}

const rolePermissions: Permissions = {
  [UserRole.TEACHER]: {
    lesson_plans: ["create", "read", "update", "delete", "export"],
    assignments: ["create", "read", "update", "delete"],
    exams: ["create", "read", "update", "delete"],
    refinements: ["create", "read", "approve"],
    user_profile: ["read", "update"],
    dashboard: ["read"],
    curriculum: ["read", "export"],
    admin: [], // No admin access
  },

  [UserRole.ADMIN]: {
    lesson_plans: ["read", "delete", "audit"],
    assignments: ["read", "delete"],
    exams: ["read", "delete"],
    users: ["read", "update", "delete"],
    admin: ["read", "export_stats", "manage_teachers"],
    system: ["read", "configure"],
  },
};

export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string,
): boolean {
  return rolePermissions[userRole]?.[resource]?.includes(action) || false;
}
```

### Authorization Middleware

```typescript
export function authorize(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasPermission(req.user.role, resource, action)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `لا تملك صلاحيات للقيام بهذه العملية`,
      });
    }

    next();
  };
}

// Usage in routes:
router.delete(
  "/api/plans/:id",
  authenticateToken,
  authorize("lesson_plans", "delete"),
  deletePlanHandler,
);
```

---

## 11.4 Security Best Practices

### CORS Configuration

```typescript
import cors from "cors";

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:3000", // Dev only
      "https://yourdomain.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  }),
);
```

### Helmet for HTTP Header Security

```typescript
import helmet from "helmet";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.groq.com"], // Groq API
        fontSrc: ["'self'", "data:"],
      },
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }),
);
```

### Input Validation & Sanitization

```typescript
import { body, validationResult } from "express-validator";

const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email format"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must include uppercase")
    .matches(/[a-z]/)
    .withMessage("Password must include lowercase")
    .matches(/[0-9]/)
    .withMessage("Password must include digit"),
];

router.post("/api/auth/login", loginValidator, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Process valid request
});
```

### SQL Injection Prevention

```typescript
// ❌ VULNERABLE
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;

// ✅ SAFE (Parameterized queries)
const query = "SELECT * FROM users WHERE email = ?";
const user = await db.query(query, [req.body.email]);

// All database queries use parameterized queries
```

### Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/auth/login", loginLimiter, loginHandler);
```

### HTTPS Enforcement

```typescript
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    }
  }
  next();
});
```

---

## 11.5 Frontend Security

### Secure Token Storage

```typescript
// ❌ NOT SECURE (XSS vulnerable)
localStorage.setItem("token", token); // Accessible to JavaScript

// ✅ SECURE OPTIONS

// Option 1: HttpOnly Cookies (Recommended)
// Token sent by backend in Set-Cookie header
// Automatically included in requests, inaccessible to JS

// Option 2: Memory + Refresh Token
let accessToken = null; // In memory only

// Option 3: SessionStorage
sessionStorage.setItem("token", token); // Cleared on tab close
```

### XSS Protection

```typescript
// ❌ VULNERABLE
<div>{planTitle}</div> // If planTitle contains: <script>alert('xss')</script>

// ✅ SAFE (React auto-escapes)
<div>{planTitle}</div> // React escapes all values

// Manual escaping if needed
import DOMPurify from 'dompurify';
const safePlanTitle = DOMPurify.sanitize(planTitle);
```

### CSRF Protection

```typescript
// For forms/non-GET requests:
// 1. Backend generates CSRF token per session
// 2. Frontend includes in request headers
// 3. Backend validates token

import csrf from 'csurf';

app.use(csrf({ cookie: false }));

// In forms:
<input type="hidden" name="_csrf" value={csrfToken} />

// Headers middleware automatically includes it
```

---

## Summary

Security architecture:

- **JWT Authentication:** 24-hour tokens with HS256 signing
- **Password Hashing:** bcryptjs with cost factor 10
- **Role-Based Access:** Teacher vs. Admin permissions
- **CORS:** Whitelist allowed origins only
- **Helmet:** Security headers (CSP, HSTS, X-Frame-Options)
- **Input Validation:** Server-side validation on all inputs
- **SQL Injection:** Parameterized queries throughout
- **Rate Limiting:** Login endpoint protected
- **HTTPS:** Enforced in production
- **Token Storage:** HttpOnly cookies (recommended)

---

**Next:** Read **12_DESIGN_DECISIONS.md** for technology choices.
