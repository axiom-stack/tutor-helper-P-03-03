import axios from 'axios';
import type { AssignmentsApiError } from '../types';

export interface NormalizedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

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
      return {
        message: apiError.message.trim() || fallback,
        code: apiError.code,
        details: apiError.details,
      };
    }

    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return { message: error.message.trim() };
    }

    return { message: fallback };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return { message: error.message.trim() };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return { message: error.trim() };
  }

  return { message: fallback };
}
