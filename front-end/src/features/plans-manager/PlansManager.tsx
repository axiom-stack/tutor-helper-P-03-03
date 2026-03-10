import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdRefresh,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { LessonPlanRecord, TeacherManagementRow } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import LessonPlanDocumentView from '../lesson-plans/components/LessonPlanDocumentView';
import {
  toPlanTypeLabel,
  toValidationStatusLabel,
} from '../lesson-plans/planDisplay';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import { listTeachers } from '../users/users.services';
import {
  exportPlan,
  getPlanById,
  listPlans,
  type ListPlansFilters,
} from './plans-manager.services';
import './plans-manager.css';

type PlanTypeFilter = '' | 'traditional' | 'active_learning';

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

  const [planType, setPlanType] = useState<PlanTypeFilter>('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const plansRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const isFirstTextFilterEffectRef = useRef(true);

  const teacherNameMap = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher.username]));
  }, [teachers]);

  const buildFilters = (): ListPlansFilters => {
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
    return filters;
  };

  const loadPlans = async () => {
    const requestId = ++plansRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listPlans(buildFilters());

      if (requestId !== plansRequestIdRef.current) {
        return;
      }

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
      if (requestId !== plansRequestIdRef.current) {
        return;
      }
      setError(normalizeApiError(loadError, 'فشل تحميل الخطط.').message);
    } finally {
      if (requestId === plansRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planType]);

  useEffect(() => {
    if (isFirstTextFilterEffectRef.current) {
      isFirstTextFilterEffectRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPlans();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, grade]);

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

  const handleSelectPlan = async (plan: LessonPlanRecord) => {
    setSelectedPlan(plan);
    setDetailLoading(true);
    setError(null);

    const requestId = ++detailRequestIdRef.current;

    try {
      const response = await getPlanById(plan.public_id);
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setSelectedPlan(response.plan);
    } catch (detailError: unknown) {
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setError(normalizeApiError(detailError, 'فشل تحميل تفاصيل الخطة.').message);
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
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

  const clearFilters = () => {
    setPlanType('');
    setSubject('');
    setGrade('');
  };

  const handleRefinementCommitted = async () => {
    if (!selectedPlan?.public_id) {
      return;
    }

    const [detailResponse] = await Promise.all([
      getPlanById(selectedPlan.public_id),
      loadPlans(),
    ]);
    setSelectedPlan(detailResponse.plan);
  };

  return (
    <div className="pm">
      <header className="pm__header">
        <div>
          <h1>إدارة الخطط المولدة</h1>
          <p>
            استعرض الخطط بسرعة، فلتر النتائج لحظيًا، وافتح الخطة بنفس التنسيق
            المعتمد في صفحة إنشاء الخطط.
          </p>
        </div>
      </header>

      {error ? (
        <div className="pm__alert pm__alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="pm__filters" aria-label="مرشحات الخطط">
        <div className="pm__field">
          <label htmlFor="pm-plan-type">نوع الخطة</label>
          <select
            id="pm-plan-type"
            value={planType}
            onChange={(event) => setPlanType(event.target.value as PlanTypeFilter)}
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

        <div className="pm__filter-actions">
          <button
            type="button"
            className="pm__btn pm__btn--ghost"
            onClick={clearFilters}
            disabled={!planType && !subject && !grade}
          >
            مسح الكل
          </button>
          <button
            type="button"
            className="pm__btn pm__btn--subtle"
            onClick={() => void loadPlans()}
            disabled={loading}
            aria-busy={loading}
          >
            <MdRefresh aria-hidden />
            {loading ? 'جارٍ التحديث...' : 'تحديث'}
          </button>
        </div>
      </section>

      <section className="pm__layout">
        <article className="pm__list" aria-busy={loading}>
          <header className="pm__section-head">
            <h2>قائمة الخطط</h2>
            <span className="pm__count">{plans.length} خطة</span>
          </header>

          {loading && plans.length === 0 ? (
            <p className="pm__state">جاري التحميل...</p>
          ) : plans.length === 0 ? (
            <p className="pm__state">لا توجد خطط مطابقة للفلاتر الحالية.</p>
          ) : (
            <div className="pm__cards" role="list">
              {plans.map((plan) => {
                const isActive = plan.public_id === selectedPlan?.public_id;
                return (
                  <button
                    key={plan.public_id}
                    type="button"
                    className={isActive ? 'pm__card pm__card--active' : 'pm__card'}
                    onClick={() => void handleSelectPlan(plan)}
                    aria-pressed={isActive}
                  >
                    <div className="pm__card-top">
                      <strong>{plan.lesson_title}</strong>
                      <span>{formatDateAr(plan.created_at)}</span>
                    </div>
                    <div className="pm__card-meta">
                      <span>{plan.public_id}</span>
                      <span>{toPlanTypeLabel(plan.plan_type)}</span>
                    </div>
                    <div className="pm__card-meta">
                      <span>{plan.subject}</span>
                      <span>{plan.grade}</span>
                    </div>
                    {isAdmin ? (
                      <div className="pm__card-meta">
                        <span>المعلم</span>
                        <span>
                          {teacherNameMap.get(plan.teacher_id) || `#${plan.teacher_id}`}
                        </span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <article className="pm__detail-wrap">
          <div className="pm__detail" aria-busy={detailLoading}>
            <header className="pm__section-head pm__section-head--detail">
              <div>
                <h2>تفاصيل الخطة</h2>
                <p>عرض مفصل بنفس تنسيق صفحة إنشاء الخطط.</p>
              </div>
              <div className="pm__export-actions">
                <button
                  type="button"
                  className="pm__btn pm__btn--subtle"
                  disabled={!selectedPlan || isExporting}
                  onClick={() => handleExport('pdf')}
                  aria-busy={isExporting}
                >
                  <MdOutlinePictureAsPdf aria-hidden />
                  PDF
                </button>
                <button
                  type="button"
                  className="pm__btn pm__btn--subtle"
                  disabled={!selectedPlan || isExporting}
                  onClick={() => handleExport('docx')}
                  aria-busy={isExporting}
                >
                  <MdOutlineTextSnippet aria-hidden />
                  Word
                </button>
              </div>
            </header>

            {!selectedPlan ? (
              <p className="pm__state">اختر خطة من القائمة لعرض التفاصيل.</p>
            ) : (
              <div className="pm__detail-content">
                <div className="pm__chips">
                  <span className="pm__chip">المعرف: {selectedPlan.public_id}</span>
                  <span className="pm__chip">
                    النوع: {toPlanTypeLabel(selectedPlan.plan_type)}
                  </span>
                  <span className="pm__chip">
                    الحالة: {toValidationStatusLabel(selectedPlan.validation_status)}
                  </span>
                  <span className="pm__chip">
                    إعادة التحسين: {selectedPlan.retry_occurred ? 'نعم' : 'لا'}
                  </span>
                  <span className="pm__chip">المادة: {selectedPlan.subject}</span>
                  <span className="pm__chip">المرحلة: {selectedPlan.grade}</span>
                  <span className="pm__chip">
                    مدة الحصة: {selectedPlan.duration_minutes} دقيقة
                  </span>
                  {isAdmin ? (
                    <span className="pm__chip">
                      المعلم: {teacherNameMap.get(selectedPlan.teacher_id) || `#${selectedPlan.teacher_id}`}
                    </span>
                  ) : null}
                </div>

                {detailLoading ? (
                  <p className="pm__state pm__state--inline">جاري تحديث تفاصيل الخطة...</p>
                ) : null}

                <LessonPlanDocumentView
                  planType={selectedPlan.plan_type}
                  planJson={selectedPlan.plan_json}
                  fallback={{
                    lessonTitle: selectedPlan.lesson_title,
                    subject: selectedPlan.subject,
                    grade: selectedPlan.grade,
                    unit: selectedPlan.unit,
                    durationMinutes: selectedPlan.duration_minutes,
                  }}
                />

                <SmartRefinementPanel
                  artifactType="lesson_plan"
                  artifactId={selectedPlan.public_id}
                  baseArtifact={{
                    id: selectedPlan.public_id,
                    plan_type: selectedPlan.plan_type,
                    lesson_title: selectedPlan.lesson_title,
                    subject: selectedPlan.subject,
                    grade: selectedPlan.grade,
                    unit: selectedPlan.unit,
                    duration_minutes: selectedPlan.duration_minutes,
                    plan_json: selectedPlan.plan_json ?? {},
                  }}
                  targetSelectors={getRefinementTargetOptions('lesson_plan')}
                  onCommitted={handleRefinementCommitted}
                />
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
