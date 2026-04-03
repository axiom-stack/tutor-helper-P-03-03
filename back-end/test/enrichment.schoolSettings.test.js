import test from "node:test";
import assert from "node:assert/strict";

import { enrichExam, getSchoolSettings } from "../src/export/enrichment.js";
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

test("enrichExam falls back to requester school settings when teacher settings are incomplete", async () => {
  const originalExecute = turso.execute;
  turso.execute = async ({ sql, args }) => {
    const normalizedSql = String(sql);

    if (normalizedSql.includes("FROM Users u") && normalizedSql.includes("UserProfiles")) {
      const userId = Number(args?.[0]);
      if (userId === 10) {
        return { rows: [{ school_name: null, school_logo_url: null }] };
      }
      if (userId === 77) {
        return {
          rows: [
            {
              school_name: "مدرسة الطالب",
              school_logo_url: "data:image/png;base64,abc==",
            },
          ],
        };
      }
    }

    if (normalizedSql.includes("SELECT display_name, username FROM Users")) {
      return { rows: [{ display_name: "Teacher", username: "teacher_10" }] };
    }

    if (normalizedSql.includes("SELECT grade_label, section_label")) {
      return {
        rows: [
          {
            grade_label: "الصف التاسع",
            section_label: "أ",
            semester: "الأول",
            academic_year: "2025-2026",
          },
        ],
      };
    }

    if (normalizedSql.includes("SELECT name FROM Subjects")) {
      return { rows: [{ name: "العلوم" }] };
    }

    return { rows: [] };
  };

  try {
    const enriched = await enrichExam(
      {
        public_id: "exm_7",
        teacher_id: 10,
        class_id: 1,
        subject_id: 2,
        questions: [],
      },
      { requesterUserId: 77 },
    );

    assert.equal(enriched.school_name, "مدرسة الطالب");
    assert.equal(enriched.school_logo_url, "data:image/png;base64,abc==");
    assert.equal(enriched._school_settings_diagnostics?.source, "request_user_profile_fallback");
    assert.equal(enriched._school_settings_diagnostics?.fallback_applied, true);
  } finally {
    turso.execute = originalExecute;
  }
});
