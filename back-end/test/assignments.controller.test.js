import test from "node:test";
import assert from "node:assert/strict";

import { createAssignmentsController } from "../src/controllers/assignments.controller.js";

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

test("updateAssignmentById persists assignment changes and appends manual revision", async () => {
  const appended = [];
  const controller = createAssignmentsController({
    assignmentsRepository: {
      async update(publicId, payload) {
        return {
          public_id: publicId,
          assignment_group_public_id: "asg_1",
          teacher_id: 2,
          lesson_plan_public_id: "trd_3",
          lesson_id: 11,
          name: payload.name,
          description: payload.description,
          type: payload.type,
          content: payload.content,
          created_at: "2026-03-09T00:00:00.000Z",
          updated_at: "2026-03-12T00:00:00.000Z",
        };
      },
    },
    revisionsRepository: {
      async appendRevision(payload) {
        appended.push(payload);
        return { id: 2 };
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { id: "asn_8" },
    body: {
      name: "واجب معدل",
      description: "وصف معدل",
      type: "varied",
      content: "محتوى معدل",
    },
  };
  const res = createMockRes();

  await controller.updateAssignmentById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.assignment?.name, "واجب معدل");
  assert.equal(appended.length, 1);
  assert.equal(appended[0].source, "manual_edit");
});
