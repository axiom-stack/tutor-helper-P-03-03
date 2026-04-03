const IMAGE_DATA_URL_PATTERN =
  /^data:\s*(image\/[\w.+-]+)(?:\s*;[^;,=\s]+=[^;,]+)*\s*;\s*base64\s*,\s*([A-Za-z0-9+/=\s]+)$/iu;

function unwrapQuotedText(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function normalizeOptionalImageDataUrl(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return NaN;

  const trimmed = unwrapQuotedText(value);
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = parseImageDataUrl(trimmed);
  if (!parsed) {
    return NaN;
  }

  return `data:${parsed.mimeType};base64,${parsed.base64Data}`;
}

export function parseImageDataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = unwrapQuotedText(value);
  const match = trimmed.match(IMAGE_DATA_URL_PATTERN);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;
  if (!mimeType || !base64Data) {
    return null;
  }

  return {
    mimeType: mimeType.trim().toLowerCase(),
    base64Data: base64Data.replace(/\s+/gu, ""),
  };
}
