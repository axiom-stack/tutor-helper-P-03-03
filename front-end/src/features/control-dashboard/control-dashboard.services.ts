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
  role: UserRole,
  stage?: string
): Promise<{ classes: Class[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ classes: Class[] }>(
    scopePath(role, '/api/classes'),
    { params }
  );
  return response.data;
}

export async function getScopedSubjects(
  role: UserRole,
  stage?: string
): Promise<{ subjects: Subject[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ subjects: Subject[] }>(
    scopePath(role, '/api/subjects'),
    { params }
  );
  return response.data;
}

export async function getScopedLessons(
  role: UserRole,
  stage?: string
): Promise<{ lessons: Lesson[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ lessons: Lesson[] }>(
    scopePath(role, '/api/lessons'),
    { params }
  );
  return response.data;
}

export async function getScopedUnits(
  role: UserRole,
  stage?: string
): Promise<{ units: Unit[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ units: Unit[] }>(
    scopePath(role, '/api/units'),
    { params }
  );
  return response.data;
}

export async function listScopedPlans(stage?: string): Promise<{ plans: LessonPlanRecord[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ plans: LessonPlanRecord[] }>(
    '/api/plans',
    { params }
  );
  return response.data;
}

export async function listScopedExams(stage?: string): Promise<{ exams: Exam[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ exams: Exam[] }>(
    '/api/exams',
    { params }
  );
  return response.data;
}

export async function listScopedAssignments(stage?: string): Promise<{ assignments: Assignment[] }> {
  const params: Record<string, string> = {};
  if (stage && stage !== 'all') {
    params.stage = stage;
  }
  const response = await api().get<{ assignments: Assignment[] }>(
    '/api/assignments',
    { params }
  );
  return response.data;
}

export interface StatsSummary {
  kpis: {
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
  };
  quality_rubric: {
    average_score: number;
    quality_band: string;
    criteria: {
      first_pass_reliability: number;
      structural_completeness: number;
      content_depth: number;
    };
    distribution: {
      excellent: number;
      very_good: number;
      acceptable: number;
      needs_improvement: number;
    };
  };
  trends: {
    monthly: Array<{
      month: string;
      month_label: string;
      plans: number;
      exams: number;
      assignments: number;
    }>;
  };
  breakdowns: {
    plan_types: {
      traditional: number;
      active_learning: number;
    };
    assignment_types: {
      written: number;
      varied: number;
      practical: number;
    };
  };
  filters_applied: {
    scope: string;
    period: string;
    stage?: string;
    date_from?: string | null;
    date_to?: string | null;
    teacher_id?: number | null;
    generated_at: string;
  };
  admin?: {
    teacher_options: Array<{
      id: number;
      username: string;
      display_name: string | null;
    }>;
    teacher_performance: Array<{
      teacher_id: number;
      username: string;
      display_name: string;
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
      risk_flags: string[];
    }>;
    top_teachers: Array<{
      teacher_id: number;
      username: string;
      display_name: string;
      plans_generated: number;
      avg_plan_quality: number;
    }>;
    at_risk_teachers: Array<{
      teacher_id: number;
      username: string;
      display_name: string;
      plans_generated: number;
      avg_plan_quality: number;
      risk_flags: string[];
    }>;
  };
}

export async function getSummary(filters: {
  period: string;
  stage?: string;
  date_from?: string;
  date_to?: string;
  teacher_id?: number;
}): Promise<StatsSummary> {
  const response = await api().get<StatsSummary>('/api/stats/summary', {
    params: filters,
  });
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
