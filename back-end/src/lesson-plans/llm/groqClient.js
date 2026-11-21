import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_GROQ_API_URL =
  process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const FALLBACK_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 90000);

function parseJsonContent(rawText) {
  if (typeof rawText !== "string") {
    throw new Error("Model output is not a string.");
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Model output is empty.");
  }

  const unwrapped = trimmed.startsWith("```")
    ? trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "")
    : trimmed;

  const parsed = JSON.parse(unwrapped.trim());

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model output is not a JSON object.");
  }

  return parsed;
}

// The recovery request is checked against the same schema before it can be used.
function matchesSchema(value, schema) {
  if (!schema) return true;
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "array") {
    return Array.isArray(value) && value.every((item) => matchesSchema(item, schema.items));
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const properties = schema.properties || {};
    if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) return false;
    return Object.entries(value).every(([key, child]) =>
      Object.hasOwn(properties, key)
        ? matchesSchema(child, properties[key])
        : schema.additionalProperties !== false,
    );
  }
  return false;
}

function isJsonValidationFailure(status, error) {
  return status === 400 && (
    error?.code === "json_validate_failed" ||
    /failed to validate json/i.test(error?.message || "")
  );
}

function buildFailure(errorType, message, extra = {}) {
  return {
    ok: false,
    errorType,
    message,
    ...extra,
  };
}

function buildGroqMetadata({ model, timeoutMs }) {
  return {
    provider: "groq",
    model,
    timeoutMs,
  };
}

function getFirstHeader(response, names = []) {
  if (!response?.headers?.get) {
    return null;
  }

  for (const name of names) {
    const value = response.headers.get(name);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function buildFailureResponseMetadata(response, parsedBody) {
  return {
    requestId: getFirstHeader(response, [
      "x-request-id",
      "request-id",
      "groq-request-id",
    ]),
    retryAfter: getFirstHeader(response, ["retry-after"]),
    upstreamError: {
      type: parsedBody?.error?.type || null,
      code: parsedBody?.error?.code || null,
      param: parsedBody?.error?.param || null,
    },
  };
}

export function createGroqClient(options = {}) {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const model = options.model ?? DEFAULT_GROQ_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiUrl = options.apiUrl ?? DEFAULT_GROQ_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async generateJson({ systemPrompt, userPrompt, model: overrideModel, responseFormat } = {}) {
      const resolvedModel = overrideModel || model;
      const baseMetadata = buildGroqMetadata({
        model: resolvedModel,
        timeoutMs,
      });

      if (!apiKey) {
        return buildFailure("api_error", "GROQ_API_KEY is not configured.", baseMetadata);
      }

      try {
        const requestBody = {
          model: resolvedModel,
          temperature: 0,
          ...(resolvedModel === DEFAULT_GROQ_MODEL || resolvedModel === FALLBACK_GROQ_MODEL
            ? { reasoning_effort: "low", max_completion_tokens: 4096 }
            : {}),
          response_format: responseFormat || { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        };
        let response;
        let parsedBody;
        let recoveredFromJsonValidation = false;
        let retriedRateLimit = false;

        for (;;) {
          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
          let rawBody;
          try {
            response = await fetchImpl(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              signal: controller.signal,
              body: JSON.stringify(requestBody),
            });
            rawBody = await response.text();
          } finally {
            clearTimeout(timeoutHandle);
          }
          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            parsedBody = null;
          }

          if (response.status === 429 && !retriedRateLimit) {
            const retryHeader = getFirstHeader(response, ["retry-after"]);
            const retrySeconds = retryHeader === null ? NaN : Number(retryHeader);
            if (Number.isFinite(retrySeconds) && retrySeconds >= 0 && retrySeconds <= 45) {
              retriedRateLimit = true;
              await delay(Math.ceil(retrySeconds * 1000) + 250);
              continue;
            }
          }

          // Groq may still reject a strict structured-output response. Retry once
          // without provider-side JSON enforcement, then validate locally below.
          if (!response.ok && !recoveredFromJsonValidation &&
              responseFormat?.type === "json_schema" &&
              isJsonValidationFailure(response.status, parsedBody?.error)) {
            recoveredFromJsonValidation = true;
            delete requestBody.response_format;
            continue;
          }
          break;
        }

        if (!response.ok) {
          return buildFailure(
            "api_error",
            parsedBody?.error?.message || "Groq API request failed.",
            {
              ...baseMetadata,
              status: response.status,
              ...buildFailureResponseMetadata(response, parsedBody),
              responseFormat: recoveredFromJsonValidation ? "text_recovery" : requestBody.response_format?.type,
            },
          );
        }

        const rawText = parsedBody?.choices?.[0]?.message?.content;
        if (parsedBody?.choices?.[0]?.finish_reason === "length") {
          return buildFailure("truncated_output", "The model reached its output token limit before completing the response.", {
            ...baseMetadata,
            responseFormat: recoveredFromJsonValidation ? "text_recovery" : requestBody.response_format?.type,
          });
        }

        try {
          const data = parseJsonContent(rawText);
          if (recoveredFromJsonValidation && !matchesSchema(data, responseFormat.json_schema?.schema)) {
            return buildFailure("malformed_json", "Model output did not match the requested lesson-plan structure.", {
              ...baseMetadata,
              responseFormat: "text_recovery",
            });
          }
          return {
            ok: true,
            data,
            rawText,
            provider: baseMetadata.provider,
            model: baseMetadata.model,
            usage: parsedBody?.usage,
            recoveredFromJsonValidation,
          };
        } catch {
          return buildFailure("malformed_json", "Model output was not valid JSON.", {
            ...baseMetadata,
            responseFormat: recoveredFromJsonValidation ? "text_recovery" : requestBody.response_format?.type,
          });
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return buildFailure(
            "timeout",
            `Groq request timed out after ${timeoutMs}ms.`,
            baseMetadata,
          );
        }

        return buildFailure(
          "api_error",
          error?.message || "Groq request failed unexpectedly.",
          {
            ...baseMetadata,
            upstreamError: {
              type: error?.name || null,
              code: null,
              param: null,
            },
          },
        );
      }
    },
  };
}
