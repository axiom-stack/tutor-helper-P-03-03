import { authAxios } from '../auth/auth.services';
import type { LessonPlanRecord, PlanType } from '../../types';

const api = () => authAxios();

export interface ListPlansFilters {
  plan_type?: PlanType;
  subject?: string;
  grade?: string;
}

export async function listPlans(
  filters: ListPlansFilters = {}
): Promise<{ plans: LessonPlanRecord[] }> {
  const params: Record<string, string> = {};

  if (filters.plan_type) {
    params.plan_type = filters.plan_type;
  }
  if (filters.subject) {
    params.subject = filters.subject;
  }
  if (filters.grade) {
    params.grade = filters.grade;
  }

  const response = await api().get<{ plans: LessonPlanRecord[] }>('/api/plans', {
    params,
  });
  return response.data;
}

export async function getPlanById(
  planId: string
): Promise<{ plan: LessonPlanRecord }> {
  const response = await api().get<{ plan: LessonPlanRecord }>(`/api/plans/${planId}`);
  return response.data;
}

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
