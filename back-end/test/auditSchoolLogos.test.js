import test from "node:test";
import assert from "node:assert/strict";

import { buildSchoolLogoAudit } from "../scripts/audit_school_logos.js";

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("buildSchoolLogoAudit classifies rows and plans normalization updates", async () => {
  const caseVariant = `"DATA:IMAGE/PNG;name=logo.png;base64,${SAMPLE_PNG_DATA_URL.split(",")[1]}"`;
  const rows = [
    { user_id: 1, school_logo_url: SAMPLE_PNG_DATA_URL },
    { user_id: 2, school_logo_url: caseVariant },
    { user_id: 3, school_logo_url: "" },
    { user_id: 4, school_logo_url: "invalid-logo" },
  ];

  const audit = await buildSchoolLogoAudit(rows);

  assert.equal(audit.summary.total, 4);
  assert.equal(audit.summary.invalid, 1);
  assert.ok(audit.summary.updates_planned >= 1);
  assert.equal(audit.invalid_rows[0]?.user_id, 4);
});

test("buildSchoolLogoAudit is idempotent when planned values are applied", async () => {
  const caseVariant = `"DATA:IMAGE/PNG;base64,${SAMPLE_PNG_DATA_URL.split(",")[1]}"`;
  const initialRows = [
    { user_id: 1, school_logo_url: caseVariant },
    { user_id: 2, school_logo_url: "  " },
  ];
  const firstAudit = await buildSchoolLogoAudit(initialRows);

  const appliedRows = firstAudit.rows.map((row) => ({
    user_id: row.user_id,
    school_logo_url: row.next_value,
  }));

  const secondAudit = await buildSchoolLogoAudit(appliedRows);
  assert.equal(secondAudit.summary.updates_planned, 0);
});
