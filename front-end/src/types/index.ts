// Database entity types based on master.sql schema

export type UserRole = 'teacher' | 'admin';

export interface User {
  id: number;
  role: UserRole;
  username: string;
  password: string;
  created_at: string; // ISO date string
}

export interface Class {
  id: number;
  name: string;
  description: string;
  grade_label: string;
  section_label: string;
  section: string;
  academic_year: string;
  default_duration_minutes: number;
  teacher_id: number;
  created_at: string; // ISO date string
}

export interface Subject {
  id: number;
  class_id: number;
  teacher_id: number;
  name: string;
  description: string;
  created_at: string; // ISO date string
}

export interface Unit {
  id: number;
  subject_id: number;
  teacher_id: number;
  name: string;
  description: string;
  created_at: string; // ISO date string
}

export interface Lesson {
  id: number;
  unit_id: number;
  teacher_id: number;
  name: string;
  description: string;
  content: string;
  number_of_periods: number;
  created_at: string; // ISO date string
}

export type LessonContentType = 'text' | 'pdf' | 'word';

export type AssignmentType = 'written' | 'varied' | 'practical';

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  written: 'واجبات كتابية',
  varied: 'أسئلة تقويم متنوعة',
  practical: 'أنشطة تطبيقية',
};

export interface Assignment {
  id: string;
  public_id: string;
  assignment_group_public_id?: string | null;
  teacher_id: number;
  lesson_plan_public_id: string;
  lesson_id: number;
  name: string;
  description: string | null;
  type: AssignmentType;
  content: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'open_ended';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'اختيار متعدد',
  true_false: 'صح / خطأ',
  fill_blank: 'إكمال الفراغ',
  open_ended: 'سؤال مفتوح',
};

export interface ExamQuestion {
  slot_id: string;
  question_number: number;
  lesson_id: number;
  lesson_name: string;
  bloom_level: string;
  bloom_level_label: string;
  question_type: QuestionType;
  marks: number;
  question_text: string;
  options?: string[];
  correct_option_index?: number;
  correct_answer?: boolean;
  answer_text: string;
  rubric?: string[];
}

export interface ExamBlueprintLesson {
  lesson_id: number;
  lesson_name: string;
  number_of_periods: number;
  topic_weight: number;
  objectives_count: number;
}

export interface ExamBlueprintLevel {
  level: string;
  level_label: string;
  objectives_count: number;
  level_weight: number;
}

export interface ExamBlueprintCell {
  lesson_id: number;
  lesson_name: string;
  lesson_order: number;
  level: string;
  level_label: string;
  level_order: number;
  topic_weight: number;
  level_weight: number;
  cell_weight: number;
  question_count: number;
  cell_marks: number;
  per_question_marks: number[];
}

export interface ExamBlueprint {
  lessons: ExamBlueprintLesson[];
  levels: ExamBlueprintLevel[];
  cells: ExamBlueprintCell[];
  totals: {
    total_lessons: number;
    total_objectives: number;
    total_periods: number;
    total_questions: number;
    total_marks: number;
  };
}

export interface Exam {
  id: string;
  public_id: string;
  teacher_id: number;
  class_id: number;
  subject_id: number;
  title: string;
  total_questions: number;
  total_marks: number;
  lesson_ids: number[];
  blueprint?: ExamBlueprint;
  questions?: ExamQuestion[];
  retry_occurred?: boolean;
  subject_name?: string;
  class_name?: string;
  class_grade_label?: string;
  created_at: string;
  updated_at: string;
}

export type PlanType = 'traditional' | 'active_learning';

export interface LessonPlanRecord {
  id: string;
  db_id: number;
  public_id: string;
  teacher_id: number;
  lesson_id: number | null;
  lesson_title: string;
  subject: string;
  grade: string;
  unit: string;
  duration_minutes: number;
  plan_type: PlanType;
  plan_json: Record<string, unknown> | null;
  validation_status: string;
  retry_occurred: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: number;
  username: string;
  role: UserRole;
  user_created_at: string;
  language: 'ar' | 'en';
  educational_stage: string | null;
  subject: string | null;
  preparation_type: string | null;
  default_lesson_duration_minutes: number;
  default_plan_type: 'traditional' | 'active_learning';
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdatePayload {
  language?: 'ar' | 'en';
  educational_stage?: string | null;
  subject?: string | null;
  preparation_type?: string | null;
  default_lesson_duration_minutes?: number;
  default_plan_type?: 'traditional' | 'active_learning';
}

export interface AdminTeacherProfileUpdatePayload
  extends UserProfileUpdatePayload {
  username?: string;
}

export interface TeacherUsageSummary {
  classes_count: number;
  subjects_count: number;
  units_count: number;
  lessons_count: number;
  generated_plans_count: number;
  plans_with_retry_count: number;
  generated_exams_count: number;
  generated_assignments_count: number;
  edited_assignments_count: number;
}

export interface TeacherManagementRow {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
  profile: {
    language: 'ar' | 'en';
    educational_stage: string | null;
    subject: string | null;
    preparation_type: string | null;
    default_lesson_duration_minutes: number;
    default_plan_type: 'traditional' | 'active_learning';
  };
  usage: TeacherUsageSummary;
}

export type StatsPeriod = 'all' | '30d' | '90d' | 'custom';

export interface StatsSummaryFilters {
  period?: StatsPeriod;
  date_from?: string;
  date_to?: string;
  teacher_id?: number | null;
}

export interface StatsKpis {
  plans_generated: number;
  avg_plan_quality: number;
  exams_generated: number;
  assignments_generated: number;
  first_pass_rate: number;
  retry_rate: number;
  assignment_edit_rate: number;
  avg_exam_questions: number;
  active_days: number;
  active_teachers?: number;
}

export interface StatsQualityCriteria {
  first_pass_reliability: number;
  structural_completeness: number;
  content_depth: number;
}

export interface StatsQualityDistribution {
  excellent: number;
  very_good: number;
  acceptable: number;
  needs_improvement: number;
}

export interface StatsQualityRubric {
  average_score: number;
  quality_band: string;
  criteria: StatsQualityCriteria;
  distribution: StatsQualityDistribution;
}

export interface StatsMonthlyTrendRow {
  month: string;
  month_label: string;
  plans: number;
  exams: number;
  assignments: number;
}

export interface StatsBreakdowns {
  plan_types: {
    traditional: number;
    active_learning: number;
  };
  assignment_types: {
    written: number;
    varied: number;
    practical: number;
  };
}

export type StatsTeacherRiskFlag =
  | 'low_quality'
  | 'high_retry'
  | 'high_assignment_churn';

export interface StatsTeacherPerformanceRow {
  teacher_id: number;
  username: string;
  plans_generated: number;
  avg_plan_quality: number;
  quality_band: string;
  first_pass_rate: number;
  retry_rate: number;
  exams_generated: number;
  assignments_generated: number;
  edited_assignments: number;
  assignment_edit_rate: number;
  last_activity_at: string | null;
  rubric_criteria_average: StatsQualityCriteria;
  risk_flags: StatsTeacherRiskFlag[];
}

export interface StatsSummaryResponse {
  kpis: StatsKpis;
  quality_rubric: StatsQualityRubric;
  trends: {
    monthly: StatsMonthlyTrendRow[];
  };
  breakdowns: StatsBreakdowns;
  admin?: {
    teacher_options: Array<{
      id: number;
      username: string;
    }>;
    teacher_performance: StatsTeacherPerformanceRow[];
    top_teachers: StatsTeacherPerformanceRow[];
    at_risk_teachers: StatsTeacherPerformanceRow[];
  };
  filters_applied: {
    scope: 'teacher' | 'admin_all' | 'admin_teacher';
    period: StatsPeriod;
    date_from: string | null;
    date_to: string | null;
    teacher_id: number | null;
    generated_at: string;
  };
}

export interface GenerateExamRequest {
  subject_id: number;
  lesson_ids: number[];
  total_questions: number;
  total_marks: number;
  title?: string;
}

export interface GenerateAssignmentsRequest {
  lesson_plan_public_id: string;
  lesson_id: number;
  lesson_plan?: Record<string, unknown>;
  lesson_content?: string;
}

export interface ModifyAssignmentRequest {
  assignment_id: string;
  modification_request: string;
}

export type RefinementArtifactType = 'lesson_plan' | 'assignment' | 'exam';
export type RefinementTargetMode = 'single' | 'batch';
export type RefinementStatus =
  | 'processing'
  | 'pending_approval'
  | 'failed'
  | 'blocked'
  | 'rejected'
  | 'approved'
  | 'no_changes';

export interface RefinementValidationResult {
  is_valid: boolean;
  errors: ApiErrorDetail[];
}

export interface RefinementRequestRecord {
  id: string;
  public_id: string;
  artifact_type: RefinementArtifactType;
  target_mode: RefinementTargetMode;
  artifact_public_id: string | null;
  assignment_group_public_id: string | null;
  base_revision_ids: number[];
  feedback_text: string;
  target_selector: string | null;
  include_alternatives: boolean;
  status: RefinementStatus;
  reason_summary: string | null;
  warnings: ApiErrorDetail[];
  decision: 'approve' | 'reject' | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefinementProposal {
  attempt_id: number;
  candidate_artifact: Record<string, unknown> | null;
  changed_fields: string[];
  reason_summary: string | null;
  warnings: ApiErrorDetail[];
  validation_result: RefinementValidationResult;
  alternatives: unknown;
}

export interface CreateRefinementRequestPayload {
  artifact_type: RefinementArtifactType;
  target_mode: RefinementTargetMode;
  artifact_id?: string;
  assignment_group_id?: string;
  feedback_text: string;
  target_selector?: string;
  include_alternatives?: boolean;
}

export interface ApiErrorDetail {
  code?: string;
  path?: string;
  field?: string;
  message: string;
}

export interface AssignmentsApiError {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

// API response types (for login responses)
export interface AuthUser {
  id: number;
  username: string;
  userRole: UserRole;
  createdAt: string;
  profile?: UserProfile;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// Form types for creating/updating entities
export interface CreateUserData {
  role: UserRole;
  username: string;
  password: string;
}

export interface CreateClassData {
  name: string;
  description: string;
  grade_label: string;
  section_label: string;
  section?: string;
  academic_year: string;
  default_duration_minutes?: number;
  teacher_id: number;
}

export interface CreateSubjectData {
  class_id: number;
  teacher_id: number;
  name: string;
  description: string;
}

export interface CreateUnitData {
  subject_id: number;
  teacher_id: number;
  name: string;
  description: string;
}

export interface CreateLessonData {
  unit_id: number;
  teacher_id: number;
  name: string;
  description: string;
  content: string;
  number_of_periods?: number;
  content_type?: LessonContentType;
}

// Update types (partial updates)
export type UpdateUserData = Partial<CreateUserData>;
export type UpdateClassData = Partial<CreateClassData>;
export type UpdateSubjectData = Partial<CreateSubjectData>;
export type UpdateUnitData = Partial<CreateUnitData>;
export type UpdateLessonData = Partial<CreateLessonData>;
