import { authAxios } from '../auth/auth.services';
import type {
  Assignment,
  Class,
  GenerateAssignmentsRequest,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { isOfflineError } from '../../offline/network';
import {
  cacheAssignment,
  cacheAssignments,
  duplicateAssignmentLocally,
  getCachedAssignmentById,
  getCachedAssignments,
  saveAssignmentOffline,
} from '../../offline/assignments';
import {
  enqueueOfflineAction,
  upsertPendingEntityAction,
} from '../../offline/queue';
import { getReference, putReference } from '../../offline/references';
import { isLocalOnlyId } from '../../offline/utils';

const api = () => authAxios();

interface GenerateAssignmentsResponse {
  assignments: Assignment[];
}

export interface QueuedGenerateAssignmentsResponse {
  queued: true;
  queue_id: string;
  message: string;
}

interface ListAssignmentsResponse {
  assignments: Assignment[];
}

interface GetAssignmentResponse {
  assignment: Assignment;
}

interface UpdateAssignmentResponse {
  assignment: Assignment;
}

export interface ListAssignmentsFilters {
  lessonPlanPublicId?: string;
  lessonId?: number;
  classId?: number;
}

type GenerateAssignmentsExtras = Pick<
  GenerateAssignmentsRequest,
  'lesson_plan' | 'lesson_content'
>;

export async function generateAssignments(
  lessonPlanPublicId: string,
  lessonId: number,
  optionalBody?: Partial<GenerateAssignmentsExtras>
): Promise<GenerateAssignmentsResponse | QueuedGenerateAssignmentsResponse> {
  const payload: GenerateAssignmentsRequest = {
    lesson_plan_public_id: lessonPlanPublicId,
    lesson_id: lessonId,
    ...(optionalBody ?? {}),
  };

  try {
    const response = await api().post<GenerateAssignmentsResponse>(
      '/api/assignments/generate',
      payload
    );
    await cacheAssignments(response.data.assignments ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const queued = await enqueueOfflineAction({
        action_type: 'generate_assignments',
        entity_type: 'assignment',
        target_server_id: lessonPlanPublicId,
        request_payload: payload,
        last_error: null,
        next_retry_at: null,
      });

      return {
        queued: true,
        queue_id: queued.queue_id,
        message:
          'تم حفظ طلب توليد الواجبات محليًا وسيعاد تشغيله عند عودة الاتصال.',
      };
    }
    throw normalizeApiError(error, 'فشل توليد الواجبات.');
  }
}

export async function listAssignments(
  filters: ListAssignmentsFilters = {}
): Promise<ListAssignmentsResponse> {
  const params: Record<string, string | number> = {};

  if (filters.lessonPlanPublicId) {
    params.lesson_plan_public_id = filters.lessonPlanPublicId;
  }
  if (filters.lessonId != null) {
    params.lesson_id = filters.lessonId;
  }
  if (filters.classId != null) {
    params.class_id = filters.classId;
  }

  try {
    const response = await api().get<ListAssignmentsResponse>(
      '/api/assignments',
      {
        params,
      }
    );
    await cacheAssignments(response.data.assignments ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getCachedAssignments();
      const assignments = cached.filter((assignment) => {
        if (
          filters.lessonPlanPublicId &&
          assignment.lesson_plan_public_id !== filters.lessonPlanPublicId
        ) {
          return false;
        }
        if (
          filters.lessonId != null &&
          assignment.lesson_id !== filters.lessonId
        ) {
          return false;
        }
        if (
          filters.classId != null &&
          assignment.class_id !== filters.classId
        ) {
          return false;
        }
        return true;
      });
      return { assignments };
    }
    throw normalizeApiError(error, 'فشل تحميل الواجبات.');
  }
}

export async function getMyClasses(): Promise<{ classes: Class[] }> {
  try {
    const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
    await putReference('classes:mine', 'classes', response.data.classes ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Class[]>('classes:mine');
      return { classes: cached ?? [] };
    }
    throw normalizeApiError(error, 'فشل تحميل الصفوف.');
  }
}

export async function getAssignmentById(
  id: string
): Promise<GetAssignmentResponse> {
  if (isLocalOnlyId(id)) {
    const cached = await getCachedAssignmentById(id);
    if (!cached) {
      throw new Error('الواجب المحلي غير متوفر.');
    }
    return { assignment: cached };
  }

  try {
    const response = await api().get<GetAssignmentResponse>(
      `/api/assignments/${id}`
    );
    const assignment = await cacheAssignment(response.data.assignment);
    return { assignment };
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getCachedAssignmentById(id);
      if (cached) {
        return { assignment: cached };
      }
    }
    throw normalizeApiError(error, 'فشل تحميل تفاصيل الواجب.');
  }
}

export async function updateAssignment(
  id: string,
  payload: Pick<
    Assignment,
    | 'name'
    | 'description'
    | 'type'
    | 'content'
    | 'due_date'
    | 'whatsapp_message_text'
  >
): Promise<UpdateAssignmentResponse> {
  const local = await saveAssignmentOffline({ id, payload });

  try {
    if (!local.server_id) {
      return { assignment: local };
    }

    const response = await api().put<UpdateAssignmentResponse>(
      `/api/assignments/${local.server_id}`,
      payload
    );
    const assignment = await cacheAssignment(response.data.assignment);
    return { assignment };
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      await upsertPendingEntityAction({
        actionType: 'sync_assignment_update',
        entityType: 'assignment',
        targetLocalId: local.local_id,
        targetServerId: local.server_id,
        requestPayload: payload,
        baseServerUpdatedAt: local.server_updated_at,
        baseLocalRevision: local.local_revision,
      });

      return { assignment: local };
    }
    throw normalizeApiError(error, 'فشل حفظ تعديلات الواجب.');
  }
}

export async function duplicateAssignment(
  id: string
): Promise<{ assignment: Assignment }> {
  const assignment = await duplicateAssignmentLocally(id);
  return { assignment };
}

/**
 * Fetch assignment export as blob (for sharing / WhatsApp with attachment).
 */
export async function getAssignmentExportBlob(
  assignmentId: string,
  format: 'pdf' | 'docx'
): Promise<Blob> {
  const response = await api().get(`/api/assignments/${assignmentId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data as Blob;
}

/**
 * Download assignment export (PDF or DOCX) and trigger browser save.
 */
export async function exportAssignment(
  assignmentId: string,
  format: 'pdf' | 'docx'
): Promise<void> {
  const blob = await getAssignmentExportBlob(assignmentId, format);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `assignment_${assignmentId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share assignment export via native share when available, else download.
 */
export async function shareAssignment(
  assignmentId: string,
  format: 'pdf' | 'docx',
  title?: string
): Promise<void> {
  const response = await api().get(`/api/assignments/${assignmentId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `assignment_${assignmentId}.${ext}`;
  const { shareOrDownload } = await import('../../utils/share');
  await shareOrDownload(blob, filename, title ?? filename);
}
