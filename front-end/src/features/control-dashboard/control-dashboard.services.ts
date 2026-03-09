import { authAxios } from '../auth/auth.services';
import type {
  Assignment,
  Class,
  Exam,
  Lesson,
  LessonPlanRecord,
  Subject,
  TeacherManagementRow,
  Unit,
  UserRole,
} from '../../types';

const api = () => authAxios();

function scopePath(role: UserRole, path: string): string {
  if (role === 'admin') {
    return path;
  }
  return `${path}/mine`;
}

export async function getScopedClasses(
  role: UserRole
): Promise<{ classes: Class[] }> {
  const response = await api().get<{ classes: Class[] }>(
    scopePath(role, '/api/classes')
  );
  return response.data;
}

export async function getScopedSubjects(
  role: UserRole
): Promise<{ subjects: Subject[] }> {
  const response = await api().get<{ subjects: Subject[] }>(
    scopePath(role, '/api/subjects')
  );
  return response.data;
}

export async function getScopedLessons(
  role: UserRole
): Promise<{ lessons: Lesson[] }> {
  const response = await api().get<{ lessons: Lesson[] }>(
    scopePath(role, '/api/lessons')
  );
  return response.data;
}

export async function getScopedUnits(
  role: UserRole
): Promise<{ units: Unit[] }> {
  const response = await api().get<{ units: Unit[] }>(scopePath(role, '/api/units'));
  return response.data;
}

export async function listScopedPlans(): Promise<{ plans: LessonPlanRecord[] }> {
  const response = await api().get<{ plans: LessonPlanRecord[] }>('/api/plans');
  return response.data;
}

export async function listScopedExams(): Promise<{ exams: Exam[] }> {
  const response = await api().get<{ exams: Exam[] }>('/api/exams');
  return response.data;
}

export async function listScopedAssignments(): Promise<{ assignments: Assignment[] }> {
  const response = await api().get<{ assignments: Assignment[] }>('/api/assignments');
  return response.data;
}

export async function listTeacherScopes(): Promise<{
  teachers: TeacherManagementRow[];
}> {
  const response = await api().get<{ teachers: TeacherManagementRow[] }>(
    '/api/users/teachers'
  );
  return response.data;
}
