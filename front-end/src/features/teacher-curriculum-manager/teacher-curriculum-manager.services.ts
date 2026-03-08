import { authAxios } from '../auth/auth.services';
import type {
  Class,
  Subject,
  Unit,
  Lesson,
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
  data: { name: string; description: string }
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

export interface CreateLessonTextPayload {
  name: string;
  description: string;
  unit_id: number;
  content: string;
  teacher_id: number;
}

/** Create a text lesson (JSON body). */
export async function createLessonText(
  payload: CreateLessonTextPayload
): Promise<{ lesson: Lesson; content_type: string }> {
  const body = {
    name: payload.name,
    description: payload.description,
    unit_id: payload.unit_id,
    content_type: 'text',
    content: payload.content,
    id: payload.teacher_id,
  };
  const response = await api().post<{
    lesson: Lesson;
    content_type: string;
  }>('/api/lessons', body);
  return response.data;
}

export interface CreateLessonFilePayload {
  name: string;
  description: string;
  unit_id: number;
  content_type: 'pdf' | 'word';
  teacher_id: number;
  file: File;
}

/** Create a lesson with PDF/Word file (FormData). Do not set Content-Type so browser sets multipart boundary. */
export async function createLessonFile(
  payload: CreateLessonFilePayload
): Promise<{ message: string; fileProcessed: boolean }> {
  const form = new FormData();
  form.append('name', payload.name);
  form.append('description', payload.description);
  form.append('unit_id', String(payload.unit_id));
  form.append('content_type', payload.content_type);
  form.append('id', String(payload.teacher_id));
  form.append('file', payload.file);

  const response = await api().post<{
    message?: string;
    fileProcessed?: boolean;
  }>('/api/lessons', form);
  // FormData: do not set Content-Type so browser sets multipart/form-data with boundary
  return {
    message: response.data.message ?? 'تم رفع الملف',
    fileProcessed: response.data.fileProcessed ?? false,
  };
}

export async function updateLesson(
  lessonId: number,
  data: { name: string; description: string; content: string; unit_id?: number }
): Promise<{ lesson: Lesson }> {
  const response = await api().put<{ lesson: Lesson }>(`/api/lessons/${lessonId}`, data);
  return response.data;
}

export async function deleteLesson(lessonId: number): Promise<{ lesson: Lesson }> {
  const response = await api().delete<{ lesson: Lesson }>(`/api/lessons/${lessonId}`);
  return response.data;
}
