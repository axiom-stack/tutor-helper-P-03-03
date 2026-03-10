// Normalization utility functions used across controllers
// They either returned the normalized / parsed value, or an empty string / null / undefined / NaN if the input is invalid -> which are all handled properly

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOptionalText(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return NaN;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

export function getFileExtension(fileName = "") {
  const lowerCaseName = fileName.toLowerCase();

  if (lowerCaseName.endsWith(".pdf")) return ".pdf";
  if (lowerCaseName.endsWith(".docx")) return ".docx";
  if (lowerCaseName.endsWith(".doc")) return ".doc";

  return "";
}
