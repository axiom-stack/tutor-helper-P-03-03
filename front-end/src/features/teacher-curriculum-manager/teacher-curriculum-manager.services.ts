import { authAxios } from '../auth/auth.services';
import type {
  Class,
  Subject,
  Unit,
  Lesson,
  LessonContentType,
  CreateClassData,
  CreateSubjectData,
  CreateUnitData,
} from '../../types';

const api = () => authAxios();

// ——— Classes ———
export async function getMyClasses(): Promise<{ classes: Class[] }> {
  const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
  return response.data;
}

export async function createClass(
  data: CreateClassData
): Promise<{ class: Class }> {
  const response = await api().post<{ class: Class }>('/api/classes', data);
  return response.data;
}

export async function updateClass(
  classId: number,
  data: {
    name: string;
    description: string;
    grade_label: string;
    section_label: string;
    academic_year: string;
    default_duration_minutes?: number;
  }
): Promise<{ class: Class }> {
  const response = await api().put<{ class: Class }>(`/api/classes/${classId}`, data);
  return response.data;
}

export async function deleteClass(classId: number): Promise<{ class: Class }> {
  const response = await api().delete<{ class: Class }>(`/api/classes/${classId}`);
  return response.data;
}

// ——— Subjects ———
export async function getMySubjects(): Promise<{ subjects: Subject[] }> {
  const response = await api().get<{ subjects: Subject[] }>(
    '/api/subjects/mine'
  );
  return response.data;
}

export async function getSubjectsByClass(
  classId: number
): Promise<{ subjects: Subject[] }> {
  const response = await api().get<{ subjects: Subject[] }>(
    `/api/subjects/class/${classId}`
  );
  return response.data;
}

export async function createSubject(
  data: CreateSubjectData
): Promise<{ subject: Subject }> {
  const response = await api().post<{ subject: Subject }>('/api/subjects', data);
  return response.data;
}

export async function updateSubject(
  subjectId: number,
  data: { name: string; description: string; class_id?: number }
): Promise<{ subject: Subject }> {
  const response = await api().put<{ subject: Subject }>(`/api/subjects/${subjectId}`, data);
  return response.data;
}

export async function deleteSubject(subjectId: number): Promise<{ subject: Subject }> {
  const response = await api().delete<{ subject: Subject }>(`/api/subjects/${subjectId}`);
  return response.data;
}

// ——— Units ———
export async function getUnitsBySubject(
  subjectId: number
): Promise<{ units: Unit[] }> {
  const response = await api().get<{ units: Unit[] }>(
    `/api/units/subject/${subjectId}`
  );
  return response.data;
}

export async function createUnit(
  data: CreateUnitData
): Promise<{ unit: Unit }> {
  const response = await api().post<{ unit: Unit }>('/api/units', data);
  return response.data;
}

export async function updateUnit(
  unitId: number,
  data: { name: string; description: string; subject_id?: number }
): Promise<{ unit: Unit }> {
  const response = await api().put<{ unit: Unit }>(`/api/units/${unitId}`, data);
  return response.data;
}

export async function deleteUnit(unitId: number): Promise<{ unit: Unit }> {
  const response = await api().delete<{ unit: Unit }>(`/api/units/${unitId}`);
  return response.data;
}

// ——— Lessons ———
export async function getLessonsByUnit(
  unitId: number
): Promise<{ lessons: Lesson[] }> {
  const response = await api().get<{ lessons: Lesson[] }>(
    `/api/lessons/unit/${unitId}`
  );
  return response.data;
}

interface CreateLessonPayloadBase {
  name: string;
  description: string;
  unit_id: number;
  teacher_id: number;
  number_of_periods: number;
  content_type: LessonContentType;
}

export type CreateLessonPayload =
  | (CreateLessonPayloadBase & {
      content_type: 'text';
      content: string;
    })
  | (CreateLessonPayloadBase & {
      content_type: 'pdf' | 'word';
      file: File;
    });

export interface CreateLessonResponse {
  lesson?: Lesson;
  message?: string;
  fileProcessed?: boolean;
  extractionStatus?: 'success' | 'partial' | 'failed';
  contentLength?: number;
  fileName?: string;
  fileType?: string;
  warnings?: string[];
  content_type: LessonContentType;
}

export async function createLesson(
  payload: CreateLessonPayload
): Promise<CreateLessonResponse> {
  if (payload.content_type === 'text') {
    const body = {
      name: payload.name,
      description: payload.description,
      unit_id: payload.unit_id,
      number_of_periods: payload.number_of_periods,
      content_type: payload.content_type,
      content: payload.content,
      id: payload.teacher_id,
    };
    const response = await api().post<CreateLessonResponse>('/api/lessons', body);
    return response.data;
  }

  const form = new FormData();
  form.append('name', payload.name);
  form.append('description', payload.description);
  form.append('unit_id', String(payload.unit_id));
  form.append('number_of_periods', String(payload.number_of_periods));
  form.append('content_type', payload.content_type);
  form.append('id', String(payload.teacher_id));
  form.append('file', payload.file);

  const response = await api().post<CreateLessonResponse>('/api/lessons', form);
  return response.data;
}

export async function updateLesson(
  lessonId: number,
  payload:
    | {
        name: string;
        description: string;
        content_type: 'text';
        content: string;
        unit_id?: number;
        number_of_periods?: number;
      }
    | {
        name: string;
        description: string;
        content_type: 'pdf' | 'word';
        file: File;
        unit_id?: number;
        number_of_periods?: number;
      }
): Promise<CreateLessonResponse> {
  if (payload.content_type === 'text') {
    const response = await api().put<CreateLessonResponse>(
      `/api/lessons/${lessonId}`,
      payload
    );
    return response.data;
  }

  const form = new FormData();
  form.append('name', payload.name);
  form.append('description', payload.description);
  form.append('content_type', payload.content_type);
  form.append('file', payload.file);

  if (payload.unit_id !== undefined) {
    form.append('unit_id', String(payload.unit_id));
  }
  if (payload.number_of_periods !== undefined) {
    form.append('number_of_periods', String(payload.number_of_periods));
  }

  const response = await api().put<CreateLessonResponse>(
    `/api/lessons/${lessonId}`,
    form
  );
  return response.data;
}

export async function deleteLesson(lessonId: number): Promise<{ lesson: Lesson }> {
  const response = await api().delete<{ lesson: Lesson }>(`/api/lessons/${lessonId}`);
  return response.data;
}
