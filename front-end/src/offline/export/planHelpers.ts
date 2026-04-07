/* eslint-disable @typescript-eslint/ban-ts-comment -- vendored server export */
// @ts-nocheck
/**
 * Helpers to extract display text from plan_json (mirror frontend logic).
 */

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function toDisplayText(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "—";
  }
  if (typeof value === "number") return String(value);
  if (isRecord(value)) {
    const candidateKeys = [
      "text",
      "objective",
      "description",
      "name",
      "question",
      "content",
      "title",
      "value",
    ];
    for (const key of candidateKeys) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }
    const entries = Object.entries(value)
      .map(([key, itemValue]) => {
        if (typeof itemValue === "string" || typeof itemValue === "number") {
          return `${key}: ${itemValue}`;
        }
        if (Array.isArray(itemValue)) {
          return `${key}: ${itemValue.map((item) => toDisplayText(item)).join("، ")}`;
        }
        if (isRecord(itemValue)) return `${key}: ${JSON.stringify(itemValue)}`;
        return null;
      })
      .filter(Boolean);
    return entries.length > 0 ? entries.join(" | ") : "—";
  }
  return "—";
}

export function toTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toDisplayText(item)).filter((item) => item !== "—");
}

export function extractHeaderValue(header, key) {
  if (!isRecord(header)) return "—";
  return toDisplayText(header[key]);
}
