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

/** Normalize backend create response that returns { columns, rows } */
function rowFromResponse<T>(
  res: { columns?: string[]; rows?: unknown[][] }
): T | null {
  if (!res.rows?.length || !res.columns?.length) return null;
  const row = res.rows[0] as unknown[];
  const obj: Record<string, unknown> = {};
  res.columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj as T;
}

// ——— Classes ———
export async function getMyClasses(): Promise<{ classes: Class[] }> {
  const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
  return response.data;
}

export async function createClass(
  data: CreateClassData
): Promise<{ class: Class }> {
  const response = await api().post<{
    class: { columns?: string[]; rows?: unknown[][] };
  }>('/api/classes', data);
  const created = rowFromResponse<Class>(response.data.class ?? {});
  return { class: created ?? (response.data as unknown as { class: Class }).class };
}

export async function updateClass(
  classId: number,
  data: { name: string; description: string }
): Promise<void> {
  await api().put(`/api/classes/${classId}`, data);
}

export async function deleteClass(classId: number): Promise<void> {
  await api().delete(`/api/classes/${classId}`);
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
  const response = await api().post<{
    subject: { columns?: string[]; rows?: unknown[][] };
  }>('/api/subjects', data);
  const created = rowFromResponse<Subject>(response.data.subject ?? {});
  return {
    subject:
      created ?? (response.data as unknown as { subject: Subject }).subject,
  };
}

export async function updateSubject(
  subjectId: number,
  data: { name: string; description: string; class_id?: number }
): Promise<void> {
  await api().put(`/api/subjects/${subjectId}`, data);
}

export async function deleteSubject(subjectId: number): Promise<void> {
  await api().delete(`/api/subjects/${subjectId}`);
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
  const response = await api().post<{
    unit: { columns?: string[]; rows?: unknown[][] };
  }>('/api/units', data);
  const created = rowFromResponse<Unit>(response.data.unit ?? {});
  return { unit: created ?? (response.data as unknown as { unit: Unit }).unit };
}

export async function updateUnit(
  unitId: number,
  data: { name: string; description: string; subject_id?: number }
): Promise<void> {
  await api().put(`/api/units/${unitId}`, data);
}

export async function deleteUnit(unitId: number): Promise<void> {
  await api().delete(`/api/units/${unitId}`);
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
): Promise<{ lesson: Lesson }> {
  const body = {
    name: payload.name,
    description: payload.description,
    unit_id: payload.unit_id,
    content_type: 'text',
    content: payload.content,
    id: payload.teacher_id,
  };
  const response = await api().post<{
    lesson: { columns?: string[]; rows?: unknown[][] };
  }>('/api/lessons', body);
  const res = response.data.lesson ?? {};
  const created = rowFromResponse<Lesson>(res);
  return {
    lesson: created ?? (response.data as unknown as { lesson: Lesson }).lesson,
  };
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
): Promise<void> {
  await api().put(`/api/lessons/${lessonId}`, data);
}

export async function deleteLesson(lessonId: number): Promise<void> {
  await api().delete(`/api/lessons/${lessonId}`);
}
