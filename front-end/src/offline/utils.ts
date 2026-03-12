import type { OfflineEntityType, OfflineSyncStatus } from './types';

const LOCAL_PREFIX_MAP: Record<OfflineEntityType, string> = {
  lesson_plan: 'locpln',
  assignment: 'locasn',
  exam: 'locexm',
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function createLocalId(entityType: OfflineEntityType): string {
  return `${LOCAL_PREFIX_MAP[entityType]}_${crypto.randomUUID()}`;
}

export function isLocalOnlyId(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^(locpln|locasn|locexm)_/u.test(value);
}

export function toServerId(value: string | null | undefined): string | null {
  if (!value || isLocalOnlyId(value)) {
    return null;
  }
  return value;
}

export function getSyncStatusLabel(status: OfflineSyncStatus): string {
  switch (status) {
    case 'pending_sync':
      return 'محفوظ محليًا';
    case 'queued_generation':
      return 'بانتظار التوليد';
    case 'queued_ai':
      return 'بانتظار الذكاء';
    case 'local_only':
      return 'نسخة محلية';
    case 'conflict':
      return 'تعارض';
    case 'sync_error':
      return 'فشل المزامنة';
    case 'synced':
    default:
      return 'متزامن';
  }
}

export function bumpRevision(current: number | null | undefined): number {
  return Math.max(0, current ?? 0) + 1;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function dispatchOfflineQueueChanged() {
  window.dispatchEvent(new Event('offline-queue-changed'));
}

export function dispatchOfflineRecordsChanged() {
  window.dispatchEvent(new Event('offline-records-changed'));
}

export function dispatchOfflineSyncCompleted() {
  window.dispatchEvent(new Event('offline-sync-complete'));
}

