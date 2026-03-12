import axios from 'axios';
import type { AssignmentsApiError } from '../types';

export interface NormalizedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export const AI_FREE_TIER_LIMIT_MESSAGE =
  'تعذر تنفيذ الطلب الآن لأن الباقة المجانية لخدمة الذكاء الاصطناعي وصلت إلى حدها المؤقت. يرجى الانتظار قليلًا ثم إعادة المحاولة.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNormalizedApiError(value: unknown): value is NormalizedApiError {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0
  );
}

function extractAssignmentsApiError(
  payload: unknown
): AssignmentsApiError['error'] | null {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  const code = payload.error.code;
  const message = payload.error.message;
  const details = payload.error.details;

  if (typeof code !== 'string' || typeof message !== 'string') {
    return null;
  }

  return {
    code,
    message,
    details: Array.isArray(details) ? details : undefined,
  };
}

function includesRateLimitSignal(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('rate limit') ||
    normalized.includes('limit reached') ||
    normalized.includes('too many requests') ||
    normalized.includes('tokens per minute') ||
    normalized.includes('requested') && normalized.includes('try again in') ||
    normalized.includes('rate_limit') ||
    normalized.includes('429')
  );
}

function detailIndicatesAiRateLimit(detail: unknown): boolean {
  if (!isRecord(detail)) {
    return false;
  }

  const code = typeof detail.code === 'string' ? detail.code : '';
  const message = typeof detail.message === 'string' ? detail.message : '';

  return includesRateLimitSignal(code) || includesRateLimitSignal(message);
}

export function getLocalizedAiLimitMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return includesRateLimitSignal(error) ? AI_FREE_TIER_LIMIT_MESSAGE : null;
  }

  if (!isRecord(error)) {
    return null;
  }

  const directMessage =
    typeof error.message === 'string' ? error.message : '';
  if (includesRateLimitSignal(directMessage)) {
    return AI_FREE_TIER_LIMIT_MESSAGE;
  }

  const directCode = typeof error.code === 'string' ? error.code : '';
  if (includesRateLimitSignal(directCode)) {
    return AI_FREE_TIER_LIMIT_MESSAGE;
  }

  if (Array.isArray(error.details) && error.details.some(detailIndicatesAiRateLimit)) {
    return AI_FREE_TIER_LIMIT_MESSAGE;
  }

  if (isRecord(error.error)) {
    return getLocalizedAiLimitMessage(error.error);
  }

  if (isRecord(error.response) && isRecord(error.response.data)) {
    return getLocalizedAiLimitMessage(error.response.data);
  }

  return null;
}

export function normalizeApiError(
  error: unknown,
  fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'
): NormalizedApiError {
  if (isNormalizedApiError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const apiError = extractAssignmentsApiError(error.response?.data);
    if (apiError) {
      const localizedAiLimitMessage = getLocalizedAiLimitMessage(apiError);
      return {
        message: localizedAiLimitMessage || apiError.message.trim() || fallback,
        code: apiError.code,
        details: apiError.details,
      };
    }

    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    const rawMessage = typeof error.message === 'string' ? error.message.trim() : '';
    const isGenericStatusMessage = /^request failed with status code \d+$/i.test(rawMessage);
    if (isGenericStatusMessage && error.response?.status === 422) {
      return { message: fallback };
    }
    if (rawMessage.length > 0 && !isGenericStatusMessage) {
      return { message: rawMessage };
    }

    return { message: fallback };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    return { message: error.message.trim() };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    return { message: error.trim() };
  }

  return { message: fallback };
}
