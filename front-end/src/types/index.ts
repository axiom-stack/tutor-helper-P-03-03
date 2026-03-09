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
  content_type?: LessonContentType;
}

// Update types (partial updates)
export type UpdateUserData = Partial<CreateUserData>;
export type UpdateClassData = Partial<CreateClassData>;
export type UpdateSubjectData = Partial<CreateSubjectData>;
export type UpdateUnitData = Partial<CreateUnitData>;
export type UpdateLessonData = Partial<CreateLessonData>;
