import { useEffect, useMemo, useState } from 'react';
import {
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdRefresh,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { LessonPlanRecord, TeacherManagementRow } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { listTeachers } from '../users/users.services';
import {
  exportPlan,
  getPlanById,
  listPlans,
  type ListPlansFilters,
} from './plans-manager.services';
import './plans-manager.css';

function formatDateAr(value: string): string {
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function PlansManager() {
  const { user } = useAuth();
  const isAdmin = user?.userRole === 'admin';

  const [plans, setPlans] = useState<LessonPlanRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlanRecord | null>(null);
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);

  const [planType, setPlanType] = useState<'' | 'traditional' | 'active_learning'>(
    ''
  );
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const teacherNameMap = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher.username]));
  }, [teachers]);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);

    const filters: ListPlansFilters = {};
    if (planType) {
      filters.plan_type = planType;
    }
    if (subject.trim()) {
      filters.subject = subject.trim();
    }
    if (grade.trim()) {
      filters.grade = grade.trim();
    }

    try {
      const response = await listPlans(filters);
      const nextPlans = response.plans ?? [];
      setPlans(nextPlans);

      setSelectedPlan((current) => {
        if (!current) {
          return nextPlans[0] ?? null;
        }
        return (
          nextPlans.find((plan) => plan.public_id === current.public_id) ??
          nextPlans[0] ??
          null
        );
      });
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل الخطط.').message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let cancelled = false;
    listTeachers()
      .then((response) => {
        if (!cancelled) {
          setTeachers(response.teachers ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeachers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleSelectPlan = async (planId: string) => {
    setDetailLoading(true);
    setError(null);

    try {
      const response = await getPlanById(planId);
      setSelectedPlan(response.plan);
    } catch (detailError: unknown) {
      setError(normalizeApiError(detailError, 'فشل تحميل تفاصيل الخطة.').message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'docx') => {
    if (!selectedPlan?.public_id || isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);

    exportPlan(selectedPlan.public_id, format)
      .catch(() => setError('فشل تصدير الخطة.'))
      .finally(() => setIsExporting(false));
  };

  return (
    <div className="pm" dir="rtl">
      <header className="pm__header">
        <h1>إدارة الخطط المولدة</h1>
        <p>قائمة موحدة للخطط مع الفلاتر وتفاصيل الجودة المتاحة.</p>
      </header>

      <section className="pm__filters">
        <div className="pm__field">
          <label htmlFor="pm-plan-type">نوع الخطة</label>
          <select
            id="pm-plan-type"
            value={planType}
            onChange={(event) =>
              setPlanType(
                event.target.value as '' | 'traditional' | 'active_learning'
              )
            }
          >
            <option value="">الكل</option>
            <option value="traditional">تقليدية</option>
            <option value="active_learning">تعلم نشط</option>
          </select>
        </div>

        <div className="pm__field">
          <label htmlFor="pm-subject">المادة</label>
          <input
            id="pm-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="مثال: الرياضيات"
          />
        </div>

        <div className="pm__field">
          <label htmlFor="pm-grade">المرحلة/الصف</label>
          <input
            id="pm-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="مثال: الصف الثامن"
          />
        </div>

        <button
          type="button"
          className="pm__refresh"
          onClick={() => void loadPlans()}
          disabled={loading}
        >
          <MdRefresh aria-hidden />
          {loading ? 'جارٍ التحديث...' : 'تحديث'}
        </button>
      </section>

      {error ? <div className="pm__error">{error}</div> : null}

      <section className="pm__layout">
        <article className="pm__list">
          <h2>قائمة الخطط</h2>
          {loading ? (
            <p className="pm__state">جاري التحميل...</p>
          ) : plans.length === 0 ? (
            <p className="pm__state">لا توجد خطط مطابقة للفلاتر.</p>
          ) : (
            <div className="pm__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المعرف</th>
                    <th>الدرس</th>
                    <th>المادة</th>
                    <th>المرحلة</th>
                    {isAdmin ? <th>المعلم</th> : null}
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.public_id}
                      className={
                        plan.public_id === selectedPlan?.public_id
                          ? 'pm__row--active'
                          : ''
                      }
                      onClick={() => void handleSelectPlan(plan.public_id)}
                    >
                      <td>{plan.public_id}</td>
                      <td>{plan.lesson_title}</td>
                      <td>{plan.subject}</td>
                      <td>{plan.grade}</td>
                      {isAdmin ? (
                        <td>
                          {teacherNameMap.get(plan.teacher_id) ||
                            `#${plan.teacher_id}`}
                        </td>
                      ) : null}
                      <td>{formatDateAr(plan.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="pm__detail">
          <header>
            <h2>تفاصيل الخطة</h2>
            <div className="pm__export-actions">
              <button
                type="button"
                disabled={!selectedPlan || isExporting}
                onClick={() => handleExport('pdf')}
              >
                <MdOutlinePictureAsPdf aria-hidden />
                PDF
              </button>
              <button
                type="button"
                disabled={!selectedPlan || isExporting}
                onClick={() => handleExport('docx')}
              >
                <MdOutlineTextSnippet aria-hidden />
                Word
              </button>
            </div>
          </header>

          {!selectedPlan ? (
            <p className="pm__state">اختر خطة من القائمة لعرض التفاصيل.</p>
          ) : detailLoading ? (
            <p className="pm__state">جاري تحميل التفاصيل...</p>
          ) : (
            <div className="pm__detail-content">
              <div className="pm__meta-grid">
                <span>
                  <strong>المعرف:</strong> {selectedPlan.public_id}
                </span>
                <span>
                  <strong>النوع:</strong>{' '}
                  {selectedPlan.plan_type === 'traditional'
                    ? 'تقليدية'
                    : 'تعلم نشط'}
                </span>
                <span>
                  <strong>المادة:</strong> {selectedPlan.subject}
                </span>
                <span>
                  <strong>المرحلة:</strong> {selectedPlan.grade}
                </span>
                <span>
                  <strong>مدة الحصة:</strong> {selectedPlan.duration_minutes} دقيقة
                </span>
                <span>
                  <strong>الحالة:</strong> {selectedPlan.validation_status}
                </span>
                <span>
                  <strong>إعادة التحسين:</strong>{' '}
                  {selectedPlan.retry_occurred ? 'نعم' : 'لا'}
                </span>
                {isAdmin ? (
                  <span>
                    <strong>المعلم:</strong>{' '}
                    {teacherNameMap.get(selectedPlan.teacher_id) ||
                      `#${selectedPlan.teacher_id}`}
                  </span>
                ) : null}
              </div>

              <pre className="pm__json">
                {JSON.stringify(selectedPlan.plan_json ?? {}, null, 2)}
              </pre>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
