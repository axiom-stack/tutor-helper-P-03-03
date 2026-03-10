import { authAxios } from '../auth/auth.services';
import type { StatsSummaryFilters, StatsSummaryResponse } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';

const api = () => authAxios();

function buildParams(filters: StatsSummaryFilters = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (filters.period) {
    params.period = filters.period;
  }

  if (filters.date_from) {
    params.date_from = filters.date_from;
  }

  if (filters.date_to) {
    params.date_to = filters.date_to;
  }

  if (filters.teacher_id != null) {
    params.teacher_id = filters.teacher_id;
  }

  return params;
}

export async function getStatsSummary(
  filters: StatsSummaryFilters = {}
): Promise<StatsSummaryResponse> {
  try {
    const response = await api().get<StatsSummaryResponse>('/api/stats/summary', {
      params: buildParams(filters),
    });

    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error, 'تعذر تحميل بيانات الإحصائيات.');
  }
}

export async function exportStatsPdf(
  filters: StatsSummaryFilters = {}
): Promise<void> {
  try {
    const response = await api().get('/api/stats/export', {
      params: {
        ...buildParams(filters),
        format: 'pdf',
      },
      responseType: 'blob',
    });

    const blob = response.data as Blob;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `stats_report_${date}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'فشل تصدير تقرير الإحصائيات.');
  }
}
