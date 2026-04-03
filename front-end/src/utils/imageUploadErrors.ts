import axios from 'axios';
import { normalizeApiError } from './apiErrors';

const DEFAULT_IMAGE_UPLOAD_MESSAGE =
  'تعذر رفع الصورة. حاول مرة أخرى.';

const INVALID_IMAGE_MESSAGE =
  'الصورة المرسلة غير صالحة. اختر صورة أخرى.';

const UNSUPPORTED_IMAGE_MESSAGE =
  'نوع الصورة غير مدعوم. استخدم PNG أو JPG أو WEBP.';

const IMAGE_READ_FAILED_MESSAGE =
  'تعذر قراءة الصورة. ربما الملف تالف أو غير مدعوم.';

const IMAGE_CORRUPT_MESSAGE =
  'الصورة تالفة أو غير قابلة للقراءة.';

const IMAGE_TIMEOUT_MESSAGE =
  'انتهت مهلة رفع الصورة. حاول مرة أخرى.';

const IMAGE_NETWORK_MESSAGE =
  'تعذر الاتصال بالخادم أثناء رفع الصورة. تحقق من الإنترنت ثم أعد المحاولة.';

const IMAGE_TOO_LARGE_MESSAGE =
  'حجم الصورة كبير جدًا. اختر صورة أصغر.';

const IMAGE_CANCELLED_MESSAGE =
  'تم إلغاء رفع الصورة.';

const IMAGE_PERMISSION_MESSAGE =
  'ليس لديك صلاحية لرفع هذه الصورة.';

const IMAGE_CONFLICT_MESSAGE =
  'يوجد تعارض في بيانات الصورة. حاول مرة أخرى.';

const IMAGE_UNEXPECTED_FILE_MESSAGE =
  'تم إرسال ملف غير متوقع. أعد المحاولة.';

const IMAGE_SERVER_ERROR_MESSAGE =
  'حدث خطأ في الخادم أثناء رفع الصورة. حاول لاحقًا.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function includesAny(message: string, phrases: string[]): boolean {
  return phrases.some((phrase) => message.includes(phrase));
}

function isCodeLikeString(value: string): boolean {
  return /^[A-Z0-9_.:-]+$/u.test(value);
}

function extractUploadSignal(error: unknown): {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
} {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const status = error.response?.status;

    if (isRecord(responseData)) {
      const nestedError = isRecord(responseData.error) ? responseData.error : null;

      const code =
        (typeof nestedError?.code === 'string' && nestedError.code) ||
        (typeof responseData.code === 'string' && responseData.code) ||
        (typeof error.code === 'string' && error.code) ||
        undefined;

      const message =
        (typeof nestedError?.message === 'string' && nestedError.message) ||
        (typeof responseData.message === 'string' && responseData.message) ||
        (typeof responseData.error === 'string' && responseData.error) ||
        error.message;

      return {
        code: code || (typeof responseData.error === 'string' && isCodeLikeString(responseData.error)
          ? responseData.error
          : undefined),
        message,
        status,
      };
    }

    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: error.message,
      status,
    };
  }

  if (error instanceof Error) {
    const code =
      typeof (error as Error & { code?: unknown }).code === 'string'
        ? (error as Error & { code: string }).code
        : undefined;
    return {
      code,
      message: error.message,
      name: error.name,
    };
  }

  if (isRecord(error)) {
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message:
        typeof error.message === 'string'
          ? error.message
          : typeof error.error === 'string'
            ? error.error
            : undefined,
      status: typeof error.status === 'number' ? error.status : undefined,
      name: typeof error.name === 'string' ? error.name : undefined,
    };
  }

  if (typeof error === 'string') {
    return isCodeLikeString(error) ? { code: error, message: error } : { message: error };
  }

  return {};
}

function localizeKnownUploadIssue(signal: {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}): string | null {
  const code = signal.code?.trim() ?? '';
  const message = signal.message?.trim() ?? '';
  const normalizedMessage = message.toLowerCase();
  const name = signal.name?.trim() ?? '';
  const status = signal.status;

  if (code === 'PAYLOAD_TOO_LARGE' || code === 'LIMIT_FILE_SIZE' || status === 413) {
    return IMAGE_TOO_LARGE_MESSAGE;
  }

  if (code === 'LIMIT_FILE_COUNT') {
    return 'عدد الملفات المرسلة أكبر من المسموح. أرسل ملف صورة واحدًا فقط.';
  }

  if (code === 'LIMIT_PART_COUNT') {
    return 'عدد أجزاء الطلب كبير جدًا. حاول مرة أخرى.';
  }

  if (code === 'LIMIT_FIELD_COUNT') {
    return 'عدد الحقول المرسلة أكبر من المسموح. حاول مرة أخرى.';
  }

  if (code === 'LIMIT_FIELD_KEY') {
    return 'اسم أحد الحقول غير صالح. حاول مرة أخرى.';
  }

  if (code === 'LIMIT_FIELD_VALUE') {
    return 'قيمة أحد الحقول غير صالحة. حاول مرة أخرى.';
  }

  if (
    code === 'INVALID_IMAGE_TYPE' ||
    code === 'UNSUPPORTED_IMAGE_TYPE' ||
    code === 'UNSUPPORTED_MEDIA_TYPE' ||
    status === 415 ||
    includesAny(normalizedMessage, [
      'unsupported media type',
      'not supported',
      'image/*',
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
    ])
  ) {
    return UNSUPPORTED_IMAGE_MESSAGE;
  }

  if (
    code === 'INVALID_IMAGE_DATA_URL' ||
    code === 'IMAGE_DATA_URL_INVALID' ||
    code === 'IMAGE_DATA_URL_REQUIRED' ||
    includesAny(normalizedMessage, [
      'base64 image data url',
      'school_logo_url',
      'data url',
      'image data url',
      'not a valid image',
      'invalid image',
    ])
  ) {
    return INVALID_IMAGE_MESSAGE;
  }

  if (
    code === 'IMAGE_FILE_TOO_LARGE' ||
    includesAny(normalizedMessage, [
      'file size exceeds',
      'file too large',
      'too large',
      'exceeds the',
      'payload too large',
    ])
  ) {
    return IMAGE_TOO_LARGE_MESSAGE;
  }

  if (
    code === 'IMAGE_READ_FAILED' ||
    name === 'NotReadableError' ||
    includesAny(normalizedMessage, [
      'not readable',
      'failed to read',
      'read error',
      'cannot read',
    ])
  ) {
    return IMAGE_READ_FAILED_MESSAGE;
  }

  if (
    code === 'IMAGE_CORRUPT' ||
    includesAny(normalizedMessage, [
      'corrupt',
      'damaged',
      'broken',
      'unrecognized image',
      'cannot identify image',
    ])
  ) {
    return IMAGE_CORRUPT_MESSAGE;
  }

  if (
    code === 'IMAGE_ENCODING_ERROR' ||
    name === 'EncodingError' ||
    includesAny(normalizedMessage, ['encoding error', 'failed to encode'])
  ) {
    return 'تعذر ترميز الصورة. حاول بصورة أخرى.';
  }

  if (
    code === 'IMAGE_SECURITY_ERROR' ||
    name === 'SecurityError' ||
    includesAny(normalizedMessage, ['security error', 'blocked by browser'])
  ) {
    return 'حظر المتصفح هذه العملية. حاول بصورة أخرى.';
  }

  if (
    code === 'IMAGE_QUOTA_EXCEEDED' ||
    name === 'QuotaExceededError' ||
    includesAny(normalizedMessage, ['quota exceeded', 'no space left'])
  ) {
    return 'لا توجد مساحة كافية لإكمال العملية.';
  }

  if (
    code === 'IMAGE_TYPE_MISMATCH' ||
    name === 'TypeMismatchError' ||
    includesAny(normalizedMessage, ['type mismatch', 'mismatch'])
  ) {
    return INVALID_IMAGE_MESSAGE;
  }

  if (
    code === 'IMAGE_DIMENSIONS_TOO_SMALL' ||
    includesAny(normalizedMessage, ['too small', 'minimum width', 'minimum height'])
  ) {
    return 'أبعاد الصورة صغيرة جدًا. اختر صورة أكبر.';
  }

  if (
    code === 'IMAGE_DIMENSIONS_TOO_LARGE' ||
    includesAny(normalizedMessage, ['too big', 'too wide', 'too tall', 'maximum width', 'maximum height'])
  ) {
    return 'أبعاد الصورة كبيرة جدًا. اختر صورة أصغر.';
  }

  if (
    code === 'IMAGE_TIMEOUT' ||
    status === 408 ||
    includesAny(normalizedMessage, ['timeout', 'timed out', 'network timeout'])
  ) {
    return IMAGE_TIMEOUT_MESSAGE;
  }

  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    includesAny(normalizedMessage, ['network error', 'failed to fetch', 'connection refused'])
  ) {
    return IMAGE_NETWORK_MESSAGE;
  }

  if (code === 'ECONNABORTED') {
    return IMAGE_TIMEOUT_MESSAGE;
  }

  if (code === 'ERR_CANCELED' || name === 'AbortError') {
    return IMAGE_CANCELLED_MESSAGE;
  }

  if (code === 'LIMIT_UNEXPECTED_FILE') {
    return IMAGE_UNEXPECTED_FILE_MESSAGE;
  }

  if (code === 'IMAGE_PERMISSION_DENIED' || status === 403) {
    return IMAGE_PERMISSION_MESSAGE;
  }

  if (status === 404) {
    return 'المورد المطلوب غير موجود.';
  }

  if (status === 409) {
    return IMAGE_CONFLICT_MESSAGE;
  }

  if (status === 429) {
    return 'محاولات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة.';
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return IMAGE_SERVER_ERROR_MESSAGE;
  }

  if (status === 400 && includesAny(normalizedMessage, ['file upload failed', 'upload failed'])) {
    return DEFAULT_IMAGE_UPLOAD_MESSAGE;
  }

  return null;
}

export function normalizeImageUploadError(
  error: unknown,
  fallback = DEFAULT_IMAGE_UPLOAD_MESSAGE
): string {
  const uploadMessage = localizeKnownUploadIssue(extractUploadSignal(error));
  if (uploadMessage) {
    return uploadMessage;
  }

  return normalizeApiError(error, fallback).message;
}
