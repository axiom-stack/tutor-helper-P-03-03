import { authAxios } from '../auth/auth.services';
import type {
  CreateRefinementRequestPayload,
  RefinementProposal,
  RefinementRequestRecord,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';

const api = () => authAxios();

export interface RefinementResponse {
  refinement_request: RefinementRequestRecord;
  proposal: RefinementProposal | null;
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
  source: 'seed' | 'refinement_approval' | 'revert';
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
): Promise<RefinementResponse> {
  try {
    const response = await api().post<RefinementResponse>('/api/refinements', payload);
    return response.data;
  } catch (error: unknown) {
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
