import { authAxios } from '../auth/auth.services';
import type {
  Assignment,
  GenerateAssignmentsRequest,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';

const api = () => authAxios();

interface GenerateAssignmentsResponse {
  assignments: Assignment[];
}

interface ListAssignmentsResponse {
  assignments: Assignment[];
}

interface GetAssignmentResponse {
  assignment: Assignment;
}

type GenerateAssignmentsExtras = Pick<
  GenerateAssignmentsRequest,
  'lesson_plan' | 'lesson_content'
>;

export async function generateAssignments(
  lessonPlanPublicId: string,
  lessonId: number,
  optionalBody?: Partial<GenerateAssignmentsExtras>
): Promise<GenerateAssignmentsResponse> {
  const payload: GenerateAssignmentsRequest = {
    lesson_plan_public_id: lessonPlanPublicId,
    lesson_id: lessonId,
    ...(optionalBody ?? {}),
  };

  try {
    const response = await api().post<GenerateAssignmentsResponse>(
      '/api/assignments/generate',
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل توليد الواجبات.');
  }
}

export async function listAssignments(
  lessonPlanPublicId?: string,
  lessonId?: number
): Promise<ListAssignmentsResponse> {
  const params: Record<string, string | number> = {};

  if (lessonPlanPublicId) {
    params.lesson_plan_public_id = lessonPlanPublicId;
  }
  if (lessonId != null) {
    params.lesson_id = lessonId;
  }

  try {
    const response = await api().get<ListAssignmentsResponse>(
      '/api/assignments',
      {
        params,
      }
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل تحميل الواجبات.');
  }
}

export async function getAssignmentById(id: string): Promise<GetAssignmentResponse> {
  try {
    const response = await api().get<GetAssignmentResponse>(
      `/api/assignments/${id}`
    );
    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل تحميل تفاصيل الواجب.');
  }
}

/**
 * Download assignment export (PDF or DOCX) and trigger browser save.
 */
export async function exportAssignment(
  assignmentId: string,
  format: 'pdf' | 'docx'
): Promise<void> {
  const response = await api().get(`/api/assignments/${assignmentId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `assignment_${assignmentId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
