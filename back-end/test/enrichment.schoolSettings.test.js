import test from "node:test";
import assert from "node:assert/strict";

import { getSchoolSettings } from "../src/export/enrichment.js";
import { turso } from "../src/lib/turso.js";

test("getSchoolSettings returns profile logo payload when query succeeds", async () => {
  const originalExecute = turso.execute;
  turso.execute = async () => ({
    rows: [{ school_name: "مدرسة النور", school_logo_url: "data:image/png;base64,abc==" }],
  });

  try {
    const result = await getSchoolSettings(7);
    assert.deepEqual(result, {
      school_name: "مدرسة النور",
      school_logo_url: "data:image/png;base64,abc==",
      status: "ok",
      source: "user_profile",
    });
  } finally {
    turso.execute = originalExecute;
  }
});

test("getSchoolSettings surfaces diagnostics when DB lookup fails", async () => {
  const originalExecute = turso.execute;
  turso.execute = async () => {
    throw new Error("db is unavailable");
  };

  try {
    const result = await getSchoolSettings(9);
    assert.equal(result?.status, "error");
    assert.equal(result?.error, "school_settings_lookup_failed");
    assert.equal(result?.school_logo_url, null);
  } finally {
    turso.execute = originalExecute;
  }
});

