#!/usr/bin/env node
import { createClient } from "@libsql/client";

import { inspectSchoolLogoValue } from "../src/export/schoolLogoResolver.js";

function toTrimmedString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function parseCliArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

function isEffectivelyNull(value) {
  return value == null || toTrimmedString(value) === "";
}

export async function buildSchoolLogoAudit(rows = []) {
  const normalizedRows = [];

  for (const row of rows) {
    const userId = Number(row?.user_id);
    const currentValue = typeof row?.school_logo_url === "string" ? row.school_logo_url : null;
    const inspection = await inspectSchoolLogoValue(currentValue);

    let nextValue = currentValue;
    let action = "none";

    if (inspection.status === "ok" || inspection.status === "recovered") {
      if (inspection.normalizedDataUrl && inspection.normalizedDataUrl !== currentValue) {
        nextValue = inspection.normalizedDataUrl;
        action = "normalize";
      }
    } else if (inspection.status === "missing" && !isEffectivelyNull(currentValue)) {
      nextValue = null;
      action = "nullify_empty";
    }

    normalizedRows.push({
      user_id: userId,
      status: inspection.status,
      reason: inspection.reason ?? null,
      current_value: currentValue,
      next_value: nextValue,
      action,
    });
  }

  const summary = {
    total: normalizedRows.length,
    ok: normalizedRows.filter((row) => row.status === "ok").length,
    recovered: normalizedRows.filter((row) => row.status === "recovered").length,
    missing: normalizedRows.filter((row) => row.status === "missing").length,
    invalid: normalizedRows.filter((row) => row.status === "invalid").length,
    updates_planned: normalizedRows.filter((row) => row.action !== "none").length,
  };

  return {
    summary,
    rows: normalizedRows,
    invalid_rows: normalizedRows.filter((row) => row.status === "invalid"),
  };
}

async function fetchRows(client) {
  const result = await client.execute({
    sql: "SELECT user_id, school_logo_url FROM UserProfiles ORDER BY user_id ASC",
  });
  return result.rows ?? [];
}

async function applyPlannedUpdates(client, audit) {
  let applied = 0;
  for (const row of audit.rows) {
    if (row.action === "none") {
      continue;
    }
    await client.execute({
      sql: "UPDATE UserProfiles SET school_logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      args: [row.next_value, row.user_id],
    });
    applied += 1;
  }
  return applied;
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");
  }

  const client = createClient({ url, authToken });
  const rows = await fetchRows(client);
  const audit = await buildSchoolLogoAudit(rows);

  let updatesApplied = 0;
  if (args.apply) {
    updatesApplied = await applyPlannedUpdates(client, audit);
  }

  const output = {
    mode: args.apply ? "apply" : "audit",
    summary: {
      ...audit.summary,
      updates_applied: updatesApplied,
    },
    invalid_rows: audit.invalid_rows.map((row) => ({
      user_id: row.user_id,
      reason: row.reason,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(
      JSON.stringify(
        {
          error: error?.message ?? String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  });
}

