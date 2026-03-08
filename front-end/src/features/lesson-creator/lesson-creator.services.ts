import { authAxios } from '../auth/auth.services';
import type { Class, Lesson, Subject, Unit } from '../../types';

const api = () => authAxios();

export type PlanType = 'traditional' | 'active_learning';

export interface GeneratePlanRequest {
  lesson_title: string;
  lesson_content: string;
  subject: string;
  grade: string;
  unit: string;
  duration_minutes: number;
  plan_type: PlanType;
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
  id: number;
  plan_type: PlanType;
  plan_json: Record<string, unknown>;
  validation_status: string;
  retry_occurred: boolean;
  created_at: string;
  updated_at: string;
}

export async function getMyClasses(): Promise<{ classes: Class[] }> {
  const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
  return response.data;
}

export async function getMySubjects(): Promise<{ subjects: Subject[] }> {
  const response = await api().get<{ subjects: Subject[] }>('/api/subjects/mine');
  return response.data;
}

export async function getUnitsBySubject(
  subjectId: number
): Promise<{ units: Unit[] }> {
  const response = await api().get<{ units: Unit[] }>(
    `/api/units/subject/${subjectId}`
  );
  return response.data;
}

export async function getLessonsByUnit(
  unitId: number
): Promise<{ lessons: Lesson[] }> {
  const response = await api().get<{ lessons: Lesson[] }>(
    `/api/lessons/unit/${unitId}`
  );
  return response.data;
}

export async function getLessonById(
  lessonId: number
): Promise<{ lesson: Lesson }> {
  const response = await api().get<{ lesson: Lesson }>(`/api/lessons/${lessonId}`);
  return response.data;
}

export async function generatePlan(
  payload: GeneratePlanRequest
): Promise<GeneratedPlanResponse> {
  const response = await api().post<GeneratedPlanResponse>('/api/generate-plan', payload);
  return response.data;
}
