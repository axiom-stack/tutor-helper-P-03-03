const DEFAULT_GROQ_API_URL =
  process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);

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
    async generateJson({ systemPrompt, userPrompt, model: overrideModel } = {}) {
      const resolvedModel = overrideModel || model;
      const baseMetadata = buildGroqMetadata({
        model: resolvedModel,
        timeoutMs,
      });

      if (!apiKey) {
        return buildFailure("api_error", "GROQ_API_KEY is not configured.", baseMetadata);
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: resolvedModel,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        const rawBody = await response.text();
        let parsedBody = null;

        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          parsedBody = null;
        }

        if (!response.ok) {
          return buildFailure(
            "api_error",
            parsedBody?.error?.message || "Groq API request failed.",
            {
              ...baseMetadata,
              status: response.status,
              ...buildFailureResponseMetadata(response, parsedBody),
              raw: rawBody,
            },
          );
        }

        const rawText = parsedBody?.choices?.[0]?.message?.content;

        try {
          const data = parseJsonContent(rawText);
          return {
            ok: true,
            data,
            rawText,
            provider: baseMetadata.provider,
            model: baseMetadata.model,
            usage: parsedBody?.usage,
          };
        } catch {
          return buildFailure("malformed_json", "Model output was not valid JSON.", {
            ...baseMetadata,
            raw: rawText,
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
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}
