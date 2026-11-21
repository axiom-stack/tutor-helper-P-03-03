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
