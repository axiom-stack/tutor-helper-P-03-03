import test from "node:test";
import assert from "node:assert/strict";

import { createAuthenticateToken } from "../src/middleware/auth.js";

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("authenticateToken returns 401 for expired JWTs", async () => {
  let dbCalled = false;
  const middleware = createAuthenticateToken({
    verifyTokenFn: async () => {
      const error = new Error("expired");
      error.code = "ERR_JWT_EXPIRED";
      error.name = "JWTExpired";
      throw error;
    },
    db: {
      async execute() {
        dbCalled = true;
        return { rows: [] };
      },
    },
  });

  const req = {
    headers: {
      authorization: "Bearer expired-token",
    },
    log: {},
  };
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload?.error, "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى");
  assert.equal(nextCalled, false);
  assert.equal(dbCalled, false);
});

test("authenticateToken attaches the user and calls next for valid JWTs", async () => {
  const middleware = createAuthenticateToken({
    verifyTokenFn: async () => ({ sub: 7 }),
    db: {
      async execute() {
        return {
          rows: [
            {
              id: 7,
              username: "teacher_7",
              display_name: "Teacher Seven",
              role: "teacher",
            },
          ],
        };
      },
    },
  });

  const req = {
    headers: {
      authorization: "Bearer valid-token",
    },
    log: {},
  };
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, {
    id: 7,
    username: "teacher_7",
    display_name: "Teacher Seven",
    role: "teacher",
  });
});
