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
}

// Update types (partial updates)
export interface UpdateUserData extends Partial<CreateUserData> {}
export interface UpdateClassData extends Partial<CreateClassData> {}
export interface UpdateSubjectData extends Partial<CreateSubjectData> {}
export interface UpdateUnitData extends Partial<CreateUnitData> {}
export interface UpdateLessonData extends Partial<CreateLessonData> {}