import axios from 'axios';
import type { AssignmentsApiError } from '../types';

export interface NormalizedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export const AI_FREE_TIER_LIMIT_MESSAGE =
  'تعذر تنفيذ الطلب الآن لأن الباقة المجانية لخدمة الذكاء الاصطناعي وصلت إلى حدها المؤقت. يرجى الانتظار قليلًا ثم إعادة المحاولة.';

const NETWORK_ERROR_MESSAGE =
  'تعذر الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت ثم إعادة المحاولة.';

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
    (normalized.includes('requested') && normalized.includes('try again in')) ||
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

function localizeBackendMessage(
  rawMessage: string,
  fallback: string,
  status?: number
): string {
  const message = rawMessage.trim();
  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes('username already exists') ||
    normalized.includes('duplicate username')
  ) {
    return 'اسم المستخدم مستخدم بالفعل. يرجى اختيار اسم مستخدم آخر.';
  }

  if (
    normalized.includes('invalid credentials') ||
    normalized.includes('unauthorized')
  ) {
    return 'بيانات الدخول غير صحيحة أو انتهت جلسة العمل.';
  }

  if (normalized.includes('network error')) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (status === 409) {
    return 'تعذر تنفيذ العملية لأن البيانات موجودة مسبقًا. يرجى مراجعة البيانات والمحاولة مرة أخرى.';
  }
  if (status === 401) {
    return 'بيانات الدخول غير صحيحة أو انتهت جلسة العمل.';
  }
  if (status === 403) {
    return 'ليس لديك صلاحية للوصول إلى هذا المورد.';
  }
  if (status === 404) {
    return 'المورد المطلوب غير موجود.';
  }
  if (status === 422) {
    return fallback;
  }
  if (status === 500) {
    return 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً.';
  }

  return fallback;
}

export function getLocalizedAiLimitMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return includesRateLimitSignal(error) ? AI_FREE_TIER_LIMIT_MESSAGE : null;
  }

  if (!isRecord(error)) {
    return null;
  }

  const directMessage = typeof error.message === 'string' ? error.message : '';
  if (includesRateLimitSignal(directMessage)) {
    return AI_FREE_TIER_LIMIT_MESSAGE;
  }

  const directCode = typeof error.code === 'string' ? error.code : '';
  if (includesRateLimitSignal(directCode)) {
    return AI_FREE_TIER_LIMIT_MESSAGE;
  }

  if (
    Array.isArray(error.details) &&
    error.details.some(detailIndicatesAiRateLimit)
  ) {
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
    const status = error.response?.status;
    const apiError = extractAssignmentsApiError(error.response?.data);
    if (apiError) {
      const localizedAiLimitMessage = getLocalizedAiLimitMessage(apiError);
      return {
        message:
          localizedAiLimitMessage ||
          localizeBackendMessage(apiError.message, fallback, status),
        code: apiError.code,
        details: apiError.details,
      };
    }

    // Handle generic axios errors with status codes
    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as Record<string, unknown>;
      if (typeof data.error === 'string' && data.error.trim().length > 0) {
        return {
          message: localizeBackendMessage(data.error, fallback, status),
        };
      }
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return {
          message: localizeBackendMessage(data.message, fallback, status),
        };
      }
    }

    if (status === 401) {
      return { message: 'بيانات الدخول غير صحيحة أو انتهت جلسة العمل' };
    }
    if (status === 403) {
      return { message: 'ليس لديك صلاحية للوصول إلى هذا المورد' };
    }
    if (status === 404) {
      return { message: 'المورد المطلوب غير موجود.' };
    }
    if (status === 409) {
      return {
        message:
          'تعذر تنفيذ العملية لأن البيانات موجودة مسبقًا. يرجى مراجعة البيانات والمحاولة مرة أخرى.',
      };
    }
    if (status === 500) {
      return { message: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً' };
    }

    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    const rawMessage =
      typeof error.message === 'string' ? error.message.trim() : '';
    const isGenericStatusMessage =
      /^request failed with status code \d+$/i.test(rawMessage);

    // Handle generic status messages for specific status codes
    if (isGenericStatusMessage) {
      if (error.response?.status === 401) {
        return { message: 'بيانات الدخول غير صحيحة أو انتهت جلسة العمل' };
      }
      if (error.response?.status === 422) {
        return { message: fallback };
      }
      // For other status codes, return a generic error
      if (error.response?.status) {
        return { message: fallback };
      }
    }

    if (rawMessage.length > 0 && !isGenericStatusMessage) {
      return { message: localizeBackendMessage(rawMessage, fallback, status) };
    }

    return { message: fallback };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    return {
      message: localizeBackendMessage(error.message, fallback),
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
    if (localizedAiLimitMessage) {
      return { message: localizedAiLimitMessage };
    }

    return {
      message: localizeBackendMessage(error, fallback),
    };
  }

  return { message: fallback };
}
