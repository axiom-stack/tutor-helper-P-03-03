import { UNIT_OPTIONS } from '../constants/dropdown-options';

function normalizeUnitText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeOrdinalText(value: string): string {
  if (value.startsWith('الوحدة ')) {
    return value.slice('الوحدة '.length).trim();
  }
  return value;
}

function unitOrdinalFromValue(value: string): string {
  const parsedNumber = Number(value);
  if (Number.isInteger(parsedNumber) && parsedNumber > 0) {
    return UNIT_OPTIONS[parsedNumber - 1] ?? value;
  }

  return normalizeOrdinalText(value);
}

export function formatUnitOrdinalText(value: string | null | undefined): string {
  const normalized = normalizeUnitText(value);
  if (!normalized) {
    return '—';
  }

  return unitOrdinalFromValue(normalized);
}

export function formatUnitDisplayLabel(value: string | null | undefined): string {
  const ordinal = formatUnitOrdinalText(value);
  return ordinal === '—' ? 'الوحدة' : `الوحدة ${ordinal}`;
}
