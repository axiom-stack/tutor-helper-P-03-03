import type { Assignment } from '../types';
import type { OfflineAssignmentRecord } from './types';
import { getOfflineDb } from './db';
import { bumpRevision, cloneJson, createLocalId, dispatchOfflineRecordsChanged, nowIso } from './utils';

function withAssignmentMeta(
  assignment: Assignment,
  existing?: OfflineAssignmentRecord | null
): OfflineAssignmentRecord {
  return {
    ...assignment,
    local_id: existing?.local_id ?? createLocalId('assignment'),
    server_id: assignment.public_id,
    sync_status: existing?.sync_status === 'pending_sync' || existing?.sync_status === 'conflict'
      ? existing.sync_status
      : 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: assignment.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: existing?.last_sync_error ?? null,
  };
}

export async function getCachedAssignments() {
  const db = await getOfflineDb();
  const items = (await db.getAll('assignments')) as OfflineAssignmentRecord[];
  return items.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function getCachedAssignmentById(id: string) {
  const db = await getOfflineDb();
  const direct = (await db.get('assignments', id)) as OfflineAssignmentRecord | undefined;
  if (direct) {
    return direct;
  }

  const byPublic = await db.getFromIndex('assignments', 'by_public_id', id);
  return (byPublic as OfflineAssignmentRecord | undefined) ?? null;
}

export async function cacheAssignments(assignments: Assignment[]) {
  const db = await getOfflineDb();
  for (const assignment of assignments) {
    const existing = await getCachedAssignmentById(assignment.public_id);
    await db.put('assignments', withAssignmentMeta(assignment, existing));
  }
  dispatchOfflineRecordsChanged();
}

export async function cacheAssignment(assignment: Assignment) {
  const existing = await getCachedAssignmentById(assignment.public_id);
  const next = withAssignmentMeta(assignment, existing);
  const db = await getOfflineDb();
  await db.put('assignments', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function saveAssignmentOffline(input: {
  id: string;
  payload: Pick<Assignment, 'name' | 'description' | 'type' | 'content'>;
}) {
  const existing = await getCachedAssignmentById(input.id);
  if (!existing) {
    throw new Error('تعذر العثور على الواجب محليًا.');
  }

  const timestamp = nowIso();
  const next: OfflineAssignmentRecord = {
    ...existing,
    ...cloneJson(input.payload),
    updated_at: timestamp,
    sync_status: existing.server_id ? 'pending_sync' : 'local_only',
    local_revision: bumpRevision(existing.local_revision),
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('assignments', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function replaceAssignmentFromServer(localId: string, assignment: Assignment) {
  const db = await getOfflineDb();
  const existing = (await db.get('assignments', localId)) as OfflineAssignmentRecord | undefined;
  const next: OfflineAssignmentRecord = {
    ...assignment,
    local_id: existing?.local_id ?? localId,
    server_id: assignment.public_id,
    sync_status: 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: assignment.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: null,
  };
  await db.put('assignments', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markAssignmentConflict(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('assignments', localId)) as OfflineAssignmentRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineAssignmentRecord = {
    ...existing,
    sync_status: 'conflict',
    last_sync_error: message,
  };
  await db.put('assignments', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markAssignmentSyncError(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('assignments', localId)) as OfflineAssignmentRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineAssignmentRecord = {
    ...existing,
    sync_status: 'sync_error',
    last_sync_error: message,
  };
  await db.put('assignments', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function duplicateAssignmentLocally(id: string) {
  const source = await getCachedAssignmentById(id);
  if (!source) {
    throw new Error('تعذر نسخ الواجب محليًا.');
  }

  const timestamp = nowIso();
  const localId = createLocalId('assignment');
  const duplicate: OfflineAssignmentRecord = {
    ...cloneJson(source),
    public_id: localId,
    local_id: localId,
    server_id: null,
    origin_server_id: source.server_id ?? source.public_id,
    sync_status: 'local_only',
    local_revision: 1,
    name: `${source.name} (نسخة محلية)`,
    created_at: timestamp,
    updated_at: timestamp,
    server_updated_at: null,
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('assignments', duplicate);
  dispatchOfflineRecordsChanged();
  return duplicate;
}

