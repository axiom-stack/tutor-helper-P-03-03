import test from "node:test";
import assert from "node:assert/strict";
import { createGroqClient } from "../src/lesson-plans/llm/groqClient.js";

test("sends the requested strict response format to Groq", async () => {
  let body;
  const client = createGroqClient({
    apiKey: "test",
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: '{"intro":"test"}' } }] }) };
    },
  });
  const responseFormat = { type: "json_schema", json_schema: { name: "draft", strict: true, schema: { type: "object", properties: { intro: { type: "string" } }, required: ["intro"], additionalProperties: false } } };
  const result = await client.generateJson({ systemPrompt: "JSON", userPrompt: "JSON", responseFormat });
  assert.deepEqual(body.response_format, responseFormat);
  assert.deepEqual(result.data, { intro: "test" });
});

const strictFormat = {
  type: "json_schema",
  json_schema: {
    name: "draft",
    strict: true,
    schema: {
      type: "object",
      properties: { intro: { type: "string" } },
      required: ["intro"],
      additionalProperties: false,
    },
  },
};

function mockGroqResponse(status, body) {
  return { ok: status === 200, status, text: async () => JSON.stringify(body) };
}

test("recovers a Groq JSON validation error with one locally validated text request", async () => {
  const requests = [];
  const responses = [
    mockGroqResponse(400, { error: { code: "json_validate_failed", message: "Failed to validate JSON.", failed_generation: "private lesson text" } }),
    mockGroqResponse(200, { choices: [{ message: { content: '{"intro":"درس"}' } }] }),
  ];
  const client = createGroqClient({ apiKey: "test", fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return responses.shift();
  } });
  const result = await client.generateJson({ systemPrompt: "Return JSON", userPrompt: "Create a lesson", responseFormat: strictFormat });
  assert.equal(result.ok, true);
  assert.equal(result.recoveredFromJsonValidation, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].response_format, strictFormat);
  assert.equal(requests[1].response_format, undefined);
  assert.match(requests[1].messages[0].content, /JSON Schema/);
  assert.match(requests[1].messages[0].content, /"required":\["intro"\]/);
  assert.deepEqual(result.data, { intro: "درس" });
});

test("rejects recovery output that violates the schema or is malformed", async () => {
  for (const content of ['{"intro":42}', '{"other":"missing"}', 'invalid']) {
    let calls = 0;
    const client = createGroqClient({ apiKey: "test", fetchImpl: async () => ++calls === 1
      ? mockGroqResponse(400, { error: { code: "json_validate_failed" } })
      : mockGroqResponse(200, { choices: [{ message: { content } }] }) });
    const result = await client.generateJson({ responseFormat: strictFormat, allowSchemaRepair: false });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, "malformed_json");
    assert.equal(calls, 2);
  }
});

test("does not retry authentication or rate limit errors as JSON failures", async () => {
  for (const status of [401, 429]) {
    let calls = 0;
    const client = createGroqClient({ apiKey: "test", fetchImpl: async () => {
      calls++;
      return mockGroqResponse(status, { error: { message: "Request failed", code: "other_error" } });
    } });
    const result = await client.generateJson({ responseFormat: strictFormat });
    assert.equal(result.status, status);
    assert.equal(calls, 1);
  }
});

test("sets a sufficient completion budget with low reasoning for configured models", async () => {
  let body;
  const client = createGroqClient({ apiKey: "test", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return mockGroqResponse(200, { choices: [{ message: { content: '{"intro":"ok"}' } }] });
  } });
  await client.generateJson({ responseFormat: strictFormat });
  assert.equal(body.reasoning_effort, "low");
  assert.equal(body.max_completion_tokens, 4096);
});

test("reports truncated output clearly", async () => {
  const client = createGroqClient({ apiKey: "test", fetchImpl: async () => mockGroqResponse(200, {
    choices: [{ finish_reason: "length", message: { content: "" } }],
  }) });
  const result = await client.generateJson({ responseFormat: strictFormat });
  assert.equal(result.errorType, "truncated_output");
});

test("retries one short rate limit after the provider's retry-after", async () => {
  let calls = 0;
  const client = createGroqClient({ apiKey: "test", timeoutMs: 100, fetchImpl: async () => {
    calls++;
    if (calls === 1) return { ...mockGroqResponse(429, { error: { code: "rate_limit_exceeded" } }), headers: { get: (name) => name === "retry-after" ? "0" : null } };
    return mockGroqResponse(200, { choices: [{ message: { content: '{"intro":"ok"}' } }] });
  } });
  const result = await client.generateJson({ responseFormat: strictFormat });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});


test("recovers extra fields and a single wrapper without inventing required values", async () => {
  for (const content of ['{"intro":"ok","extra":true}', '{"plan":{"intro":"ok","extra":true}}']) {
    let calls = 0;
    const client = createGroqClient({ apiKey: "test", fetchImpl: async () => ++calls === 1
      ? mockGroqResponse(400, { error: { code: "json_validate_failed" } })
      : mockGroqResponse(200, { choices: [{ message: { content } }] }) });
    const result = await client.generateJson({ responseFormat: strictFormat });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { intro: "ok" });
  }
});


test("repairs a schema mismatch once and checks the repaired result", async () => {
  const requests = [];
  const replies = [
    mockGroqResponse(400, { error: { code: "json_validate_failed" } }),
    mockGroqResponse(200, { choices: [{ message: { content: '{"intro":42}' } }] }),
    mockGroqResponse(200, { choices: [{ message: { content: '{"intro":"corrected"}' } }] }),
  ];
  const client = createGroqClient({ apiKey: "test", fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return replies.shift();
  } });
  const result = await client.generateJson({ responseFormat: strictFormat });
  assert.equal(result.ok, true);
  assert.equal(result.repairedSchema, true);
  assert.deepEqual(result.data, { intro: "corrected" });
  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[1].content, /JSON schema/);
});

test("rejects a repair that still does not match the schema", async () => {
  const replies = [
    mockGroqResponse(400, { error: { code: "json_validate_failed" } }),
    mockGroqResponse(200, { choices: [{ message: { content: '{"intro":42}' } }] }),
    mockGroqResponse(200, { choices: [{ message: { content: '{"intro":43}' } }] }),
  ];
  const client = createGroqClient({ apiKey: "test", fetchImpl: async () => replies.shift() });
  const result = await client.generateJson({ responseFormat: strictFormat });
  assert.equal(result.ok, false);
  assert.equal(result.errorType, "malformed_json");
});
