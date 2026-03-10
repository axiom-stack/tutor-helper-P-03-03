import test from "node:test";
import assert from "node:assert/strict";

import { createStatsController } from "../src/controllers/stats.controller.js";

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    sentBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    send(body) {
      this.sentBody = body;
      return this;
    },
  };
}

test("getSummary rejects teacher_id filter for non-admin users", async () => {
  const controller = createStatsController({
    statsService: {
      async getSummary() {
        throw new Error("should not be called");
      },
    },
    statsExporter: async () => {
      throw new Error("not used");
    },
  });

  const req = {
    user: { id: 2, role: "teacher", username: "teacher_2" },
    query: { teacher_id: "5" },
  };

  const res = createMockRes();

  await controller.getSummary(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.error?.code, "forbidden_teacher_filter");
});

test("getSummary returns service response for valid admin query", async () => {
  const calls = [];

  const controller = createStatsController({
    statsService: {
      async getSummary(filters, requester) {
        calls.push({ filters, requester });
        return {
          kpis: { plans_generated: 1 },
          quality_rubric: {},
          trends: { monthly: [] },
          breakdowns: {},
          filters_applied: filters,
        };
      },
    },
    statsExporter: async () => {
      throw new Error("not used");
    },
  });

  const req = {
    user: { id: 1, role: "admin", username: "admin" },
    query: {},
  };
  const res = createMockRes();

  await controller.getSummary(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.kpis?.plans_generated, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filters.period, "all");
  assert.equal(calls[0].requester.role, "admin");
});

test("exportReport returns pdf buffer and content headers", async () => {
  const pdfBuffer = Buffer.from("pdf-bytes");

  const controller = createStatsController({
    statsService: {
      async getSummary() {
        return {
          kpis: {},
          quality_rubric: {},
          trends: { monthly: [] },
          breakdowns: {},
          filters_applied: { scope: "admin_all" },
        };
      },
    },
    statsExporter: async () => ({
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      suggestedFilename: "stats_admin_all_2026-03-11.pdf",
    }),
  });

  const req = {
    user: { id: 1, role: "admin", username: "admin" },
    query: { format: "pdf" },
  };
  const res = createMockRes();

  await controller.exportReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(
    res.headers["Content-Disposition"] || "",
    /attachment; filename="stats_admin_all_2026-03-11.pdf"/,
  );
  assert.equal(res.sentBody, pdfBuffer);
});
