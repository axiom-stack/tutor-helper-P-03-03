import { authAxios, getStoredUser } from '../auth/auth.services';
import type { Class, Lesson, LessonPlanRecord, Subject, Unit } from '../../types';
import { isOfflineError } from '../../offline/network';
import { enqueueOfflineAction } from '../../offline/queue';
import { cachePlan, getCachedPlanById } from '../../offline/plans';
import { getReference, putReference } from '../../offline/references';
import { isLocalOnlyId } from '../../offline/utils';

const api = () => authAxios();

export type PlanType = 'traditional' | 'active_learning';

export interface GeneratePlanRequest {
  lesson_id: number;
  lesson_title: string;
  lesson_content: string;
  subject: string;
  grade: string;
  unit: string;
  duration_minutes: number;
  plan_type: PlanType;
  class_id?: number;
  class_name?: string;
  section?: string;
}

export interface ValidationErrorItem {
  code: string;
  path: string;
  message: string;
}

export interface GeneratePlanErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ValidationErrorItem[];
  };
}

export interface GeneratedPlanResponse {
  id: string;
  plan_type: PlanType;
  plan_json: Record<string, unknown>;
  validation_status: string;
  retry_occurred: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueuedGeneratePlanResponse {
  queued: true;
  queue_id: string;
  message: string;
}

export async function getMyClasses(): Promise<{ classes: Class[] }> {
  try {
    const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
    await putReference('classes:mine', 'classes', response.data.classes ?? []);
    return response.data;
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getReference<Class[]>('classes:mine');
    return { classes: cached ?? [] };
  }
}

export async function getMySubjects(): Promise<{ subjects: Subject[] }> {
  try {
    const response = await api().get<{ subjects: Subject[] }>('/api/subjects/mine');
    await putReference('subjects:mine', 'subjects', response.data.subjects ?? []);
    return response.data;
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getReference<Subject[]>('subjects:mine');
    return { subjects: cached ?? [] };
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
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getReference<Unit[]>(cacheKey);
    return { units: cached ?? [] };
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
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getReference<Lesson[]>(cacheKey);
    return { lessons: cached ?? [] };
  }
}

export async function getLessonById(
  lessonId: number
): Promise<{ lesson: Lesson }> {
  const cacheKey = `lesson:${lessonId}`;
  try {
    const response = await api().get<{ lesson: Lesson }>(`/api/lessons/${lessonId}`);
    await putReference(cacheKey, 'lesson', response.data.lesson, lessonId);
    return response.data;
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getReference<Lesson>(cacheKey);
    if (cached) {
      return { lesson: cached };
    }
    throw error;
  }
}

export async function generatePlan(
  payload: GeneratePlanRequest
): Promise<GeneratedPlanResponse | QueuedGeneratePlanResponse> {
  try {
    const response = await api().post<GeneratedPlanResponse>('/api/generate-plan', payload);
    const storedUser = getStoredUser();
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
    return response.data;
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const queued = await enqueueOfflineAction({
      action_type: 'generate_plan',
      entity_type: 'lesson_plan',
      request_payload: payload,
      last_error: null,
      next_retry_at: null,
    });

    return {
      queued: true,
      queue_id: queued.queue_id,
      message: 'تم حفظ طلب توليد الخطة محليًا وسيعاد تشغيله عند عودة الاتصال.',
    };
  }
}

export async function getPlanById(
  planId: string
): Promise<{ plan: LessonPlanRecord }> {
  if (isLocalOnlyId(planId)) {
    const cached = await getCachedPlanById(planId);
    if (!cached) {
      throw new Error('الخطة المحلية غير متوفرة.');
    }
    return { plan: cached };
  }

  try {
    const response = await api().get<{ plan: LessonPlanRecord }>(`/api/plans/${planId}`);
    const cached = await cachePlan(response.data.plan);
    return { plan: cached };
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getCachedPlanById(planId);
    if (cached) {
      return { plan: cached };
    }
    throw error;
  }
}

/**
 * Download plan export (PDF or DOCX) and trigger browser save.
 * @param planId - Plan public_id (e.g. trd_1, act_1)
 * @param format - 'pdf' | 'docx'
 */
export async function exportPlan(planId: string, format: 'pdf' | 'docx'): Promise<void> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `plan_${planId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
