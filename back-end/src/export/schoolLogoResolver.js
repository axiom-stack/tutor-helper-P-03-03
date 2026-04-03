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

let placeholderDataUrlPromise;

function trimToNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

  const parsed = parseImageDataUrl(normalizedInput);
  if (!parsed) {
    return {
      status: STATUS.INVALID,
      normalizedDataUrl: null,
      reason: "invalid_data_url_format",
      recovered: false,
    };
  }

  let inputBuffer;
  try {
    inputBuffer = Buffer.from(parsed.base64Data, "base64");
  } catch {
    return {
      status: STATUS.INVALID,
      normalizedDataUrl: null,
      reason: "invalid_base64_payload",
      recovered: false,
    };
  }

  if (!inputBuffer.length) {
    return {
      status: STATUS.INVALID,
      normalizedDataUrl: null,
      reason: "empty_decoded_payload",
      recovered: false,
    };
  }

  try {
    // metadata() validates that the payload is a readable image.
    await sharp(inputBuffer).metadata();
    const pngBuffer = await sharp(inputBuffer).png().toBuffer();
    const normalizedDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const recovered =
      parsed.mimeType !== "image/png" ||
      normalizedInput !== `data:${parsed.mimeType};base64,${parsed.base64Data}`;

    return {
      status: recovered ? STATUS.RECOVERED : STATUS.OK,
      normalizedDataUrl,
      reason: recovered ? "normalized_to_png" : null,
      recovered,
    };
  } catch {
    return {
      status: STATUS.INVALID,
      normalizedDataUrl: null,
      reason: "unreadable_image_payload",
      recovered: false,
    };
  }
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
