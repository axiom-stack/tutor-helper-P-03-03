import type { Exam } from '../types';
import type { OfflineExamRecord } from './types';
import { getOfflineDb } from './db';
import { bumpRevision, cloneJson, createLocalId, dispatchOfflineRecordsChanged, nowIso } from './utils';

function withExamMeta(exam: Exam, existing?: OfflineExamRecord | null): OfflineExamRecord {
  return {
    ...exam,
    questions: cloneJson(exam.questions ?? []),
    blueprint: exam.blueprint ? cloneJson(exam.blueprint) : undefined,
    local_id: existing?.local_id ?? createLocalId('exam'),
    server_id: exam.public_id,
    sync_status: existing?.sync_status === 'pending_sync' || existing?.sync_status === 'conflict'
      ? existing.sync_status
      : 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: exam.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: existing?.last_sync_error ?? null,
  };
}

export async function getCachedExams() {
  const db = await getOfflineDb();
  const items = (await db.getAll('exams')) as OfflineExamRecord[];
  return items.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function getCachedExamById(id: string) {
  const db = await getOfflineDb();
  const direct = (await db.get('exams', id)) as OfflineExamRecord | undefined;
  if (direct) {
    return direct;
  }

  const byPublic = await db.getFromIndex('exams', 'by_public_id', id);
  return (byPublic as OfflineExamRecord | undefined) ?? null;
}

export async function cacheExams(exams: Exam[]) {
  const db = await getOfflineDb();
  for (const exam of exams) {
    const existing = await getCachedExamById(exam.public_id);
    await db.put('exams', withExamMeta(exam, existing));
  }
  dispatchOfflineRecordsChanged();
}

export async function cacheExam(exam: Exam) {
  const existing = await getCachedExamById(exam.public_id);
  const next = withExamMeta(exam, existing);
  const db = await getOfflineDb();
  await db.put('exams', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function saveExamOffline(input: {
  id: string;
  payload: Pick<Exam, 'title'> & { questions: Exam['questions'] };
}) {
  const existing = await getCachedExamById(input.id);
  if (!existing) {
    throw new Error('تعذر العثور على الاختبار محليًا.');
  }

  const timestamp = nowIso();
  const next: OfflineExamRecord = {
    ...existing,
    title: input.payload.title,
    questions: cloneJson(input.payload.questions ?? []),
    updated_at: timestamp,
    sync_status: existing.server_id ? 'pending_sync' : 'local_only',
    local_revision: bumpRevision(existing.local_revision),
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('exams', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function replaceExamFromServer(localId: string, exam: Exam) {
  const db = await getOfflineDb();
  const existing = (await db.get('exams', localId)) as OfflineExamRecord | undefined;
  const next: OfflineExamRecord = {
    ...exam,
    questions: cloneJson(exam.questions ?? []),
    blueprint: exam.blueprint ? cloneJson(exam.blueprint) : undefined,
    local_id: existing?.local_id ?? localId,
    server_id: exam.public_id,
    sync_status: 'synced',
    local_revision: existing?.local_revision ?? 0,
    server_updated_at: exam.updated_at,
    origin_server_id: existing?.origin_server_id ?? null,
    last_sync_error: null,
  };
  await db.put('exams', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markExamConflict(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('exams', localId)) as OfflineExamRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineExamRecord = {
    ...existing,
    sync_status: 'conflict',
    last_sync_error: message,
  };
  await db.put('exams', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function markExamSyncError(localId: string, message: string) {
  const db = await getOfflineDb();
  const existing = (await db.get('exams', localId)) as OfflineExamRecord | undefined;
  if (!existing) {
    return null;
  }
  const next: OfflineExamRecord = {
    ...existing,
    sync_status: 'sync_error',
    last_sync_error: message,
  };
  await db.put('exams', next);
  dispatchOfflineRecordsChanged();
  return next;
}

export async function duplicateExamLocally(id: string) {
  const source = await getCachedExamById(id);
  if (!source) {
    throw new Error('تعذر نسخ الاختبار محليًا.');
  }

  const timestamp = nowIso();
  const localId = createLocalId('exam');
  const duplicate: OfflineExamRecord = {
    ...cloneJson(source),
    public_id: localId,
    local_id: localId,
    server_id: null,
    origin_server_id: source.server_id ?? source.public_id,
    sync_status: 'local_only',
    local_revision: 1,
    title: `${source.title} (نسخة محلية)`,
    created_at: timestamp,
    updated_at: timestamp,
    server_updated_at: null,
    last_sync_error: null,
  };

  const db = await getOfflineDb();
  await db.put('exams', duplicate);
  dispatchOfflineRecordsChanged();
  return duplicate;
}
