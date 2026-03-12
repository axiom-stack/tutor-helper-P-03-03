import { getOfflineDb } from './db';
import type {
  OfflineEntityType,
  OfflineQueueAction,
  OfflineQueueActionType,
  OfflineQueueStatus,
} from './types';
import { dispatchOfflineQueueChanged, nowIso } from './utils';

async function putQueueRecord(record: OfflineQueueAction) {
  const db = await getOfflineDb();
  await db.put('queue', record);
  dispatchOfflineQueueChanged();
}

export async function enqueueOfflineAction(
  action: Omit<OfflineQueueAction, 'queue_id' | 'status' | 'attempt_count' | 'created_at'>
) {
  const record: OfflineQueueAction = {
    ...action,
    queue_id: `queue_${crypto.randomUUID()}`,
    status: 'pending',
    attempt_count: 0,
    created_at: nowIso(),
  };
  await putQueueRecord(record);
  return record;
}

export async function upsertPendingEntityAction(input: {
  actionType: OfflineQueueActionType;
  entityType: OfflineEntityType;
  targetLocalId?: string | null;
  targetServerId?: string | null;
  requestPayload: OfflineQueueAction['request_payload'];
  baseServerUpdatedAt?: string | null;
  baseLocalRevision?: number | null;
}) {
  const db = await getOfflineDb();
  const all = (await db.getAll('queue')) as OfflineQueueAction[];
  const existing = all.find(
    (item) =>
      item.status === 'pending' &&
      item.action_type === input.actionType &&
      item.target_local_id === (input.targetLocalId ?? null)
  );

  if (existing) {
    existing.request_payload = input.requestPayload;
    existing.base_server_updated_at = input.baseServerUpdatedAt ?? null;
    existing.base_local_revision = input.baseLocalRevision ?? null;
    existing.last_error = null;
    existing.next_retry_at = null;
    await putQueueRecord(existing);
    return existing;
  }

  return enqueueOfflineAction({
    action_type: input.actionType,
    entity_type: input.entityType,
    target_local_id: input.targetLocalId ?? null,
    target_server_id: input.targetServerId ?? null,
    request_payload: input.requestPayload,
    base_server_updated_at: input.baseServerUpdatedAt ?? null,
    base_local_revision: input.baseLocalRevision ?? null,
    last_error: null,
    next_retry_at: null,
  });
}

export async function listQueueActionsByStatus(
  status: OfflineQueueStatus | OfflineQueueStatus[]
) {
  const db = await getOfflineDb();
  const values = (await db.getAll('queue')) as OfflineQueueAction[];
  const statuses = new Set(Array.isArray(status) ? status : [status]);
  return values
    .filter((item) => statuses.has(item.status))
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export async function getPendingQueueCount() {
  const pending = await listQueueActionsByStatus(['pending', 'processing', 'failed']);
  return pending.length;
}

export async function markQueueActionStatus(
  queueId: string,
  status: OfflineQueueStatus,
  extras: Partial<OfflineQueueAction> = {}
) {
  const db = await getOfflineDb();
  const record = (await db.get('queue', queueId)) as OfflineQueueAction | undefined;
  if (!record) {
    return null;
  }

  const next: OfflineQueueAction = {
    ...record,
    ...extras,
    status,
  };
  await putQueueRecord(next);
  return next;
}

export async function deleteCompletedQueueActions() {
  const db = await getOfflineDb();
  const all = (await db.getAll('queue')) as OfflineQueueAction[];
  const completed = all.filter((item) => item.status === 'completed');
  await Promise.all(completed.map((item) => db.delete('queue', item.queue_id)));
  if (completed.length > 0) {
    dispatchOfflineQueueChanged();
  }
}

