import sharp from "sharp";

import { parseImageDataUrl } from "../utils/imageDataUrl.js";

const STATUS = Object.freeze({
  OK: "ok",
  RECOVERED: "recovered",
  MISSING: "missing",
  INVALID: "invalid",
});

const LOGO_PLACEHOLDER_DIMENSION = 128;
const LOGO_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_PLACEHOLDER_DIMENSION}" height="${LOGO_PLACEHOLDER_DIMENSION}" viewBox="0 0 ${LOGO_PLACEHOLDER_DIMENSION} ${LOGO_PLACEHOLDER_DIMENSION}">
  <rect x="4" y="4" width="${LOGO_PLACEHOLDER_DIMENSION - 8}" height="${LOGO_PLACEHOLDER_DIMENSION - 8}" rx="14" fill="#F3F4F6" stroke="#6B7280" stroke-width="8" />
  <path d="M32 96 L56 66 L74 84 L96 54" fill="none" stroke="#9CA3AF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="48" cy="46" r="10" fill="#9CA3AF" />
</svg>`;
const IMG_SRC_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/iu;
const DATA_URL_LOOSE_PATTERN = /^data:\s*(image\/[\w.+-]+)([^,]*),(.*)$/isu;
const RAW_BASE64_PATTERN = /^[A-Za-z0-9+/_=\s-]+$/u;

let placeholderDataUrlPromise;

function trimToNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stripWrappingChars(value) {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  const unwrapped = trimmed
    .replace(/^[`"'(\[]+/u, "")
    .replace(/[`"')\]>]+$/u, "")
    .trim();
  return unwrapped.length > 0 ? unwrapped : null;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withBase64Padding(value) {
  const remainder = value.length % 4;
  if (remainder === 0) {
    return value;
  }
  return value + "=".repeat(4 - remainder);
}

function addCandidate(set, value) {
  const normalized = trimToNull(value);
  if (normalized) {
    set.add(normalized);
  }
}

function collectPotentialLogoStrings(value, set, depth = 0) {
  if (value == null || depth > 2) {
    return;
  }

  if (typeof value === "string") {
    addCandidate(set, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPotentialLogoStrings(item, set, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (typeof nestedValue === "string" && /(logo|image|src|url|data)/iu.test(key)) {
        addCandidate(set, nestedValue);
      } else {
        collectPotentialLogoStrings(nestedValue, set, depth + 1);
      }
    }
  }
}

function extractPotentialLogoStrings(rawInput) {
  const normalizedInput = trimToNull(rawInput);
  if (!normalizedInput) {
    return [];
  }

  const candidates = new Set();
  addCandidate(candidates, normalizedInput);
  addCandidate(candidates, stripWrappingChars(normalizedInput));

  const lower = normalizedInput.toLowerCase();
  const dataIndex = lower.indexOf("data:image/");
  if (dataIndex >= 0) {
    addCandidate(candidates, normalizedInput.slice(dataIndex));
  }

  const imgMatch = normalizedInput.match(IMG_SRC_PATTERN);
  if (imgMatch?.[1] || imgMatch?.[2]) {
    addCandidate(candidates, imgMatch[1] ?? imgMatch[2]);
  }

  try {
    const parsed = JSON.parse(normalizedInput);
    collectPotentialLogoStrings(parsed, candidates);
  } catch {
    // Not a JSON wrapper.
  }

  const expandedCandidates = new Set();
  for (const candidate of candidates) {
    addCandidate(expandedCandidates, candidate);
    addCandidate(expandedCandidates, stripWrappingChars(candidate));
    const nestedDataIndex = candidate.toLowerCase().indexOf("data:image/");
    if (nestedDataIndex >= 0) {
      addCandidate(expandedCandidates, candidate.slice(nestedDataIndex));
      addCandidate(expandedCandidates, stripWrappingChars(candidate.slice(nestedDataIndex)));
    }
  }

  return Array.from(expandedCandidates);
}

function extractLooseDataUrlParts(value) {
  const normalizedValue = trimToNull(value);
  if (!normalizedValue) {
    return null;
  }

  const looseMatch = normalizedValue.match(DATA_URL_LOOSE_PATTERN);
  if (!looseMatch) {
    return null;
  }

  const [, mimeType, metadata, payload] = looseMatch;
  if (!/;\s*base64\b/iu.test(metadata ?? "")) {
    return null;
  }

  const normalizedMimeType = trimToNull(mimeType)?.toLowerCase() ?? null;
  const base64Payload = trimToNull(payload);
  if (!normalizedMimeType || !base64Payload) {
    return null;
  }

  return {
    mimeType: normalizedMimeType,
    base64Payload,
  };
}

function looksLikeRawBase64(value) {
  const normalizedValue = trimToNull(value);
  if (!normalizedValue) {
    return false;
  }

  const compact = normalizedValue.replace(/\s+/gu, "");
  return compact.length >= 40 && RAW_BASE64_PATTERN.test(normalizedValue);
}

function buildBase64PayloadVariants(rawPayload) {
  const seed = trimToNull(rawPayload);
  if (!seed) {
    return [];
  }

  const normalizedSeeds = new Set([
    seed,
    stripWrappingChars(seed),
    decodeURIComponentSafe(seed),
    decodeURIComponentSafe(stripWrappingChars(seed) ?? seed),
  ]);

  const variants = new Set();
  for (const rawSeed of normalizedSeeds) {
    const normalizedSeed = trimToNull(rawSeed);
    if (!normalizedSeed) {
      continue;
    }

    const compact = normalizedSeed.replace(/\s+/gu, "");
    const spaceAsPlus = normalizedSeed.replace(/\s+/gu, "+");

    for (const value of [compact, spaceAsPlus]) {
      const normalizedValue = trimToNull(value);
      if (!normalizedValue) {
        continue;
      }

      const asStandardBase64 = normalizedValue.replace(/-/g, "+").replace(/_/g, "/");
      if (!/^[A-Za-z0-9+/=]+$/u.test(asStandardBase64)) {
        continue;
      }

      variants.add(withBase64Padding(asStandardBase64));
    }
  }

  return Array.from(variants);
}

function createDecodeAttempts(rawValue) {
  const attempts = [];
  const seen = new Set();

  const pushAttempt = (attempt) => {
    const key = `${attempt.mimeType ?? "unknown"}:${attempt.base64Payload}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    attempts.push(attempt);
  };

  for (const candidate of extractPotentialLogoStrings(rawValue)) {
    const strictParsed = parseImageDataUrl(candidate);
    if (strictParsed?.base64Data) {
      pushAttempt({
        mode: "strict",
        mimeType: strictParsed.mimeType,
        base64Payload: strictParsed.base64Data,
        canonicalInput: `data:${strictParsed.mimeType};base64,${strictParsed.base64Data}`,
      });
    }

    const looseParsed = extractLooseDataUrlParts(candidate);
    if (looseParsed) {
      for (const variant of buildBase64PayloadVariants(looseParsed.base64Payload)) {
        pushAttempt({
          mode: "loose_data_url",
          mimeType: looseParsed.mimeType,
          base64Payload: variant,
          canonicalInput: null,
        });
      }
      continue;
    }

    if (looksLikeRawBase64(candidate)) {
      for (const variant of buildBase64PayloadVariants(candidate)) {
        pushAttempt({
          mode: "raw_base64",
          mimeType: null,
          base64Payload: variant,
          canonicalInput: null,
        });
      }
    }
  }

  return attempts;
}

async function buildVisiblePlaceholderDataUrl() {
  const pngBuffer = await sharp(Buffer.from(LOGO_PLACEHOLDER_SVG)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

export async function getVisiblePlaceholderDataUrl() {
  if (!placeholderDataUrlPromise) {
    placeholderDataUrlPromise = buildVisiblePlaceholderDataUrl().catch((error) => {
      placeholderDataUrlPromise = null;
      throw error;
    });
  }
  return placeholderDataUrlPromise;
}

async function inspectSingleLogoValue(rawValue) {
  const normalizedInput = trimToNull(rawValue);
  if (!normalizedInput) {
    return {
      status: STATUS.MISSING,
      normalizedDataUrl: null,
      reason: "empty_logo_value",
      recovered: false,
    };
  }
  const decodeAttempts = createDecodeAttempts(normalizedInput);
  if (!decodeAttempts.length) {
    return {
      status: STATUS.INVALID,
      normalizedDataUrl: null,
      reason: "invalid_data_url_format",
      recovered: false,
    };
  }

  for (const attempt of decodeAttempts) {
    let inputBuffer;
    try {
      inputBuffer = Buffer.from(attempt.base64Payload, "base64");
    } catch {
      continue;
    }

    if (!inputBuffer?.length) {
      continue;
    }

    try {
      // metadata() validates that the payload is a readable image.
      await sharp(inputBuffer).metadata();
      const pngBuffer = await sharp(inputBuffer).png().toBuffer();
      const normalizedDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

      const recoveredFromFormat =
        attempt.mode !== "strict" ||
        attempt.mimeType !== "image/png" ||
        normalizedInput !== attempt.canonicalInput;
      const recovered = Boolean(recoveredFromFormat);
      let reason = null;
      if (recovered) {
        if (attempt.mode === "raw_base64") {
          reason = "recovered_raw_base64_payload";
        } else if (attempt.mode === "loose_data_url") {
          reason = "repaired_data_url_payload";
        } else {
          reason = "normalized_to_png";
        }
      }

      return {
        status: recovered ? STATUS.RECOVERED : STATUS.OK,
        normalizedDataUrl,
        reason,
        recovered,
      };
    } catch {
      // Try next candidate form.
    }
  }

  return {
    status: STATUS.INVALID,
    normalizedDataUrl: null,
    reason: "unreadable_image_payload",
    recovered: false,
  };
}

function getLogoCandidates(enrichedExam) {
  return [
    {
      source: "school_logo_url",
      value: enrichedExam?.school_logo_url,
    },
    {
      source: "school_logo",
      value: enrichedExam?.school_logo,
    },
  ];
}

export async function inspectSchoolLogoValue(rawValue) {
  return await inspectSingleLogoValue(rawValue);
}

export async function resolveSchoolLogoForExport(enrichedExam, options = {}) {
  if (
    enrichedExam &&
    typeof enrichedExam === "object" &&
    enrichedExam._logo_resolution &&
    typeof enrichedExam._logo_resolution.status === "string"
  ) {
    return {
      exam: enrichedExam,
      logoResolution: enrichedExam._logo_resolution,
    };
  }

  const logger = options.logger;
  const useFallbackPlaceholder = options.useFallbackPlaceholder !== false;
  const examPublicId = trimToNull(enrichedExam?.public_id) ?? "exam";
  const schoolDiagnostics = enrichedExam?._school_settings_diagnostics;

  let selected = null;
  let firstInvalid = null;
  let firstNonEmptyCandidateSource = null;

  for (const candidate of getLogoCandidates(enrichedExam)) {
    const rawValue = trimToNull(candidate.value);
    if (!rawValue) {
      continue;
    }

    firstNonEmptyCandidateSource = firstNonEmptyCandidateSource ?? candidate.source;
    const inspection = await inspectSingleLogoValue(rawValue);
    if (inspection.status === STATUS.OK || inspection.status === STATUS.RECOVERED) {
      selected = {
        ...inspection,
        source: candidate.source,
      };
      break;
    }

    if (!firstInvalid) {
      firstInvalid = {
        ...inspection,
        source: candidate.source,
      };
    }
  }

  let status = STATUS.MISSING;
  let source = firstNonEmptyCandidateSource ?? "none";
  let reason = schoolDiagnostics?.status === "error" ? "school_settings_lookup_failed" : null;
  let normalizedDataUrl = null;
  let recovered = false;
  let fallbackUsed = false;

  if (selected) {
    status = selected.status;
    source = selected.source;
    reason = selected.reason ?? null;
    normalizedDataUrl = selected.normalizedDataUrl;
    recovered = selected.recovered;
  } else if (firstInvalid) {
    status = STATUS.INVALID;
    source = firstInvalid.source;
    reason = firstInvalid.reason ?? "invalid_logo_payload";
  }

  if (!normalizedDataUrl && useFallbackPlaceholder) {
    normalizedDataUrl = await getVisiblePlaceholderDataUrl();
    fallbackUsed = true;
  }

  const diagnostics = {
    status,
    source,
    reason,
    recovered,
    fallback_used: fallbackUsed,
  };

  const examWithResolvedLogo = {
    ...(enrichedExam ?? {}),
    school_logo_url: normalizedDataUrl,
    _logo_resolution: diagnostics,
  };

  if (fallbackUsed) {
    logger?.warn?.(
      {
        exam_public_id: examPublicId,
        logo_status: diagnostics.status,
        logo_source: diagnostics.source,
        logo_reason: diagnostics.reason,
      },
      "Exam logo fallback was used during export",
    );
  }

  return {
    exam: examWithResolvedLogo,
    logoResolution: diagnostics,
  };
}
