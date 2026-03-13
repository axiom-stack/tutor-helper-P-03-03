import { authAxios } from '../auth/auth.services';
import type { Class, Lesson, Subject, Unit } from '../../types';

const api = () => authAxios();

export async function getMyLessons(stage?: string): Promise<{ lessons: Lesson[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ lessons: Lesson[] }>('/api/lessons/mine', {
    params,
  });
  return response.data;
}

export async function getMyClasses(
  stage?: string
): Promise<{ classes: Class[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ classes: Class[] }>('/api/classes/mine', {
    params,
  });
  return response.data;
}

export async function getMySubjects(stage?: string): Promise<{ subjects: Subject[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ subjects: Subject[] }>('/api/subjects/mine', {
    params,
  });
  return response.data;
}

export async function getMyUnits(stage?: string): Promise<{ units: Unit[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ units: Unit[] }>('/api/units/mine', {
    params,
  });
  return response.data;
}
