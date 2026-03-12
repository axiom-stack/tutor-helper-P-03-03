import type {
  Assignment,
  CreateRefinementRequestPayload,
  Exam,
  GenerateAssignmentsRequest,
  GenerateExamRequest,
  LessonPlanRecord,
} from '../types';
import type { GeneratePlanRequest } from '../features/lesson-creator/lesson-creator.services';

export type OfflineEntityType = 'lesson_plan' | 'assignment' | 'exam';

export type OfflineSyncStatus =
  | 'synced'
  | 'pending_sync'
  | 'queued_generation'
  | 'queued_ai'
  | 'local_only'
  | 'conflict'
  | 'sync_error';

export interface OfflineEntityMeta {
  local_id: string;
  server_id: string | null;
  sync_status: OfflineSyncStatus;
  local_revision: number;
  server_updated_at: string | null;
  origin_server_id?: string | null;
  last_sync_error?: string | null;
}

export type OfflineLessonPlanRecord = LessonPlanRecord & OfflineEntityMeta;
export type OfflineAssignmentRecord = Assignment & OfflineEntityMeta;
export type OfflineExamRecord = Exam & OfflineEntityMeta;

export interface OfflineDraftRecord<T = unknown> {
  draft_id: string;
  entity_type: OfflineEntityType;
  record_local_id: string;
  route_key: string;
  payload: T;
  source: 'autosave' | 'queued_request_input';
  updated_at: string;
}

export type OfflineQueueActionType =
  | 'sync_plan_update'
  | 'sync_assignment_update'
  | 'sync_exam_update'
  | 'generate_plan'
  | 'generate_assignments'
  | 'generate_exam'
  | 'create_refinement'
  | 'retry_refinement';

export type OfflineQueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'stale'
  | 'conflict';

export interface OfflineQueueAction {
  queue_id: string;
  action_type: OfflineQueueActionType;
  entity_type: OfflineEntityType;
  target_local_id?: string | null;
  target_server_id?: string | null;
  request_payload:
    | Record<string, unknown>
    | GeneratePlanRequest
    | GenerateAssignmentsRequest
    | GenerateExamRequest
    | CreateRefinementRequestPayload;
  base_server_updated_at?: string | null;
  base_local_revision?: number | null;
  status: OfflineQueueStatus;
  attempt_count: number;
  last_error?: string | null;
  created_at: string;
  next_retry_at?: string | null;
}

export interface OfflineReferenceRecord<T = unknown> {
  cache_key: string;
  kind: string;
  server_id?: string | number | null;
  payload: T;
  updated_at: string;
}

export interface OfflineCounterRecord {
  key: string;
  value: number;
  updated_at: string;
}

