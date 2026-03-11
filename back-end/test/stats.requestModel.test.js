import test from "node:test";
import assert from "node:assert/strict";

import { validateStatsQuery } from "../src/stats/requestModel.js";

test("validateStatsQuery resolves rolling period presets", () => {
  const validation = validateStatsQuery({ period: "30d" }, { role: "teacher" });

  assert.equal(validation.ok, true);
  assert.equal(validation.value.period, "30d");
  assert.equal(typeof validation.value.date_from, "string");
  assert.equal(typeof validation.value.date_to, "string");
  assert.ok(validation.value.date_from <= validation.value.date_to);
});

test("validateStatsQuery requires custom range bounds", () => {
  const validation = validateStatsQuery(
    { period: "custom", date_from: "2026-03-01" },
    { role: "admin" },
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.code, "missing_custom_dates");
});

test("validateStatsQuery rejects teacher filter for non-admin user", () => {
  const validation = validateStatsQuery(
    { teacher_id: "3" },
    { role: "teacher" },
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.status, 403);
  assert.equal(validation.code, "forbidden_teacher_filter");
});
