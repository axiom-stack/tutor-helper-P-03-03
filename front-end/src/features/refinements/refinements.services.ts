import { authAxios } from '../auth/auth.services';
import type {
  CreateRefinementRequestPayload,
  RefinementProposal,
  RefinementRequestRecord,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { isOfflineError } from '../../offline/network';
import { enqueueOfflineAction } from '../../offline/queue';
import { getCachedAssignmentById } from '../../offline/assignments';
import { getCachedExamById } from '../../offline/exams';
import { getCachedPlanById } from '../../offline/plans';

const api = () => authAxios();

export interface RefinementResponse {
  refinement_request: RefinementRequestRecord;
  proposal: RefinementProposal | null;
}

export interface QueuedRefinementResponse {
  queued: true;
  queue_id: string;
  message: string;
}

export interface ListRefinementsResponse {
  refinements: RefinementRequestRecord[];
}

export interface ArtifactRevisionRecord {
  id: number;
  artifact_type: 'lesson_plan' | 'assignment' | 'exam';
  artifact_public_id: string;
  revision_number: number;
  parent_revision_id: number | null;
  payload: Record<string, unknown>;
  is_current: boolean;
  source: 'seed' | 'refinement_approval' | 'manual_edit' | 'revert';
  refinement_request_id: number | null;
  created_by_user_id: number;
  created_by_role: 'teacher' | 'admin';
  created_at: string;
}

export interface ApproveRefinementPayload {
  decision_note?: string | null;
  expected_base_revision_ids: number[];
}

export interface RejectRefinementPayload {
  decision_note?: string | null;
}

export interface RevertRefinementPayload {
  artifact_type: 'lesson_plan' | 'assignment' | 'exam';
  artifact_id: string;
  target_revision_id: number;
  reason?: string;
}

export async function createRefinement(
  payload: CreateRefinementRequestPayload
): Promise<RefinementResponse | QueuedRefinementResponse> {
  try {
    const response = await api().post<RefinementResponse>('/api/refinements', payload);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      const cachedRecord =
        (payload.artifact_id ? await getCachedPlanById(payload.artifact_id) : null) ??
        (payload.artifact_id ? await getCachedAssignmentById(payload.artifact_id) : null) ??
        (payload.artifact_id ? await getCachedExamById(payload.artifact_id) : null);

      const queued = await enqueueOfflineAction({
        action_type: 'create_refinement',
        entity_type: payload.artifact_type,
        target_local_id: cachedRecord?.local_id ?? payload.artifact_id ?? null,
        target_server_id: payload.artifact_id ?? null,
        request_payload: payload,
        base_local_revision: cachedRecord?.local_revision ?? null,
        last_error: null,
        next_retry_at: null,
      });

      return {
        queued: true,
        queue_id: queued.queue_id,
        message: 'تمت جدولة طلب التحسين وسيعاد تشغيله عند عودة الاتصال.',
      };
    }
    throw normalizeApiError(error, 'تعذر إنشاء طلب التحسين.');
  }
}

export async function getRefinementById(refinementId: string): Promise<RefinementResponse> {
  try {
    const response = await api().get<RefinementResponse>(`/api/refinements/${refinementId}`);
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر تحميل طلب التحسين.');
  }
}

export async function retryRefinement(refinementId: string): Promise<RefinementResponse> {
  try {
    const response = await api().post<RefinementResponse>(`/api/refinements/${refinementId}/retry`);
    return response.data;
  } catch (error: unknown) {
    if (isOfflineError(error)) {
      await enqueueOfflineAction({
        action_type: 'retry_refinement',
        entity_type: 'lesson_plan',
        target_server_id: refinementId,
        request_payload: {},
        last_error: null,
        next_retry_at: null,
      });
      throw normalizeApiError(
        'تمت جدولة إعادة المحاولة وسيعاد تشغيلها عند عودة الاتصال.',
        'تمت جدولة إعادة المحاولة وسيعاد تشغيلها عند عودة الاتصال.'
      );
    }
    throw normalizeApiError(error, 'تعذر إعادة تشغيل التحسين.');
  }
}

export async function approveRefinement(
  refinementId: string,
  payload: ApproveRefinementPayload
): Promise<{ refinement_request: RefinementRequestRecord }> {
  try {
    const response = await api().post<{ refinement_request: RefinementRequestRecord }>(
      `/api/refinements/${refinementId}/approve`,
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر اعتماد التحسين.');
  }
}

export async function rejectRefinement(
  refinementId: string,
  payload: RejectRefinementPayload
): Promise<{ refinement_request: RefinementRequestRecord }> {
  try {
    const response = await api().post<{ refinement_request: RefinementRequestRecord }>(
      `/api/refinements/${refinementId}/reject`,
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر رفض التحسين.');
  }
}

export interface ListRefinementHistoryFilters {
  artifact_type?: 'lesson_plan' | 'assignment' | 'exam';
  artifact_id?: string;
  assignment_group_id?: string;
  status?: string;
  limit?: number;
}

export async function listRefinementHistory(
  filters: ListRefinementHistoryFilters = {}
): Promise<ListRefinementsResponse> {
  try {
    const response = await api().get<ListRefinementsResponse>('/api/refinements/history', {
      params: filters,
    });
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر تحميل سجل التحسينات.');
  }
}

export async function listArtifactRevisions(filters: {
  artifact_type: 'lesson_plan' | 'assignment' | 'exam';
  artifact_id: string;
  limit?: number;
}): Promise<{ revisions: ArtifactRevisionRecord[] }> {
  try {
    const response = await api().get<{ revisions: ArtifactRevisionRecord[] }>(
      '/api/refinements/revisions',
      { params: filters }
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر تحميل نسخ المستند.');
  }
}

export async function revertArtifactRevision(
  payload: RevertRefinementPayload
): Promise<{ revision: { id: number } }> {
  try {
    const response = await api().post<{ revision: { id: number } }>(
      '/api/refinements/revert',
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر استرجاع النسخة.');
  }
}
