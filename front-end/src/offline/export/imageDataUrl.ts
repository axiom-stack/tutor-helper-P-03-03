/** Minimal port of back-end `parseImageDataUrl` for export logo rendering. */
const IMAGE_DATA_URL_PATTERN =
  /^data:\s*(image\/[\w.+-]+)(?:\s*;[^;,=\s]+=[^;,]+)*\s*;\s*base64\s*,\s*([A-Za-z0-9+/=\s]+)$/iu;

function unwrapQuotedText(value: string): string {
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

export function parseImageDataUrl(value: unknown): { mimeType: string; base64Data: string } | null {
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
