import { authAxios } from '../auth/auth.services';
import type {
  Class,
  Exam,
  GenerateExamRequest,
  Lesson,
  Subject,
  Unit,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { getIsOnline, isOfflineError } from '../../offline/network';
import { enqueueOfflineAction, upsertPendingEntityAction } from '../../offline/queue';
import { getReference, putReference } from '../../offline/references';
import {
  cacheExam,
  cacheExams,
  deleteExamLocally,
  duplicateExamLocally,
  getCachedExamById,
  getCachedExams,
  saveExamOffline,
} from '../../offline/exams';
import { isLocalOnlyId } from '../../offline/utils';

const api = () => authAxios();

interface GenerateExamResponse {
  exam: Exam;
}

export interface QueuedGenerateExamResponse {
  queued: true;
  queue_id: string;
  message: string;
}

interface ListExamsResponse {
  exams: Exam[];
}

interface GetExamResponse {
  exam: Exam;
}

interface UpdateExamResponse {
  exam: Exam;
}

interface DeleteExamResponse {
  deleted: boolean;
  exam: Exam;
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
    throw error;
  }
}

export async function getAllClasses(): Promise<{ classes: Class[] }> {
  try {
    const response = await api().get<{ classes: Class[] }>('/api/classes');
    await putReference('classes:all', 'classes', response.data.classes ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Class[]>('classes:all');
      return { classes: cached ?? [] };
    }
    throw error;
  }
}

export async function getMySubjects(): Promise<{ subjects: Subject[] }> {
  try {
    const response = await api().get<{ subjects: Subject[] }>('/api/subjects/mine');
    await putReference('subjects:mine', 'subjects', response.data.subjects ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Subject[]>('subjects:mine');
      return { subjects: cached ?? [] };
    }
    throw error;
  }
}

export async function getAllSubjects(): Promise<{ subjects: Subject[] }> {
  try {
    const response = await api().get<{ subjects: Subject[] }>('/api/subjects');
    await putReference('subjects:all', 'subjects', response.data.subjects ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Subject[]>('subjects:all');
      return { subjects: cached ?? [] };
    }
    throw error;
  }
}

export async function getUnitsBySubject(
  subjectId: number
): Promise<{ units: Unit[] }> {
  const cacheKey = `units:subject:${subjectId}`;
  try {
    const response = await api().get<{ units: Unit[] }>(
      `/api/units/subject/${subjectId}`
    );
    await putReference(cacheKey, 'units', response.data.units ?? [], subjectId);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Unit[]>(cacheKey);
      return { units: cached ?? [] };
    }
    throw error;
  }
}

export async function getLessonsByUnit(
  unitId: number
): Promise<{ lessons: Lesson[] }> {
  const cacheKey = `lessons:unit:${unitId}`;
  try {
    const response = await api().get<{ lessons: Lesson[] }>(
      `/api/lessons/unit/${unitId}`
    );
    await putReference(cacheKey, 'lessons', response.data.lessons ?? [], unitId);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getReference<Lesson[]>(cacheKey);
      return { lessons: cached ?? [] };
    }
    throw error;
  }
}

export async function generateExam(
  payload: GenerateExamRequest
): Promise<GenerateExamResponse | QueuedGenerateExamResponse> {
  try {
    const response = await api().post<GenerateExamResponse>(
      '/api/exams/generate',
      payload
    );
    await cacheExam(response.data.exam);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const queued = await enqueueOfflineAction({
        action_type: 'generate_exam',
        entity_type: 'exam',
        request_payload: payload,
        last_error: null,
        next_retry_at: null,
      });

      return {
        queued: true,
        queue_id: queued.queue_id,
        message: 'تم حفظ طلب توليد الاختبار محليًا وسيعاد تشغيله عند عودة الاتصال.',
      };
    }
    throw normalizeApiError(error, 'فشل توليد الاختبار.');
  }
}

export async function listExams(): Promise<ListExamsResponse> {
  try {
    const response = await api().get<ListExamsResponse>('/api/exams');
    await cacheExams(response.data.exams ?? []);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getCachedExams();
      return { exams: cached };
    }
    throw normalizeApiError(error, 'فشل تحميل قائمة الاختبارات.');
  }
}

export async function getExamById(id: string): Promise<GetExamResponse> {
  if (isLocalOnlyId(id)) {
    const cached = await getCachedExamById(id);
    if (!cached) {
      throw new Error('الاختبار المحلي غير متوفر.');
    }
    return { exam: cached };
  }

  try {
    const response = await api().get<GetExamResponse>(`/api/exams/${id}`);
    const exam = await cacheExam(response.data.exam);
    return { exam };
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cached = await getCachedExamById(id);
      if (cached) {
        return { exam: cached };
      }
    }
    throw normalizeApiError(error, 'فشل تحميل تفاصيل الاختبار.');
  }
}

export async function updateExam(
  id: string,
  payload: Pick<Exam, 'title'> & { questions: Exam['questions'] }
): Promise<UpdateExamResponse> {
  const local = await saveExamOffline({ id, payload });

  try {
    if (!local.server_id) {
      return { exam: local };
    }

    const response = await api().put<UpdateExamResponse>(`/api/exams/${local.server_id}`, payload);
    const exam = await cacheExam(response.data.exam);
    return { exam };
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      await upsertPendingEntityAction({
        actionType: 'sync_exam_update',
        entityType: 'exam',
        targetLocalId: local.local_id,
        targetServerId: local.server_id,
        requestPayload: payload,
        baseServerUpdatedAt: local.server_updated_at,
        baseLocalRevision: local.local_revision,
      });
      return { exam: local };
    }
    throw normalizeApiError(error, 'فشل حفظ تعديلات الاختبار.');
  }
}

export async function deleteExamById(id: string): Promise<DeleteExamResponse> {
  if (isLocalOnlyId(id)) {
    const deletedExam = await deleteExamLocally(id);
    if (!deletedExam) {
      throw normalizeApiError(new Error('exam not found'), 'فشل حذف الاختبار.');
    }
    return { deleted: true, exam: deletedExam };
  }

  try {
    const response = await api().delete<DeleteExamResponse>(`/api/exams/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل حذف الاختبار.');
  }
}

export async function duplicateExam(id: string): Promise<{ exam: Exam }> {
  const exam = await duplicateExamLocally(id);
  return { exam };
}

/**
 * Fetch exam export as blob (for sharing / WhatsApp with attachment).
 */
export async function getExamExportBlob(
  examId: string,
  format: 'pdf' | 'docx',
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<Blob> {
  // Online: unchanged API-only path (no static link to offline export code).
  if (getIsOnline()) {
    const response = await api().get(`/api/exams/${examId}/export`, {
      params: { format, type },
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  const cached = await getCachedExamById(examId);
  if (!cached) {
    throw new Error('تعذّر التصدير دون اتصال: الاختبار غير محفوظ محليًا.');
  }
  const { exportCachedExamToBlob } = await import('../../offline/exportGenerator');
  return exportCachedExamToBlob(cached, format, type);
}

/**
 * Download exam export (PDF or DOCX) and trigger browser save.
 */
export async function exportExam(
  examId: string,
  format: 'pdf' | 'docx',
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<void> {
  const blob = await getExamExportBlob(examId, format, type);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `exam_${examId}_${type}.${ext}`;
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
 * Share exam export via native share when available, else download.
 */
export async function shareExam(
  examId: string,
  format: 'pdf' | 'docx',
  title?: string,
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<void> {
  const blob = await getExamExportBlob(examId, format, type);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `exam_${examId}_${type}.${ext}`;
  const { shareOrDownload } = await import('../../utils/share');
  await shareOrDownload(blob, filename, title ?? filename);
}
