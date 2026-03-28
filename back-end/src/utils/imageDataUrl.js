const IMAGE_DATA_URL_PATTERN = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/u;

export function normalizeOptionalImageDataUrl(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return NaN;

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return IMAGE_DATA_URL_PATTERN.test(trimmed) ? trimmed : NaN;
}

export function parseImageDataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(IMAGE_DATA_URL_PATTERN);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;
  if (!mimeType || !base64Data) {
    return null;
  }

  return {
    mimeType,
    base64Data: base64Data.replace(/\s+/gu, ""),
  };
}
