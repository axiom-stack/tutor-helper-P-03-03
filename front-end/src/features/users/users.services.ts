import { authAxios } from '../auth/auth.services';
import type {
  AdminTeacherProfileUpdatePayload,
  TeacherManagementRow,
  UserProfile,
  UserProfileUpdatePayload,
} from '../../types';

const api = () => authAxios();

export async function getMyProfile(): Promise<{ profile: UserProfile }> {
  const response = await api().get<{ profile: UserProfile }>('/api/users/me/profile');
  return response.data;
}

export async function updateMyProfile(
  payload: UserProfileUpdatePayload
): Promise<{ profile: UserProfile }> {
  const response = await api().put<{ profile: UserProfile }>(
    '/api/users/me/profile',
    payload
  );
  return response.data;
}

export async function listTeachers(): Promise<{
  teachers: TeacherManagementRow[];
}> {
  const response = await api().get<{ teachers: TeacherManagementRow[] }>(
    '/api/users/teachers'
  );
  return response.data;
}

export async function createTeacher(payload: {
  username: string;
  password: string;
}): Promise<{ teacher: { id: number; username: string; role: string } }> {
  const response = await api().post<{
    teacher: { id: number; username: string; role: string };
  }>('/api/users/teachers', payload);
  return response.data;
}

export async function updateTeacherProfile(
  teacherId: number,
  payload: AdminTeacherProfileUpdatePayload
): Promise<{ profile: UserProfile }> {
  const response = await api().put<{ profile: UserProfile }>(
    `/api/users/teachers/${teacherId}/profile`,
    payload
  );
  return response.data;
}

export async function deleteTeacher(
  teacherId: number
): Promise<{ teacher: { id: number; username: string; role: string } }> {
  const response = await api().delete<{
    teacher: { id: number; username: string; role: string };
  }>(`/api/users/teachers/${teacherId}`);

  return response.data;
}
