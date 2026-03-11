import type { PlanType } from '../../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '—';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    const candidateKeys = [
      'text',
      'objective',
      'description',
      'name',
      'question',
      'content',
      'title',
      'value',
    ];

    for (const key of candidateKeys) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    const entries = Object.entries(value)
      .map(([key, itemValue]) => {
        if (typeof itemValue === 'string' || typeof itemValue === 'number') {
          return `${key}: ${itemValue}`;
        }

        if (Array.isArray(itemValue)) {
          return `${key}: ${itemValue.map((item) => toDisplayText(item)).join('، ')}`;
        }

        if (isRecord(itemValue)) {
          return `${key}: ${JSON.stringify(itemValue)}`;
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));

    return entries.length > 0 ? entries.join(' | ') : '—';
  }

  return '—';
}

export function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => toDisplayText(item)).filter((item) => item !== '—');
}

export function toActivityTypeLabel(value: unknown): string {
  const normalized = toDisplayText(value).toLowerCase();
  if (normalized === 'intro') return 'تمهيد';
  if (normalized === 'presentation') return 'عرض';
  if (normalized === 'activity') return 'نشاط';
  if (normalized === 'assessment') return 'تقويم';
  return toDisplayText(value);
}

export function toPlanTypeLabel(value: PlanType): string {
  return value === 'traditional' ? 'تقليدية' : 'تعلم نشط';
}

export function toValidationStatusLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'passed') return 'ناجح';
  if (normalized === 'failed') return 'فشل';
  return value;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
