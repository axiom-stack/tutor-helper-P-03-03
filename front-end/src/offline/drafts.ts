import { getOfflineDb } from './db';
import type { OfflineDraftRecord, OfflineEntityType } from './types';
import { nowIso } from './utils';

export async function saveDraft<T>(input: {
  entityType: OfflineEntityType;
  recordLocalId: string;
  routeKey: string;
  payload: T;
  source?: OfflineDraftRecord['source'];
}) {
  const db = await getOfflineDb();
  const draftId = `${input.routeKey}:${input.recordLocalId}`;
  const record: OfflineDraftRecord<T> = {
    draft_id: draftId,
    entity_type: input.entityType,
    record_local_id: input.recordLocalId,
    route_key: input.routeKey,
    payload: input.payload,
    source: input.source ?? 'autosave',
    updated_at: nowIso(),
  };
  await db.put('drafts', record);
  return record;
}

export async function getDraft<T>(routeKey: string, recordLocalId: string) {
  const db = await getOfflineDb();
  return (await db.get('drafts', `${routeKey}:${recordLocalId}`)) as
    | OfflineDraftRecord<T>
    | undefined;
}

export async function clearDraft(routeKey: string, recordLocalId: string) {
  const db = await getOfflineDb();
  await db.delete('drafts', `${routeKey}:${recordLocalId}`);
}

