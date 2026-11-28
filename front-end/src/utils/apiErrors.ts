import axios from 'axios';
import {
  AI_RATE_LIMIT_MESSAGE,
  CODE_MESSAGES,
  NETWORK_ERROR_MESSAGE,
  STATUS_MESSAGES,
  aiSupportReference,
  describeAiFailure,
  isArabicText,
  translateDetails,
  translateMessage,
  type RawDetail,
} from './errorCatalog';

export interface NormalizedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

const DEFAULT_FALLBACK = 'حدث خطأ غير متوقع. حاول مرة أخرى.';

const TIMEOUT_MESSAGE = STATUS_MESSAGES[408];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Only plain objects count: Error and AxiosError instances also have a
// `message`, but it is raw text that still needs translating.
function isNormalizedApiError(value: unknown): value is NormalizedApiError {
  return (
    isRecord(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    !value.isAxiosError &&
    !value.response &&
    typeof value.message === 'string' &&
    isArabicText(value.message)
  );
}

function includesRateLimitSignal(value: string): boolean {
  return /rate[ _]limit|limit reached|too many requests|tokens per minute|\b429\b/i.test(
    value
  );
}

function detailIndicatesAiRateLimit(detail: unknown): boolean {
  if (!isRecord(detail) || detail.code === 'llm_request_id') {
    return false;
  }

  const code = typeof detail.code === 'string' ? detail.code : '';
  const message = typeof detail.message === 'string' ? detail.message : '';

  return includesRateLimitSignal(code) || includesRateLimitSignal(message);
}

export function getLocalizedAiLimitMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return includesRateLimitSignal(error) ? AI_RATE_LIMIT_MESSAGE : null;
  }

  if (!isRecord(error)) {
    return null;
  }

  const directMessage = typeof error.message === 'string' ? error.message : '';
  if (includesRateLimitSignal(directMessage)) {
    return AI_RATE_LIMIT_MESSAGE;
  }

  const directCode = typeof error.code === 'string' ? error.code : '';
  if (includesRateLimitSignal(directCode)) {
    return AI_RATE_LIMIT_MESSAGE;
  }

  if (
    Array.isArray(error.details) &&
    error.details.some(detailIndicatesAiRateLimit)
  ) {
    return AI_RATE_LIMIT_MESSAGE;
  }

  if (isRecord(error.error)) {
    return getLocalizedAiLimitMessage(error.error);
  }

  if (isRecord(error.response) && isRecord(error.response.data)) {
    return getLocalizedAiLimitMessage(error.response.data);
  }

  return null;
}

/** "What failed" (the caller's fallback) followed by "why / what to do". */
function withReason(fallback: string, reason: string | undefined): string {
  if (!reason || fallback === DEFAULT_FALLBACK) {
    return reason || fallback;
  }
  return `${fallback.trim().replace(/[.。]?$/, '.')} ${reason}`;
}

function normalizeResponseError(
  status: number,
  data: unknown,
  fallback: string
): NormalizedApiError {
  // The API answers with {error: {code, message, details}}, {error: "text"}
  // or {message}. Hosting-level failures send HTML or nothing at all.
  const body = isRecord(data) ? data : {};
  const nested = isRecord(body.error) ? body.error : null;
  const rawCode = nested?.code ?? body.code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const rawText = nested?.message ?? body.error ?? body.message;
  const rawMessage = typeof rawText === 'string' ? rawText : '';
  const rawDetails = (
    Array.isArray(nested?.details) ? nested.details : []
  ) as RawDetail[];

  if (code === 'llm_generation_failed') {
    const reference = aiSupportReference(rawDetails);
    return {
      code,
      message: [withReason(fallback, describeAiFailure(rawDetails)), reference]
        .filter(Boolean)
        .join(' '),
    };
  }

  // Objective classification also calls the AI; when it hits the usage limit,
  // say so instead of asking the teacher to reword the objectives.
  if (
    code === 'objective_classification_failed' &&
    getLocalizedAiLimitMessage(nested)
  ) {
    return { code, message: withReason(fallback, AI_RATE_LIMIT_MESSAGE) };
  }

  const translated = translateMessage(rawMessage);
  // A specific Arabic message from the server beats the generic code wording.
  const reason =
    (isArabicText(rawMessage) ? translated : null) ??
    (code ? CODE_MESSAGES[code] : undefined) ??
    translated;
  const details = translateDetails(rawDetails);

  return {
    code,
    message:
      reason ??
      withReason(
        fallback,
        STATUS_MESSAGES[status] ??
          (status >= 500 ? STATUS_MESSAGES[500] : undefined)
      ),
    details: details.length > 0 ? details : undefined,
  };
}

/** One string for toasts and inline errors: the message plus its first details. */
export function getErrorText(error: unknown, fallback?: string): string {
  const { message, details } = normalizeApiError(error, fallback);
  const lines = (Array.isArray(details) ? details : [])
    .map((item) => (isRecord(item) ? String(item.message ?? '') : ''))
    .filter(Boolean)
    .slice(0, 3);
  return lines.length > 0 ? `${message} ${lines.join(' ')}` : message;
}

export function normalizeApiError(
  error: unknown,
  fallback = DEFAULT_FALLBACK
): NormalizedApiError {
  if (isNormalizedApiError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    if (error.response) {
      return normalizeResponseError(
        error.response.status,
        error.response.data,
        fallback
      );
    }

    const timedOut =
      error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return {
      message: withReason(
        fallback,
        timedOut ? TIMEOUT_MESSAGE : NETWORK_ERROR_MESSAGE
      ),
      code: error.code,
    };
  }

  const raw =
    typeof error === 'string'
      ? error
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : '';

  const localizedAiLimitMessage = getLocalizedAiLimitMessage(raw);
  if (localizedAiLimitMessage) {
    return { message: localizedAiLimitMessage };
  }

  if (/network error|failed to fetch/i.test(raw)) {
    return { message: withReason(fallback, NETWORK_ERROR_MESSAGE) };
  }

  return { message: translateMessage(raw) ?? fallback };
}
