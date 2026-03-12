import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MdClose,
  MdContentCopy,
  MdEdit,
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdRefresh,
  MdSave,
  MdWhatsapp,
} from 'react-icons/md';
import { SyncStatusBadge } from '../../components/common/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';
import type { LessonPlanRecord, TeacherManagementRow } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts';
import { useOffline } from '../../offline/useOffline';
import type { OfflineLessonPlanRecord } from '../../offline/types';
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
  duplicatePlan,
  updatePlan,
  sharePlan,
  type ListPlansFilters,
} from './plans-manager.services';
import './plans-manager.css';

type PlanTypeFilter = '' | 'traditional' | 'active_learning';

interface PlanDraft {
  lessonTitle: string;
  planJson: Record<string, unknown>;
}

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

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default function PlansManager() {
  const { user } = useAuth();
  const { lastSyncAt } = useOffline();
  const isAdmin = user?.userRole === 'admin';

  const [plans, setPlans] = useState<OfflineLessonPlanRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<OfflineLessonPlanRecord | null>(null);
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);

  const [planType, setPlanType] = useState<PlanTypeFilter>('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [draftRecoveredNotice, setDraftRecoveredNotice] = useState<string | null>(null);

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

      const nextPlans = (response.plans ?? []) as OfflineLessonPlanRecord[];
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
      const message = normalizeApiError(loadError, 'فشل تحميل الخطط.').message;
      setError(message);
      toast.error(message);
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
    if (!lastSyncAt || isEditingPlan) {
      return;
    }

    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt]);

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

  useEffect(() => {
    setIsEditingPlan(false);
    setIsSavingPlan(false);
    setPlanDraft(null);
    setDraftRecoveredNotice(null);
  }, [selectedPlan?.local_id]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    let cancelled = false;

    getDraft<PlanDraft>('plans-manager', selectedPlan.local_id)
      .then((draft) => {
        if (!draft || cancelled) {
          return;
        }

        if (draft.updated_at > selectedPlan.updated_at) {
          setPlanDraft(draft.payload);
          setIsEditingPlan(true);
          setDraftRecoveredNotice('تمت استعادة مسودة الخطة المحلية بعد إعادة فتح الصفحة.');
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlan]);

  useEffect(() => {
    if (!isEditingPlan || !planDraft || !selectedPlan) {
      return;
    }

    const persistDraft = () =>
      saveDraft({
        entityType: 'lesson_plan',
        recordLocalId: selectedPlan.local_id,
        routeKey: 'plans-manager',
        payload: planDraft,
      });

    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 1200);

    const flushDraft = () => {
      void persistDraft();
    };

    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', flushDraft);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', flushDraft);
      document.removeEventListener('visibilitychange', flushDraft);
    };
  }, [isEditingPlan, planDraft, selectedPlan]);

  const buildPlanDraft = (plan: LessonPlanRecord): PlanDraft => ({
    lessonTitle: plan.lesson_title,
    planJson: cloneValue(plan.plan_json ?? {}),
  });

  const syncPlanInList = (updatedPlan: OfflineLessonPlanRecord) => {
    setPlans((current) =>
      current.map((plan) =>
        plan.local_id === updatedPlan.local_id ? updatedPlan : plan
      )
    );
  };

  const handleSelectPlan = async (plan: OfflineLessonPlanRecord) => {
    if (isEditingPlan) {
      toast.error('احفظ تعديلات الخطة الحالية أو ألغها قبل فتح خطة أخرى.');
      return;
    }

    setSelectedPlan(plan);
    setDetailLoading(true);
    setError(null);

    const requestId = ++detailRequestIdRef.current;

    try {
      const response = await getPlanById(plan.public_id);
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setSelectedPlan(response.plan as OfflineLessonPlanRecord);
    } catch (detailError: unknown) {
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      const message = normalizeApiError(detailError, 'فشل تحميل تفاصيل الخطة.').message;
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const handleExport = (format: 'pdf' | 'docx') => {
    if (!selectedPlan?.server_id || isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);

    exportPlan(selectedPlan.server_id, format)
      .catch(() => {
        setError('فشل تصدير الخطة.');
        toast.error('فشل تصدير الخطة.');
      })
      .finally(() => setIsExporting(false));
  };

  const handleShare = (format: 'pdf' | 'docx') => {
    if (!selectedPlan?.server_id || isExporting) {
      return;
    }
    setIsExporting(true);
    setError(null);
    sharePlan(selectedPlan.server_id, format, selectedPlan.lesson_title ?? undefined)
      .catch(() => {
        setError('فشل مشاركة الخطة.');
        toast.error('فشل مشاركة الخطة.');
      })
      .finally(() => setIsExporting(false));
  };

  const clearFilters = () => {
    setPlanType('');
    setSubject('');
    setGrade('');
  };

  const handleStartEditing = () => {
    if (!selectedPlan || detailLoading) {
      return;
    }

    setPlanDraft(buildPlanDraft(selectedPlan));
    setIsEditingPlan(true);
  };

  const handleCancelEditing = () => {
    setIsEditingPlan(false);
    setPlanDraft(null);
    if (selectedPlan) {
      void clearDraft('plans-manager', selectedPlan.local_id);
    }
  };

  const handleSavePlan = async () => {
    if (!selectedPlan || !planDraft || isSavingPlan) {
      return;
    }

    const nextPlanJson = cloneValue(planDraft.planJson);
    const currentHeader =
      nextPlanJson.header && typeof nextPlanJson.header === 'object' && !Array.isArray(nextPlanJson.header)
        ? (nextPlanJson.header as Record<string, unknown>)
        : {};

    nextPlanJson.header = {
      ...currentHeader,
      lesson_title: planDraft.lessonTitle,
    };

    setIsSavingPlan(true);
    setError(null);

    try {
      const response = await updatePlan(selectedPlan.public_id, {
        lesson_title: planDraft.lessonTitle,
        plan_json: nextPlanJson,
      });
      const nextPlan = response.plan as OfflineLessonPlanRecord;
      setSelectedPlan(nextPlan);
      syncPlanInList(nextPlan);
      setIsEditingPlan(false);
      setPlanDraft(null);
      await clearDraft('plans-manager', selectedPlan.local_id);
      toast.success(
        nextPlan.sync_status === 'synced'
          ? 'تم حفظ تعديلات الخطة.'
          : 'تم حفظ تعديلات الخطة محليًا وستتم مزامنتها عند عودة الاتصال.'
      );
    } catch (saveError: unknown) {
      const message = normalizeApiError(saveError, 'فشل حفظ تعديلات الخطة.').message;
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleRefinementCommitted = async () => {
    if (!selectedPlan?.server_id) {
      return;
    }

    const [detailResponse] = await Promise.all([
      getPlanById(selectedPlan.server_id),
      loadPlans(),
    ]);
    setSelectedPlan(detailResponse.plan as OfflineLessonPlanRecord);
  };

  const handleDuplicatePlan = async () => {
    if (!selectedPlan) {
      return;
    }

    try {
      const response = await duplicatePlan(selectedPlan.public_id);
      const duplicatedPlan = response.plan as OfflineLessonPlanRecord;
      setPlans((current) => [duplicatedPlan, ...current]);
      setSelectedPlan(duplicatedPlan);
      toast.success('تم إنشاء نسخة محلية من الخطة.');
    } catch (error: unknown) {
      toast.error(normalizeApiError(error, 'تعذر إنشاء نسخة محلية للخطة.').message);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="pm ui-loaded">
      <header className="pm__header page-header">
        <div>
          <h1>إدارة الخطط المولدة</h1>
          <p>
            استعرض الخطط بسرعة، فلتر النتائج لحظيًا، وافتح الخطة بنفس التنسيق
            المعتمد في صفحة إنشاء الخطط.
          </p>
        </div>
      </header>

      {draftRecoveredNotice ? (
        <p className="ui-inline-notice ui-inline-notice--info">{draftRecoveredNotice}</p>
      ) : null}

      <section className="pm__filters" aria-label="مرشحات الخطط">
        <div className="pm__field">
          <label htmlFor="pm-plan-type">نوع الخطة</label>
          <select
            id="pm-plan-type"
            value={planType}
            onChange={(event) => setPlanType(event.target.value as PlanTypeFilter)}
            disabled={isEditingPlan}
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
            disabled={isEditingPlan}
          />
        </div>

        <div className="pm__field">
          <label htmlFor="pm-grade">المرحلة/الصف</label>
          <input
            id="pm-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="مثال: الصف الثامن"
            disabled={isEditingPlan}
          />
        </div>

        <div className="pm__filter-actions">
          <button
            type="button"
            className="pm__btn pm__btn--ghost"
            onClick={clearFilters}
            disabled={isEditingPlan || (!planType && !subject && !grade)}
          >
            مسح الكل
          </button>
          <button
            type="button"
            className="pm__btn pm__btn--subtle"
            onClick={() => void loadPlans()}
            disabled={loading || isEditingPlan}
            aria-busy={loading}
          >
            {loading && <span className="ui-button-spinner" aria-hidden />}
            {!loading && <MdRefresh aria-hidden />}
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
                const isActive = plan.local_id === selectedPlan?.local_id;
                return (
                  <button
                    key={plan.local_id}
                    type="button"
                    className={
                      isActive ? 'pm__card pm__card--active animate-fadeIn' : 'pm__card animate-fadeIn'
                    }
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
                      <SyncStatusBadge status={plan.sync_status} />
                    </div>
                    <div className="pm__card-meta">
                      <span>{plan.grade}</span>
                      {plan.last_sync_error ? <span>{plan.last_sync_error}</span> : <span />}
                    </div>
                    {isAdmin ? (
                      <div className="pm__card-meta">
                        <span>المعلم</span>
                        <span>
                          {teacherNameMap.get(plan.teacher_id) || `#${plan.teacher_id}`}
                        </span>
                      </div>
                    ) : null}
                    {detailLoading && isActive ? (
                      <span className="pm__card-meta">
                        <span className="ui-button-spinner" aria-hidden />
                        جارٍ تحميل التفاصيل...
                      </span>
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
                {isEditingPlan ? (
                  <>
                    <button
                      type="button"
                      className="pm__btn pm__btn--ghost"
                      onClick={handleCancelEditing}
                      disabled={isSavingPlan}
                    >
                      <MdClose aria-hidden />
                      إلغاء
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      onClick={() => void handleSavePlan()}
                      disabled={!selectedPlan || !planDraft || isSavingPlan}
                      aria-busy={isSavingPlan}
                    >
                      {isSavingPlan && <span className="ui-button-spinner" aria-hidden />}
                      {!isSavingPlan && <MdSave aria-hidden />}
                      {isSavingPlan ? 'جارٍ الحفظ...' : 'حفظ'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan?.server_id || isExporting}
                      onClick={() => handleExport('pdf')}
                      aria-busy={isExporting}
                    >
                      {isExporting && <span className="ui-button-spinner" aria-hidden />}
                      {!isExporting && <MdOutlinePictureAsPdf aria-hidden />}
                      PDF
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan?.server_id || isExporting}
                      onClick={() => handleExport('docx')}
                      aria-busy={isExporting}
                    >
                      {isExporting && <span className="ui-button-spinner" aria-hidden />}
                      {!isExporting && <MdOutlineTextSnippet aria-hidden />}
                      Word
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan?.server_id || isExporting}
                      onClick={() => handleShare('pdf')}
                      aria-busy={isExporting}
                      title="مشاركة PDF عبر الجهاز"
                    >
                      {isExporting && <span className="ui-button-spinner" aria-hidden />}
                      {!isExporting && 'مشاركة PDF'}
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan}
                      onClick={() => {
                        if (!selectedPlan) return;
                        const text = `خطة درس: ${selectedPlan.lesson_title ?? selectedPlan.public_id}\nالمعرف: ${selectedPlan.public_id}`;
                        window.open(buildWhatsAppLink(text), '_blank', 'noopener,noreferrer');
                      }}
                      title="مشاركة عبر واتساب"
                    >
                      <MdWhatsapp aria-hidden />
                      واتساب
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan || detailLoading}
                      onClick={handleStartEditing}
                    >
                      <MdEdit aria-hidden />
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="pm__btn pm__btn--subtle"
                      disabled={!selectedPlan || detailLoading}
                      onClick={() => void handleDuplicatePlan()}
                    >
                      <MdContentCopy aria-hidden />
                      نسخة محلية
                    </button>
                  </>
                )}
              </div>
            </header>

            {!selectedPlan ? (
              <p className="pm__state">اختر خطة من القائمة لعرض التفاصيل.</p>
            ) : (
              <div className="pm__detail-content">
                <div className="pm__chips">
                  <span className="pm__chip">المعرف: {selectedPlan.public_id}</span>
                  <span className="pm__chip">
                    <SyncStatusBadge status={selectedPlan.sync_status} />
                  </span>
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

                {selectedPlan.last_sync_error ? (
                  <p className="ui-inline-notice ui-inline-notice--warning">
                    {selectedPlan.last_sync_error}
                  </p>
                ) : null}

                {detailLoading ? (
                  <p className="pm__state pm__state--inline">جاري تحديث تفاصيل الخطة...</p>
                ) : null}

                <LessonPlanDocumentView
                  planType={selectedPlan.plan_type}
                  mode={isEditingPlan ? 'edit' : 'view'}
                  lessonTitle={planDraft?.lessonTitle ?? selectedPlan.lesson_title}
                  planJson={planDraft?.planJson ?? selectedPlan.plan_json}
                  onLessonTitleChange={(value) =>
                    setPlanDraft((current) =>
                      current
                        ? {
                            ...current,
                            lessonTitle: value,
                          }
                        : current
                    )
                  }
                  onPlanJsonChange={(nextPlanJson) =>
                    setPlanDraft((current) =>
                      current
                        ? {
                            ...current,
                            planJson: nextPlanJson,
                          }
                        : current
                    )
                  }
                  fallback={{
                    lessonTitle: selectedPlan.lesson_title,
                    subject: selectedPlan.subject,
                    grade: selectedPlan.grade,
                    unit: selectedPlan.unit,
                    durationMinutes: selectedPlan.duration_minutes,
                  }}
                />

                {!isEditingPlan && selectedPlan.server_id ? (
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
                ) : null}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
