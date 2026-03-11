import crypto from "node:crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${parts.join(",")}}`;
}

export function hashPayload(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function computeChangedFields(previousValue, nextValue, basePath = "$") {
  if (Object.is(previousValue, nextValue)) {
    return [];
  }

  if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
    const maxLen = Math.max(previousValue.length, nextValue.length);
    const changed = [];
    for (let i = 0; i < maxLen; i += 1) {
      const path = `${basePath}[${i}]`;
      if (i >= previousValue.length || i >= nextValue.length) {
        changed.push(path);
        continue;
      }
      changed.push(...computeChangedFields(previousValue[i], nextValue[i], path));
    }
    return [...new Set(changed)];
  }

  if (isObject(previousValue) && isObject(nextValue)) {
    const keys = new Set([...Object.keys(previousValue), ...Object.keys(nextValue)]);
    const changed = [];
    for (const key of keys) {
      const path = basePath === "$" ? `${key}` : `${basePath}.${key}`;
      if (!Object.prototype.hasOwnProperty.call(previousValue, key)) {
        changed.push(path);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(nextValue, key)) {
        changed.push(path);
        continue;
      }
      changed.push(...computeChangedFields(previousValue[key], nextValue[key], path));
    }
    return [...new Set(changed)];
  }

  return [basePath === "$" ? "full_document" : basePath];
}

export function isGenericFeedback(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) return true;

  const genericPhrases = [
    "improve",
    "make it better",
    "enhance",
    "طور",
    "حسن",
    "عدله",
    "زبط",
    "افضل",
  ];

  if (normalized.length < 10) return true;
  return genericPhrases.some((phrase) => normalized.toLowerCase().includes(phrase));
}

export function hasConflictingDirections(text = "") {
  const normalized = String(text || "").toLowerCase();
  const increaseTokens = ["increase", "more", "longer", "expand", "زد", "زود", "اطول", "أكثر"];
  const decreaseTokens = ["decrease", "less", "shorter", "reduce", "قلل", "اختصر", "أقل"];

  const hasIncrease = increaseTokens.some((token) => normalized.includes(token));
  const hasDecrease = decreaseTokens.some((token) => normalized.includes(token));
  return hasIncrease && hasDecrease;
}
