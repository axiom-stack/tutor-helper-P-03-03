import { authAxios, getStoredUser } from '../features/auth/auth.services';
import type { GeneratePlanRequest } from '../features/lesson-creator/lesson-creator.services';
import { normalizeApiError } from '../utils/apiErrors';
import { cacheAssignment } from './assignments';
import { getCachedAssignmentById, markAssignmentConflict, markAssignmentSyncError, replaceAssignmentFromServer } from './assignments';
import { getCachedExamById, markExamConflict, markExamSyncError, replaceExamFromServer, cacheExam } from './exams';
import { listQueueActionsByStatus, markQueueActionStatus, deleteCompletedQueueActions } from './queue';
import { getCachedPlanById, markPlanConflict, markPlanSyncError, replacePlanFromServer, cachePlan } from './plans';
import { getIsOnline } from './network';
import { dispatchOfflineSyncCompleted } from './utils';
import type { OfflineQueueAction } from './types';

let isProcessing = false;

function api() {
  return authAxios();
}

async function processPlanUpdate(action: OfflineQueueAction) {
  const local = action.target_local_id ? await getCachedPlanById(action.target_local_id) : null;
  if (!local || !action.target_server_id) {
    await markQueueActionStatus(action.queue_id, 'stale', {
      last_error: 'المرجع المحلي غير متوفر.',
    });
    return;
  }

  const currentRemote = await api().get<{ plan: { updated_at: string } }>(
    `/api/plans/${action.target_server_id}`
  );

  if (
    action.base_server_updated_at &&
    currentRemote.data.plan.updated_at !== action.base_server_updated_at
  ) {
    await markPlanConflict(local.local_id, 'الخطة تغيّرت على الخادم قبل إعادة المزامنة.');
    await markQueueActionStatus(action.queue_id, 'conflict', {
      last_error: 'تعارض مع نسخة الخادم.',
    });
    return;
  }

  const response = await api().put(`/api/plans/${action.target_server_id}`, action.request_payload);
  await replacePlanFromServer(local.local_id, response.data.plan);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processAssignmentUpdate(action: OfflineQueueAction) {
  const local = action.target_local_id
    ? await getCachedAssignmentById(action.target_local_id)
    : null;
  if (!local || !action.target_server_id) {
    await markQueueActionStatus(action.queue_id, 'stale', {
      last_error: 'المرجع المحلي غير متوفر.',
    });
    return;
  }

  const currentRemote = await api().get<{ assignment: { updated_at: string } }>(
    `/api/assignments/${action.target_server_id}`
  );

  if (
    action.base_server_updated_at &&
    currentRemote.data.assignment.updated_at !== action.base_server_updated_at
  ) {
    await markAssignmentConflict(local.local_id, 'الواجب تغيّر على الخادم قبل إعادة المزامنة.');
    await markQueueActionStatus(action.queue_id, 'conflict', {
      last_error: 'تعارض مع نسخة الخادم.',
    });
    return;
  }

  const response = await api().put(
    `/api/assignments/${action.target_server_id}`,
    action.request_payload
  );
  await replaceAssignmentFromServer(local.local_id, response.data.assignment);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processExamUpdate(action: OfflineQueueAction) {
  const local = action.target_local_id ? await getCachedExamById(action.target_local_id) : null;
  if (!local || !action.target_server_id) {
    await markQueueActionStatus(action.queue_id, 'stale', {
      last_error: 'المرجع المحلي غير متوفر.',
    });
    return;
  }

  const currentRemote = await api().get<{ exam: { updated_at: string } }>(
    `/api/exams/${action.target_server_id}`
  );

  if (
    action.base_server_updated_at &&
    currentRemote.data.exam.updated_at !== action.base_server_updated_at
  ) {
    await markExamConflict(local.local_id, 'الاختبار تغيّر على الخادم قبل إعادة المزامنة.');
    await markQueueActionStatus(action.queue_id, 'conflict', {
      last_error: 'تعارض مع نسخة الخادم.',
    });
    return;
  }

  const response = await api().put(`/api/exams/${action.target_server_id}`, action.request_payload);
  await replaceExamFromServer(local.local_id, response.data.exam);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processGeneratePlan(action: OfflineQueueAction) {
  const payload = action.request_payload as GeneratePlanRequest;
  const storedUser = getStoredUser();
  const response = await api().post<{
    id: string;
    plan_type: GeneratePlanRequest['plan_type'];
    plan_json: Record<string, unknown>;
    validation_status: string;
    retry_occurred: boolean;
    created_at: string;
    updated_at: string;
  }>('/api/generate-plan', payload);
  await cachePlan({
    id: response.data.id,
    db_id: 0,
    public_id: response.data.id,
    teacher_id: storedUser?.id ?? 0,
    lesson_id: payload.lesson_id,
    lesson_title: payload.lesson_title,
    subject: payload.subject,
    grade: payload.grade,
    unit: payload.unit,
    duration_minutes: payload.duration_minutes,
    plan_type: response.data.plan_type,
    plan_json: response.data.plan_json,
    validation_status: response.data.validation_status,
    retry_occurred: response.data.retry_occurred,
    created_at: response.data.created_at,
    updated_at: response.data.updated_at,
  });
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processGenerateAssignments(action: OfflineQueueAction) {
  const response = await api().post('/api/assignments/generate', action.request_payload);
  await Promise.all((response.data.assignments ?? []).map(cacheAssignment));
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processGenerateExam(action: OfflineQueueAction) {
  const response = await api().post('/api/exams/generate', action.request_payload);
  await cacheExam(response.data.exam);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processCreateRefinement(action: OfflineQueueAction) {
  if (action.target_local_id && action.base_local_revision != null) {
    const record =
      (await getCachedPlanById(action.target_local_id)) ??
      (await getCachedAssignmentById(action.target_local_id)) ??
      (await getCachedExamById(action.target_local_id));

    if (!record || record.local_revision !== action.base_local_revision) {
      await markQueueActionStatus(action.queue_id, 'stale', {
        last_error: 'تم تجاهل الطلب لأن النسخة المحلية تغيّرت.',
      });
      return;
    }
  }

  await api().post('/api/refinements', action.request_payload);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processRetryRefinement(action: OfflineQueueAction) {
  if (!action.target_server_id) {
    await markQueueActionStatus(action.queue_id, 'stale', {
      last_error: 'طلب التحسين غير صالح لإعادة المحاولة.',
    });
    return;
  }
  await api().post(`/api/refinements/${action.target_server_id}/retry`);
  await markQueueActionStatus(action.queue_id, 'completed', { last_error: null });
}

async function processAction(action: OfflineQueueAction) {
  await markQueueActionStatus(action.queue_id, 'processing', {
    attempt_count: action.attempt_count + 1,
  });

  switch (action.action_type) {
    case 'sync_plan_update':
      return processPlanUpdate(action);
    case 'sync_assignment_update':
      return processAssignmentUpdate(action);
    case 'sync_exam_update':
      return processExamUpdate(action);
    case 'generate_plan':
      return processGeneratePlan(action);
    case 'generate_assignments':
      return processGenerateAssignments(action);
    case 'generate_exam':
      return processGenerateExam(action);
    case 'create_refinement':
      return processCreateRefinement(action);
    case 'retry_refinement':
      return processRetryRefinement(action);
    default:
      return markQueueActionStatus(action.queue_id, 'stale', {
        last_error: 'نوع الإجراء غير مدعوم.',
      });
  }
}

export async function processOfflineQueue() {
  if (isProcessing || !getIsOnline()) {
    return;
  }

  isProcessing = true;

  try {
    const actions = await listQueueActionsByStatus(['pending', 'failed']);
    for (const action of actions) {
      if (!getIsOnline()) {
        break;
      }

      try {
        await processAction(action);
      } catch (error: unknown) {
        const message = normalizeApiError(error, 'فشلت إعادة المزامنة.').message;

        switch (action.action_type) {
          case 'sync_plan_update':
            if (action.target_local_id) {
              await markPlanSyncError(action.target_local_id, message);
            }
            break;
          case 'sync_assignment_update':
            if (action.target_local_id) {
              await markAssignmentSyncError(action.target_local_id, message);
            }
            break;
          case 'sync_exam_update':
            if (action.target_local_id) {
              await markExamSyncError(action.target_local_id, message);
            }
            break;
          default:
            break;
        }

        await markQueueActionStatus(action.queue_id, 'failed', {
          last_error: message,
          next_retry_at: new Date(Date.now() + 30_000).toISOString(),
        });
      }
    }

    await deleteCompletedQueueActions();
  } finally {
    isProcessing = false;
    dispatchOfflineSyncCompleted();
  }
}
