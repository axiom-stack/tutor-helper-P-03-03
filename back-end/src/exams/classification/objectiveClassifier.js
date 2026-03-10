import { BLOOM_LEVELS } from "../types.js";

const FALLBACK_WRAPPER_KEYS = ["items", "classifications", "results", "data", "output"];

function normalizeArabic(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeObjectiveText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const candidates = ["text", "objective", "description", "value"];
    for (const key of candidates) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function buildNormalizedVerbBank(bloomVerbs) {
  return BLOOM_LEVELS.reduce((acc, level) => {
    const values = Array.isArray(bloomVerbs?.[level]) ? bloomVerbs[level] : [];
    const normalizedVerbs = values
      .map((verb) => normalizeArabic(verb))
      .filter((verb) => verb.length > 0);
    acc[level] = [...new Set(normalizedVerbs)];
    return acc;
  }, {});
}

function detectMatchedLevels(objectiveText, normalizedVerbBank) {
  const normalized = normalizeArabic(objectiveText);
  if (!normalized) {
    return [];
  }

  const paddedText = ` ${normalized} `;
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const matches = [];

  for (const level of BLOOM_LEVELS) {
    const verbs = normalizedVerbBank[level] || [];
    const hasMatch = verbs.some((verb) => {
      if (!verb) return false;
      if (verb.includes(" ")) {
        return paddedText.includes(` ${verb} `);
      }
      return tokens.has(verb);
    });

    if (hasMatch) {
      matches.push(level);
    }
  }

  return matches;
}

function extractFallbackItems(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return null;
  }

  if (Array.isArray(rawData.items)) {
    return rawData.items;
  }

  for (const key of FALLBACK_WRAPPER_KEYS) {
    const value = rawData[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === "object" && Array.isArray(value.items)) {
      return value.items;
    }
  }

  return null;
}

async function classifyLeftoversWithFallback({
  leftovers,
  llmClient,
  fallbackModel,
}) {
  if (leftovers.length === 0) {
    return [];
  }

  if (!llmClient) {
    throw new Error("LLM client is required for fallback objective classification");
  }

  const systemPrompt = [
    "Classify each Arabic objective into exactly one Bloom level code.",
    "Allowed levels only:",
    BLOOM_LEVELS.join(", "),
    "Return JSON only with one key: items.",
    "Each item must be: { index: number, level: string }.",
    "Do not add extra text or keys.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      instruction:
        "Classify unresolved objectives only. Choose the single closest level.",
      allowed_levels: BLOOM_LEVELS,
      items: leftovers.map((item) => ({
        index: item.index,
        objective_text: item.objective_text,
      })),
      expected_output_shape: {
        items: [{ index: 0, level: "remember|understand|apply|analyze|synthesize|evaluate" }],
      },
    },
    null,
    2,
  );

  const result = await llmClient.generateJson({
    systemPrompt,
    userPrompt,
    model: fallbackModel,
  });

  if (!result?.ok) {
    throw new Error(result?.message || "fallback objective classification failed");
  }

  const items = extractFallbackItems(result.data);
  if (!Array.isArray(items)) {
    throw new Error("fallback objective classification returned invalid JSON shape");
  }

  return items;
}

export async function classifyObjectivesWithFallback({
  objectives,
  bloomVerbs,
  llmClient,
  fallbackModel = process.env.GROQ_FALLBACK_MODEL || process.env.GROQ_MODEL,
}) {
  const normalizedVerbBank = buildNormalizedVerbBank(bloomVerbs);

  const classified = [];
  const leftovers = [];

  objectives.forEach((rawObjective, index) => {
    const objectiveText = normalizeObjectiveText(rawObjective);
    if (!objectiveText) {
      leftovers.push({
        index,
        objective_text: "",
        reason: "empty_objective",
      });
      return;
    }

    const matchedLevels = detectMatchedLevels(objectiveText, normalizedVerbBank);

    if (matchedLevels.length === 1) {
      classified.push({
        index,
        objective_text: objectiveText,
        level: matchedLevels[0],
        source: "rule",
        matched_levels: matchedLevels,
      });
      return;
    }

    leftovers.push({
      index,
      objective_text: objectiveText,
      reason: matchedLevels.length > 1 ? "multi_level_match" : "no_rule_match",
      matched_levels: matchedLevels,
    });
  });

  if (leftovers.length > 0) {
    const fallbackItems = await classifyLeftoversWithFallback({
      leftovers,
      llmClient,
      fallbackModel,
    });

    const fallbackByIndex = new Map();
    for (const item of fallbackItems) {
      const idx = Number(item?.index);
      const level = typeof item?.level === "string" ? item.level.trim() : "";
      if (!Number.isInteger(idx) || !BLOOM_LEVELS.includes(level)) {
        continue;
      }
      fallbackByIndex.set(idx, level);
    }

    const unresolved = [];
    for (const leftover of leftovers) {
      const resolvedLevel = fallbackByIndex.get(leftover.index);
      if (!resolvedLevel) {
        unresolved.push({
          index: leftover.index,
          objective_text: leftover.objective_text,
          reason: leftover.reason,
          matched_levels: leftover.matched_levels || [],
        });
        continue;
      }

      classified.push({
        index: leftover.index,
        objective_text: leftover.objective_text,
        level: resolvedLevel,
        source: "fallback_llm",
        matched_levels: leftover.matched_levels || [],
      });
    }

    if (unresolved.length > 0) {
      const error = new Error("objective classification fallback left unresolved objectives");
      error.code = "objective_classification_unresolved";
      error.details = unresolved;
      throw error;
    }
  }

  return classified.sort((a, b) => a.index - b.index);
}

export function extractObjectiveTextsFromPlan(plan) {
  if (!plan?.plan_json || typeof plan.plan_json !== "object") {
    return [];
  }

  const source =
    plan.plan_type === "traditional"
      ? plan.plan_json.learning_outcomes
      : plan.plan_json.objectives;

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item) => normalizeObjectiveText(item))
    .filter((item) => item.length > 0);
}

export const __private__ = {
  normalizeArabic,
  normalizeObjectiveText,
  detectMatchedLevels,
};
