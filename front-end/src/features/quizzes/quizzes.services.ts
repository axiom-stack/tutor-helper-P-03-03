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

const api = () => authAxios();

interface GenerateExamResponse {
  exam: Exam;
}

interface ListExamsResponse {
  exams: Exam[];
}

interface GetExamResponse {
  exam: Exam;
}

interface DeleteExamResponse {
  deleted: boolean;
  exam: Exam;
}

export interface ListExamsFilters {
  subject_id?: number;
  class_id?: number;
  date_from?: string;
  date_to?: string;
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

export async function generateExam(
  payload: GenerateExamRequest
): Promise<GenerateExamResponse> {
  try {
    const response = await api().post<GenerateExamResponse>(
      '/api/exams/generate',
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل توليد الاختبار.');
  }
}

export async function listExams(
  filters: ListExamsFilters = {}
): Promise<ListExamsResponse> {
  const params: Record<string, string | number> = {};

  if (filters.subject_id != null) {
    params.subject_id = filters.subject_id;
  }
  if (filters.class_id != null) {
    params.class_id = filters.class_id;
  }
  if (filters.date_from) {
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    params.date_to = filters.date_to;
  }

  try {
    const response = await api().get<ListExamsResponse>('/api/exams', { params });
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل تحميل قائمة الاختبارات.');
  }
}

export async function getExamById(id: string): Promise<GetExamResponse> {
  try {
    const response = await api().get<GetExamResponse>(`/api/exams/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل تحميل تفاصيل الاختبار.');
  }
}

export async function deleteExamById(id: string): Promise<DeleteExamResponse> {
  try {
    const response = await api().delete<DeleteExamResponse>(`/api/exams/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل حذف الاختبار.');
  }
}
