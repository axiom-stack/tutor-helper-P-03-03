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

export function createGroqClient(options = {}) {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const model = options.model ?? DEFAULT_GROQ_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiUrl = options.apiUrl ?? DEFAULT_GROQ_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async generateJson({ systemPrompt, userPrompt, model: overrideModel } = {}) {
      if (!apiKey) {
        return buildFailure("api_error", "GROQ_API_KEY is not configured.");
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
            model: overrideModel || model,
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
              status: response.status,
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
            usage: parsedBody?.usage,
          };
        } catch {
          return buildFailure("malformed_json", "Model output was not valid JSON.", {
            raw: rawText,
          });
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return buildFailure("timeout", `Groq request timed out after ${timeoutMs}ms.`);
        }

        return buildFailure("api_error", error?.message || "Groq request failed unexpectedly.");
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}
