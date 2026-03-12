import { authAxios } from '../auth/auth.services';
import type { LessonPlanRecord, PlanType } from '../../types';
import { isOfflineError } from '../../offline/network';
import { getCachedPlanById, getCachedPlans, cachePlan, cachePlans, duplicatePlanLocally, savePlanOffline } from '../../offline/plans';
import { upsertPendingEntityAction } from '../../offline/queue';
import { isLocalOnlyId } from '../../offline/utils';

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

  try {
    const response = await api().get<{ plans: LessonPlanRecord[] }>('/api/plans', {
      params,
    });
    await cachePlans(response.data.plans ?? []);
    return response.data;
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const cached = await getCachedPlans();
    const plans = cached.filter((plan) => {
      if (filters.plan_type && plan.plan_type !== filters.plan_type) {
        return false;
      }
      if (filters.subject && !plan.subject.toLowerCase().includes(filters.subject.toLowerCase())) {
        return false;
      }
      if (filters.grade && !plan.grade.toLowerCase().includes(filters.grade.toLowerCase())) {
        return false;
      }
      return true;
    });
    return { plans };
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

export async function updatePlan(
  planId: string,
  payload: {
    lesson_title: string;
    plan_json: Record<string, unknown>;
  }
): Promise<{ plan: LessonPlanRecord }> {
  const local = await savePlanOffline({ id: planId, ...payload });

  try {
    if (!local.server_id) {
      return { plan: local };
    }

    const response = await api().put<{ plan: LessonPlanRecord }>(
      `/api/plans/${local.server_id}`,
      payload,
    );
    const cached = await cachePlan(response.data.plan);
    return { plan: cached };
  } catch (error: unknown) {
    if (!isOfflineError(error)) {
      throw error;
    }

    await upsertPendingEntityAction({
      actionType: 'sync_plan_update',
      entityType: 'lesson_plan',
      targetLocalId: local.local_id,
      targetServerId: local.server_id,
      requestPayload: payload,
      baseServerUpdatedAt: local.server_updated_at,
      baseLocalRevision: local.local_revision,
    });

    return { plan: local };
  }
}

export async function duplicatePlan(planId: string): Promise<{ plan: LessonPlanRecord }> {
  const plan = await duplicatePlanLocally(planId);
  return { plan };
}

export async function getPlanExportBlob(planId: string, format: 'pdf' | 'docx'): Promise<Blob> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function exportPlan(planId: string, format: 'pdf' | 'docx'): Promise<void> {
  const blob = await getPlanExportBlob(planId, format);
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

export async function sharePlan(planId: string, format: 'pdf' | 'docx', title?: string): Promise<void> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `plan_${planId}.${ext}`;
  const { shareOrDownload } = await import('../../utils/share');
  await shareOrDownload(blob, filename, title ?? filename);
}
