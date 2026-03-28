import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { MdArrowBack, MdClose, MdDelete, MdEdit, MdSave } from 'react-icons/md';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import ExportFormatModal from '../../components/common/ExportFormatModal';
import { normalizeApiError } from '../../utils/apiErrors';
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts';
import { useOffline } from '../../offline/useOffline';
import { isLocalOnlyId } from '../../offline/utils';
import type { OfflineLessonPlanRecord } from '../../offline/types';
import LessonPlanDocumentView from '../lesson-plans/components/LessonPlanDocumentView';
import { asRecord, toDisplayText } from '../lesson-plans/planDisplay';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import {
  deletePlanById,
  exportPlan,
  getPlanById,
  updatePlan,
} from './plans-manager.services';
import './plan-viewer.css';

interface PlanDraft {
  lessonTitle: string;
  planJson: Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function toOptionalText(value: unknown): string | null {
  const text = toDisplayText(value);
  return text === '—' ? null : text;
}

export default function PlanViewerPage() {
  const navigate = useNavigate();
  const params = useParams();
  const planId = params.planId?.trim() ?? '';

  const { lastSyncAt } = useOffline();

  const [selectedPlan, setSelectedPlan] =
    useState<OfflineLessonPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [draftRecoveredNotice, setDraftRecoveredNotice] = useState<
    string | null
  >(null);
  const [exportFormatOpen, setExportFormatOpen] = useState(false);
  const [exportTargetPlan, setExportTargetPlan] =
    useState<OfflineLessonPlanRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetPlan, setDeleteTargetPlan] =
    useState<OfflineLessonPlanRecord | null>(null);
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  const detailRequestIdRef = useRef(0);

  const planHeader = asRecord(selectedPlan?.plan_json?.header) ?? {};
  const headerSection = toOptionalText(planHeader.section);

  const loadPlan = async (
    currentPlanId: string,
    mode: 'initial' | 'refresh'
  ) => {
    const requestId = ++detailRequestIdRef.current;

    if (mode === 'initial') {
      setLoading(true);
    } else {
      setDetailLoading(true);
    }

    setError(null);

    try {
      const response = await getPlanById(currentPlanId);

      if (requestId !== detailRequestIdRef.current) {
        return;
      }

      setSelectedPlan(response.plan as OfflineLessonPlanRecord);
    } catch (loadError: unknown) {
      if (requestId !== detailRequestIdRef.current) {
        return;
      }

      const message = normalizeApiError(
        loadError,
        'فشل تحميل تفاصيل الخطة.'
      ).message;
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === detailRequestIdRef.current) {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setDetailLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    if (!planId) {
      setLoading(false);
      setError('تعذر العثور على رقم الخطة.');
      setSelectedPlan(null);
      return;
    }

    setSelectedPlan(null);
    setIsEditingPlan(false);
    setIsSavingPlan(false);
    setPlanDraft(null);
    setDraftRecoveredNotice(null);
    void loadPlan(planId, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

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

    getDraft<PlanDraft>('plan-viewer', selectedPlan.local_id)
      .then((draft) => {
        if (!draft || cancelled) {
          return;
        }

        if (draft.updated_at > selectedPlan.updated_at) {
          setPlanDraft(draft.payload);
          setIsEditingPlan(true);
          setDraftRecoveredNotice(
            'تمت استعادة المسودة المحلية للخطة بعد إعادة فتح الصفحة.'
          );
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
        routeKey: 'plan-viewer',
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

  useEffect(() => {
    if (!lastSyncAt || isEditingPlan || !planId) {
      return;
    }

    void loadPlan(planId, 'refresh');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt]);

  const buildPlanDraft = (plan: OfflineLessonPlanRecord): PlanDraft => ({
    lessonTitle: plan.lesson_title,
    planJson: cloneValue(plan.plan_json ?? {}),
  });

  const selectedPlanCanExport = selectedPlan
    ? !isLocalOnlyId(selectedPlan.public_id)
    : false;

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
      void clearDraft('plan-viewer', selectedPlan.local_id);
    }
  };

  const handleSavePlan = async () => {
    if (!selectedPlan || !planDraft || isSavingPlan) {
      return;
    }

    const nextPlanJson = cloneValue(planDraft.planJson);
    const currentHeader =
      nextPlanJson.header &&
      typeof nextPlanJson.header === 'object' &&
      !Array.isArray(nextPlanJson.header)
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
      setIsEditingPlan(false);
      setPlanDraft(null);
      await clearDraft('plan-viewer', selectedPlan.local_id);
      toast.success(
        nextPlan.sync_status === 'synced'
          ? 'تم حفظ تعديلات الخطة.'
          : 'تم حفظ تعديلات الخطة محليًا وستتم مزامنتها عند عودة الاتصال.'
      );
    } catch (saveError: unknown) {
      const message = normalizeApiError(
        saveError,
        'فشل حفظ تعديلات الخطة.'
      ).message;
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleRefinementCommitted = async () => {
    if (!selectedPlan?.public_id) {
      return;
    }

    const response = await getPlanById(selectedPlan.public_id);
    setSelectedPlan(response.plan as OfflineLessonPlanRecord);
  };

  const openExportDialog = (plan: OfflineLessonPlanRecord) => {
    setExportTargetPlan(plan);
    setExportFormatOpen(true);
  };

  const openDeleteDialog = (plan: OfflineLessonPlanRecord) => {
    setDeleteTargetPlan(plan);
    setDeleteConfirmOpen(true);
  };

  const handleExportSelectedPlan = async (format: 'pdf' | 'docx') => {
    if (!exportTargetPlan?.public_id) {
      return;
    }

    try {
      setIsExportingPlan(true);
      await exportPlan(exportTargetPlan.public_id, format);
      toast.success('تم تصدير الخطة بنجاح.');
      setExportFormatOpen(false);
    } catch (exportError: unknown) {
      toast.error(normalizeApiError(exportError, 'فشل تصدير الخطة.').message);
    } finally {
      setIsExportingPlan(false);
      setExportTargetPlan(null);
    }
  };

  const handleDeleteSelectedPlan = async () => {
    if (!deleteTargetPlan?.public_id) {
      return;
    }

    try {
      setIsDeletingPlan(true);
      if (selectedPlan?.public_id === deleteTargetPlan.public_id) {
        setIsEditingPlan(false);
        setPlanDraft(null);
        void clearDraft('plan-viewer', deleteTargetPlan.local_id);
      }
      await deletePlanById(deleteTargetPlan.public_id);
      toast.success('تم حذف الخطة بنجاح.');
      navigate('/plans', { replace: true });
    } catch (deleteError: unknown) {
      toast.error(normalizeApiError(deleteError, 'فشل حذف الخطة.').message);
    } finally {
      setIsDeletingPlan(false);
      setDeleteConfirmOpen(false);
      setDeleteTargetPlan(null);
    }
  };

  if (loading && !selectedPlan) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  const title = selectedPlan?.lesson_title || 'عرض الخطة';
  return (
    <div className="pv ui-loaded">
      <header className="pv__header page-header">
        <div className="pv__header-copy">
          <nav className="pv__breadcrumb" aria-label="breadcrumb">
            <Link to="/plans">مكتبة الخطط</Link>
            <span>←</span>
            <span className="pv__breadcrumb-current">عرض الخطة</span>
          </nav>
          <h1>{title}</h1>
          <p>عرض الخطة في صفحة مستقلة بنفس قالب العرض الحالي.</p>
        </div>

        <div className="pv__header-actions">
          <button
            type="button"
            className="pv__back-btn"
            onClick={() => navigate('/plans')}
          >
            <MdArrowBack aria-hidden />
            العودة إلى المكتبة
          </button>
        </div>
      </header>

      {draftRecoveredNotice ? (
        <p className="ui-inline-notice ui-inline-notice--info">
          {draftRecoveredNotice}
        </p>
      ) : null}

      {error ? (
        <p className="ui-inline-notice ui-inline-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {selectedPlan ? (
        <>
          {selectedPlan.last_sync_error ? (
            <p className="ui-inline-notice ui-inline-notice--warning">
              {selectedPlan.last_sync_error}
            </p>
          ) : null}

          {detailLoading ? (
            <p className="pv__state">جاري تحديث تفاصيل الخطة...</p>
          ) : null}

          <section className="pv__toolbar">
            {isEditingPlan ? (
              <>
                <button
                  type="button"
                  className="pv__btn pv__btn--ghost"
                  onClick={handleCancelEditing}
                  disabled={isSavingPlan}
                >
                  <MdClose aria-hidden />
                  إلغاء
                </button>
                <button
                  type="button"
                  className="pv__btn pv__btn--subtle"
                  onClick={() => void handleSavePlan()}
                  disabled={!selectedPlan || !planDraft || isSavingPlan}
                  aria-busy={isSavingPlan}
                >
                  {isSavingPlan && (
                    <span className="ui-button-spinner" aria-hidden />
                  )}
                  {!isSavingPlan && <MdSave aria-hidden />}
                  {isSavingPlan ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="pv__btn pv__btn--subtle"
                  disabled={!selectedPlanCanExport}
                  onClick={() => {
                    if (selectedPlan) {
                      openExportDialog(selectedPlan);
                    }
                  }}
                >
                  تصدير
                </button>
                <button
                  type="button"
                  className="pv__btn pv__btn--subtle"
                  disabled={!selectedPlan || detailLoading}
                  onClick={handleStartEditing}
                >
                  <MdEdit aria-hidden />
                  تعديل
                </button>
                <button
                  type="button"
                  className="pv__btn pv__btn--subtle pv__btn--danger"
                  disabled={!selectedPlan || detailLoading}
                  onClick={() => {
                    if (selectedPlan) {
                      openDeleteDialog(selectedPlan);
                    }
                  }}
                >
                  <MdDelete aria-hidden />
                  حذف
                </button>
              </>
            )}
          </section>

          <section className="pv__document-shell">
            <LessonPlanDocumentView
              planType={selectedPlan.plan_type}
              mode={isEditingPlan ? 'edit' : 'view'}
              lessonTitle={planDraft?.lessonTitle ?? selectedPlan.lesson_title}
              planJson={planDraft?.planJson ?? selectedPlan.plan_json}
              className="pv__document"
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
                section: headerSection ?? undefined,
              }}
            />
          </section>

          {!isEditingPlan && selectedPlan.server_id ? (
            <section className="pv__refinement">
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
            </section>
          ) : null}
        </>
      ) : (
        <p className="ui-inline-notice ui-inline-notice--warning" role="alert">
          تعذر تحميل الخطة المطلوبة. جرّب العودة إلى مكتبة الخطط ثم فتحها مرة
          أخرى.
        </p>
      )}

      <ExportFormatModal
        isOpen={exportFormatOpen}
        title="تصدير الخطة"
        onClose={() => {
          setExportFormatOpen(false);
          setExportTargetPlan(null);
        }}
        isSubmitting={isExportingPlan}
        onConfirm={({ format }) => void handleExportSelectedPlan(format)}
      />

      <ConfirmActionModal
        isOpen={deleteConfirmOpen}
        title="تأكيد حذف الخطة"
        message="سيتم حذف الخطة نهائيًا من المكتبة. لا يمكن التراجع بعد الحذف."
        endpoint={
          deleteTargetPlan?.public_id
            ? `/api/plans/${deleteTargetPlan.public_id}`
            : '/api/plans'
        }
        payload={
          deleteTargetPlan?.public_id
            ? { planId: deleteTargetPlan.public_id }
            : undefined
        }
        isLoading={isDeletingPlan}
        confirmLabel="حذف الخطة"
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetPlan(null);
        }}
        onConfirm={async () => {
          await handleDeleteSelectedPlan();
        }}
      />
    </div>
  );
}
