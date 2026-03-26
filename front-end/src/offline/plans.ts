import type { LessonPlanRecord } from '../types';
import type { OfflineLessonPlanRecord } from './types';
import { getOfflineDb } from './db';
import { bumpRevision, cloneJson, createLocalId, dispatchOfflineRecordsChanged, nowIso } from './utils';

function withPlanMeta(
  plan: LessonPlanRecord,
  existing?: OfflineLessonPlanRecord | null
): OfflineLessonPlanRecord {
  // When storing server data (from GET or successful PUT), we always mark as synced.
  return {
    ...plan,
    plan_json: cloneJson(plan.plan_json ?? {}),
    local_id: existing?.local_id ?? createLocalId('lesson_plan'),
    server_id: plan.public_id,
    sync_status: 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: plan.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: null,
  };
}

export async function getCachedPlans(): Promise<OfflineLessonPlanRecord[]> {
  const db = await getOfflineDb();
  const plans = (await db.getAll('plans')) as OfflineLessonPlanRecord[];
  return plans.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function getCachedPlanById(id: string) {
  const db = await getOfflineDb();
  const direct = (await db.get('plans', id)) as OfflineLessonPlanRecord | undefined;
  if (direct) {
    return direct;
  }

  const byPublic = await db.getFromIndex('plans', 'by_public_id', id);
  return (byPublic as OfflineLessonPlanRecord | undefined) ?? null;
}

export async function cachePlan(plan: LessonPlanRecord) {
  const existing = await getCachedPlanById(plan.public_id);
  const next = withPlanMeta(plan, existing);
  const db = await getOfflineDb();
  await db.put('plans', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function cachePlans(plans: LessonPlanRecord[]) {
  const db = await getOfflineDb();
  for (const plan of plans) {
    const existing = await getCachedPlanById(plan.public_id);
    const next = withPlanMeta(plan, existing);
    await db.put('plans', next);
  }
  dispatchOfflineRecordsChanged();
}

export async function savePlanOffline(input: {
  id: string;
  lesson_title: string;
  plan_json: Record<string, unknown>;
}) {
  const existing = await getCachedPlanById(input.id);
  if (!existing) {
    throw new Error('تعذر العثور على الخطة محليًا.');
  }

  const timestamp = nowIso();
  const next: OfflineLessonPlanRecord = {
    ...existing,
    lesson_title: input.lesson_title,
    plan_json: cloneJson(input.plan_json),
    updated_at: timestamp,
    sync_status: existing.server_id ? 'pending_sync' : 'local_only',
    local_revision: bumpRevision(existing.local_revision),
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('plans', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function replacePlanFromServer(
  localId: string,
  serverPlan: LessonPlanRecord
) {
  const db = await getOfflineDb();
  const existing = (await db.get('plans', localId)) as OfflineLessonPlanRecord | undefined;
  const next: OfflineLessonPlanRecord = {
    ...serverPlan,
    local_id: existing?.local_id ?? localId,
    server_id: serverPlan.public_id,
    sync_status: 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: serverPlan.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: null,
  };
  await db.put('plans', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markPlanConflict(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('plans', localId)) as OfflineLessonPlanRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineLessonPlanRecord = {
    ...existing,
    sync_status: 'conflict',
    last_sync_error: message,
  };
  await db.put('plans', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markPlanSyncError(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('plans', localId)) as OfflineLessonPlanRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineLessonPlanRecord = {
    ...existing,
    sync_status: 'sync_error',
    last_sync_error: message,
  };
  await db.put('plans', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function duplicatePlanLocally(id: string) {
  const source = await getCachedPlanById(id);
  if (!source) {
    throw new Error('تعذر نسخ الخطة محليًا.');
  }

  const timestamp = nowIso();
  const localId = createLocalId('lesson_plan');
  const duplicate: OfflineLessonPlanRecord = {
    ...cloneJson(source),
    public_id: localId,
    local_id: localId,
    server_id: null,
    origin_server_id: source.server_id ?? source.public_id,
    sync_status: 'local_only',
    local_revision: 1,
    lesson_title: `${source.lesson_title} (نسخة محلية)`,
    created_at: timestamp,
    updated_at: timestamp,
    server_updated_at: null,
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('plans', duplicate);
  dispatchOfflineRecordsChanged();
  return duplicate;
}

export async function deletePlanLocally(id: string) {
  const existing = await getCachedPlanById(id);
  if (!existing) {
    return null;
  }

  const db = await getOfflineDb();
  await db.delete('plans', existing.local_id);
  dispatchOfflineRecordsChanged();
  return existing;
}
