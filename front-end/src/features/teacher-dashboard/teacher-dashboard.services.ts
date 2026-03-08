import { authAxios } from '../auth/auth.services';
import type { Class, Lesson, Subject, Unit } from '../../types';

const api = () => authAxios();

export async function getMyLessons(): Promise<{ lessons: Lesson[] }> {
  const response = await api().get<{ lessons: Lesson[] }>('/api/lessons/mine');
  return response.data;
}

export async function getMyClasses(): Promise<{ classes: Class[] }> {
  const response = await api().get<{ classes: Class[] }>('/api/classes/mine');
  return response.data;
}

export async function getMySubjects(): Promise<{ subjects: Subject[] }> {
  const response = await api().get<{ subjects: Subject[] }>('/api/subjects/mine');
  return response.data;
}

export async function getMyUnits(): Promise<{ units: Unit[] }> {
  const response = await api().get<{ units: Unit[] }>('/api/units/mine');
  return response.data;
}
