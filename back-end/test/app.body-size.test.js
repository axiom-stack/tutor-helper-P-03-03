import test from "node:test";
import assert from "node:assert/strict";

import app from "../src/app.js";

test("accepts large JSON bodies without triggering a 413", async (t) => {
  const server = app.listen(0, "127.0.0.1");

  try {
    await Promise.race([
      new Promise((resolve) => server.once("listening", resolve)),
      new Promise((_, reject) => server.once("error", reject)),
    ]);
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      t.skip("Skipping listen test in restricted sandbox environments");
      return;
    }
    throw error;
  }

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const bigBase64 = "A".repeat(200 * 1024);
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/logout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school_logo_url: `data:image/png;base64,${bigBase64}`,
        }),
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
