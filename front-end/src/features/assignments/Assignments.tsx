import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  MdAssignment,
  MdAutoAwesome,
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
import WhatsAppExportModal from '../../components/common/WhatsAppExportModal';
import { useAuth } from '../../context/AuthContext';
import type { Assignment, Class, LessonPlanRecord } from '../../types';
import { ASSIGNMENT_TYPE_LABELS } from '../../types';
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts';
import { useOffline } from '../../offline/useOffline';
import { isLocalOnlyId } from '../../offline/utils';
import type { OfflineAssignmentRecord } from '../../offline/types';
import {
  duplicateAssignment,
  exportAssignment,
  shareAssignment,
  generateAssignments,
  getMyClasses,
  getAssignmentById,
  listAssignments,
  updateAssignment,
} from './assignments.services';
import { listPlans } from '../plans-manager/plans-manager.services';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
import { buildWhatsAppLink, buildHomeworkMessage } from '../../utils/whatsapp';
import AssignmentCard from './components/AssignmentCard';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import './assignments.css';

interface AssignmentsLocationState {
  lesson_plan_public_id?: string;
  lesson_id?: string | number;
}

interface AssignmentContext {
  lessonPlanPublicId: string;
  lessonId: number;
}

interface AssignmentContextResolution {
  context: AssignmentContext | null;
  rawLessonPlanPublicId: string | null;
  rawLessonId: string | null;
}

interface SummaryCard {
  label: string;
  value: string;
  hint: string;
}

interface AssignmentDraft {
  name: string;
  description: string;
  type: Assignment['type'];
  content: string;
  due_date?: string | null;
  whatsapp_message_text?: string | null;
}

type SelectValue = number | '';

const LESSON_PLAN_ID_PATTERN = /^(trd|act)_\d+$/;

function pickByPriority(values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function formatDateTimeAr(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRefreshTime(value: Date | null): string {
  if (!value) {
    return 'لم يتم التحديث بعد';
  }

  return value.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countUniqueLessons(assignments: Assignment[]): number {
  return new Set(assignments.map((assignment) => assignment.lesson_id)).size;
}

function formatCountByType(assignments: Assignment[], type: Assignment['type']): string {
  const count = assignments.filter((assignment) => assignment.type === type).length;
  return `${count}`;
}

function resolveContext(
  routeParams: Record<string, string | undefined>,
  locationState: AssignmentsLocationState | null,
  searchParams: URLSearchParams
): AssignmentContextResolution {
  const lessonIdFromState =
    typeof locationState?.lesson_id === 'number'
      ? String(locationState.lesson_id)
      : locationState?.lesson_id;

  const rawLessonPlanPublicId = pickByPriority([
    routeParams.lesson_plan_public_id,
    locationState?.lesson_plan_public_id,
    searchParams.get('lesson_plan_public_id'),
  ]);

  const rawLessonId = pickByPriority([
    routeParams.lesson_id,
    lessonIdFromState,
    searchParams.get('lesson_id'),
  ]);

  const lessonId = parsePositiveInteger(rawLessonId);
  if (!rawLessonPlanPublicId || !lessonId) {
    return {
      context: null,
      rawLessonPlanPublicId,
      rawLessonId,
    };
  }

  if (!LESSON_PLAN_ID_PATTERN.test(rawLessonPlanPublicId)) {
    return {
      context: null,
      rawLessonPlanPublicId,
      rawLessonId,
    };
  }

  return {
    context: {
      lessonPlanPublicId: rawLessonPlanPublicId,
      lessonId,
    },
    rawLessonPlanPublicId,
    rawLessonId,
  };
}

export default function Assignments() {
  const { user } = useAuth();
  const { lastSyncAt } = useOffline();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const locationState =
    (location.state as AssignmentsLocationState | null) ?? null;
  const lessonIdState = locationState?.lesson_id;
  const lessonPlanIdState = locationState?.lesson_plan_public_id;

  const { context } = useMemo(
    () =>
      resolveContext(
        {
          lesson_plan_public_id: params.lesson_plan_public_id,
          lesson_id: params.lesson_id,
        },
        {
          lesson_plan_public_id: lessonPlanIdState,
          lesson_id: lessonIdState,
        },
        new URLSearchParams(location.search)
      ),
    [
      params.lesson_plan_public_id,
      params.lesson_id,
      lessonPlanIdState,
      lessonIdState,
      location.search,
    ]
  );
  const isScopedView = context !== null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [assignments, setAssignments] = useState<OfflineAssignmentRecord[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<OfflineAssignmentRecord | null>(
    null
  );
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(
    null
  );

  const [isListLoading, setIsListLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFromPlan, setIsGeneratingFromPlan] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [plansForGenerate, setPlansForGenerate] = useState<LessonPlanRecord[]>([]);
  const [selectedPlanIdForGenerate, setSelectedPlanIdForGenerate] = useState('');
  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(
    null
  );
  const [draftRecoveredNotice, setDraftRecoveredNotice] = useState<string | null>(
    null
  );
  const [whatsAppExportOpen, setWhatsAppExportOpen] = useState(false);

  const selectedClassName = useMemo(() => {
    if (selectedClassId === '') {
      return 'كل الصفوف';
    }

    const classItem = classes.find((item) => item.id === selectedClassId);
    return classItem?.name ?? `صف #${selectedClassId}`;
  }, [classes, selectedClassId]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (isScopedView && context) {
      return [
        {
          label: 'معرّف الخطة',
          value: context.lessonPlanPublicId,
          hint: 'يتم عرض واجبات هذه الخطة فقط.',
        },
        {
          label: 'معرّف الدرس',
          value: String(context.lessonId),
          hint: 'الفلترة الحالية مرتبطة بهذا الدرس.',
        },
        {
          label: 'عدد الواجبات',
          value: String(assignments.length),
          hint: 'عدد الواجبات المعروضة في هذه الصفحة الآن.',
        },
        {
          label: 'آخر تحديث',
          value: formatRefreshTime(lastRefreshedAt),
          hint: 'وقت آخر مزامنة ناجحة مع الخادم.',
        },
      ];
    }

    const latestUpdatedAt = assignments[0]?.updated_at
      ? formatDateTimeAr(assignments[0].updated_at)
      : 'لا توجد بيانات بعد';

    return [
      {
        label: 'كل الواجبات',
        value: String(assignments.length),
        hint: 'كل الواجبات المحفوظة لحسابك.',
      },
      {
        label: 'الصف الحالي',
        value: selectedClassName,
        hint: 'يمكنك التبديل بين الصفوف أو عرض كل الصفوف من فلتر الصفحة.',
      },
      {
        label: 'عدد الدروس',
        value: String(countUniqueLessons(assignments)),
        hint: 'عدد الدروس المختلفة التي تحتوي على واجبات.',
      },
      {
        label: 'آخر تعديل',
        value: latestUpdatedAt,
        hint: 'أحدث واجب تم تعديله ضمن القائمة الحالية.',
      },
      {
        label: 'توزيع الأنواع',
        value: [
          `كتابي ${formatCountByType(assignments, 'written')}`,
          `متنوع ${formatCountByType(assignments, 'varied')}`,
          `تطبيقي ${formatCountByType(assignments, 'practical')}`,
        ].join(' • '),
        hint: 'ملخص سريع لأنواع الواجبات الظاهرة.',
      },
    ];
  }, [assignments, context, isScopedView, lastRefreshedAt, selectedClassName]);

  useEffect(() => {
    if (!user) {
      navigate('/authentication');
      return;
    }

    if (user.userRole === 'admin') {
      navigate('/admin');
    }
  }, [navigate, user]);

  const loadAssignments = useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsListLoading(true);
      }

      try {
        const response = context
          ? await listAssignments({
              lessonPlanPublicId: context.lessonPlanPublicId,
              lessonId: context.lessonId,
            })
          : await listAssignments({
              classId: selectedClassId === '' ? undefined : selectedClassId,
            });
        const nextAssignments = (response.assignments ?? []) as OfflineAssignmentRecord[];
        setAssignments(nextAssignments);
        setLastRefreshedAt(new Date());
        setError(null);
        setExportError(null);
        setSuccessMessage(null);
        setActiveAssignmentId((current) =>
          current && nextAssignments.some((assignment) => assignment.public_id === current)
            ? current
            : nextAssignments[0]?.public_id ?? null
        );

        setSelectedAssignment((current) => {
          if (current) {
            return (
              nextAssignments.find(
                (assignment) => assignment.public_id === current.public_id
              ) ?? nextAssignments[0] ?? null
            );
          }

          return nextAssignments[0] ?? null;
        });
      } catch (listError: unknown) {
        setError(
          normalizeApiError(
            listError,
            isScopedView
              ? 'تعذر تحميل قائمة الواجبات لهذا الدرس.'
              : 'تعذر تحميل الواجبات المحفوظة لحسابك.'
          )
        );
      } finally {
        setIsListLoading(false);
        setIsRefreshing(false);
      }
    },
    [context, isScopedView, selectedClassId]
  );

  useEffect(() => {
    if (!lastSyncAt || isEditingAssignment) {
      return;
    }

    void loadAssignments(true);
  }, [isEditingAssignment, lastSyncAt, loadAssignments]);

  useEffect(() => {
    if (user?.userRole !== 'teacher') {
      setClasses([]);
      setAssignments([]);
      setSelectedAssignment(null);
      return;
    }

    void loadAssignments();
  }, [context, selectedClassId, user?.userRole, loadAssignments]);

  useEffect(() => {
    if (user?.userRole !== 'teacher') {
      setPlansForGenerate([]);
      return;
    }

    let cancelled = false;
    setIsPlansLoading(true);
    listPlans({})
      .then((response) => {
        if (!cancelled) {
          setPlansForGenerate(response.plans ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlansForGenerate([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPlansLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.userRole]);

  useEffect(() => {
    if (user?.userRole !== 'teacher' || isScopedView) {
      setClasses([]);
      return;
    }

    let cancelled = false;

    const loadClasses = async () => {
      setIsClassesLoading(true);
      try {
        const response = await getMyClasses();
        if (cancelled) {
          return;
        }
        setClasses(response.classes ?? []);
      } catch (classesError: unknown) {
        if (!cancelled) {
          setError(normalizeApiError(classesError, 'تعذر تحميل قائمة الصفوف.'));
        }
      } finally {
        if (!cancelled) {
          setIsClassesLoading(false);
        }
      }
    };

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [isScopedView, user?.userRole]);

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);

  useEffect(() => {
    if (exportError) {
      toast.error(exportError);
    }
  }, [exportError]);

  useEffect(() => {
    setIsEditingAssignment(false);
    setIsSavingAssignment(false);
    setAssignmentDraft(null);
    setDraftRecoveredNotice(null);
  }, [selectedAssignment?.local_id]);

  useEffect(() => {
    if (!selectedAssignment) {
      return;
    }

    let cancelled = false;

    getDraft<AssignmentDraft>('assignments', selectedAssignment.local_id)
      .then((draft) => {
        if (!draft || cancelled) {
          return;
        }

        if (draft.updated_at > selectedAssignment.updated_at) {
          setAssignmentDraft(draft.payload);
          setIsEditingAssignment(true);
          setDraftRecoveredNotice('تمت استعادة مسودة الواجب المحلية.');
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAssignment]);

  useEffect(() => {
    if (!isEditingAssignment || !assignmentDraft || !selectedAssignment) {
      return;
    }

    const persistDraft = () =>
      saveDraft({
        entityType: 'assignment',
        recordLocalId: selectedAssignment.local_id,
        routeKey: 'assignments',
        payload: assignmentDraft,
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
  }, [assignmentDraft, isEditingAssignment, selectedAssignment]);

  const buildAssignmentDraft = (assignment: Assignment): AssignmentDraft => ({
    name: assignment.name,
    description: assignment.description ?? '',
    type: assignment.type,
    content: assignment.content,
    due_date: assignment.due_date ?? null,
    whatsapp_message_text: assignment.whatsapp_message_text ?? null,
  });

  const syncAssignmentInList = (updatedAssignment: OfflineAssignmentRecord) => {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.local_id === updatedAssignment.local_id
          ? updatedAssignment
          : assignment
      )
    );
  };

  const handleGenerateAssignments = async () => {
    if (!context) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await generateAssignments(
        context.lessonPlanPublicId,
        context.lessonId
      );
      if ('queued' in response && response.queued) {
        setSuccessMessage(response.message);
        return;
      }
      await loadAssignments(true);
      const generatedAssignments = (response as { assignments: Assignment[] }).assignments ?? [];
      if (generatedAssignments.length > 0) {
        setActiveAssignmentId(generatedAssignments[0].public_id);
      }

      const generatedCount = generatedAssignments.length;
      setSuccessMessage(
        generatedCount > 0
          ? `تم توليد ${generatedCount} واجب/واجبات وحفظها في قاعدة البيانات.`
          : 'تم توليد الواجبات وحفظها بنجاح.'
      );
    } catch (generateError: unknown) {
      setError(normalizeApiError(generateError, 'فشل توليد الواجبات.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromPlan = async () => {
    if (!selectedPlanIdForGenerate) return;
    const plan = plansForGenerate.find((p) => p.public_id === selectedPlanIdForGenerate);
    if (!plan || plan.lesson_id == null) return;

    setIsGeneratingFromPlan(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await generateAssignments(plan.public_id, plan.lesson_id);
      if ('queued' in response && response.queued) {
        setSuccessMessage(response.message);
        setSelectedPlanIdForGenerate('');
        return;
      }
      await loadAssignments(true);
      const generatedAssignments = (response as { assignments: Assignment[] }).assignments ?? [];
      if (generatedAssignments.length > 0) {
        setActiveAssignmentId(generatedAssignments[0].public_id);
      }
      const generatedCount = generatedAssignments.length;
      setSuccessMessage(
        generatedCount > 0
          ? `تم توليد ${generatedCount} واجب/واجبات وحفظها في قاعدة البيانات.`
          : 'تم توليد الواجبات وحفظها بنجاح.'
      );
      setSelectedPlanIdForGenerate('');
    } catch (generateError: unknown) {
      setError(normalizeApiError(generateError, 'فشل توليد الواجبات.'));
    } finally {
      setIsGeneratingFromPlan(false);
    }
  };

  const handleViewAssignment = async (assignment: Assignment | OfflineAssignmentRecord) => {
    if (isEditingAssignment) {
      toast.error('احفظ تعديلات الواجب الحالية أو ألغها قبل فتح واجب آخر.');
      return;
    }

    setActiveAssignmentId(assignment.public_id);
    setSelectedAssignment(assignment as OfflineAssignmentRecord);
    setIsDetailLoading(true);
    setError(null);

    try {
      const response = await getAssignmentById(assignment.public_id);
      setSelectedAssignment(response.assignment as OfflineAssignmentRecord);
    } catch (viewError: unknown) {
      setError(normalizeApiError(viewError, 'تعذر تحميل تفاصيل الواجب.'));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const canExportAssignment =
    selectedAssignment?.public_id && !isLocalOnlyId(selectedAssignment.public_id);

  const handleRefinementCommitted = async () => {
    if (!canExportAssignment) {
      return;
    }

    await loadAssignments(true);
    if (selectedAssignment?.public_id) {
      const response = await getAssignmentById(selectedAssignment.public_id);
      setSelectedAssignment(response.assignment as OfflineAssignmentRecord);
      setActiveAssignmentId(response.assignment.public_id);
    }
    setSuccessMessage('تم حفظ التعديل المعتمد بنجاح.');
  };

  const handleExportPdf = () => {
    if (!canExportAssignment || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportAssignment(selectedAssignment!.public_id, 'pdf')
      .catch(() => setExportError('فشل تصدير PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleExportWord = () => {
    if (!canExportAssignment || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportAssignment(selectedAssignment!.public_id, 'docx')
      .catch(() => setExportError('فشل تصدير Word.'))
      .finally(() => setIsExporting(false));
  };

  const handleSharePdf = () => {
    if (!canExportAssignment || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    shareAssignment(selectedAssignment!.public_id, 'pdf', selectedAssignment!.name)
      .catch(() => setExportError('فشل مشاركة PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleStartEditing = () => {
    if (!selectedAssignment || isDetailLoading) {
      return;
    }

    setAssignmentDraft(buildAssignmentDraft(selectedAssignment));
    setIsEditingAssignment(true);
  };

  const handleCancelEditing = () => {
    setIsEditingAssignment(false);
    setAssignmentDraft(null);
    if (selectedAssignment) {
      void clearDraft('assignments', selectedAssignment.local_id);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedAssignment?.public_id || !assignmentDraft || isSavingAssignment) {
      return;
    }

    setIsSavingAssignment(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await updateAssignment(selectedAssignment.public_id, assignmentDraft);
      const nextAssignment = response.assignment as OfflineAssignmentRecord;
      setSelectedAssignment(nextAssignment);
      setActiveAssignmentId(response.assignment.public_id);
      syncAssignmentInList(nextAssignment);
      setIsEditingAssignment(false);
      setAssignmentDraft(null);
      await clearDraft('assignments', selectedAssignment.local_id);
      setSuccessMessage(
        nextAssignment.sync_status === 'synced'
          ? 'تم حفظ تعديلات الواجب بنجاح.'
          : 'تم حفظ تعديلات الواجب محليًا وستتم مزامنتها عند عودة الاتصال.'
      );
    } catch (saveError: unknown) {
      setError(normalizeApiError(saveError, 'فشل حفظ تعديلات الواجب.'));
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleDuplicateAssignment = async () => {
    if (!selectedAssignment) {
      return;
    }

    try {
      const response = await duplicateAssignment(selectedAssignment.public_id);
      const nextAssignment = response.assignment as OfflineAssignmentRecord;
      setAssignments((current) => [nextAssignment, ...current]);
      setSelectedAssignment(nextAssignment);
      setActiveAssignmentId(nextAssignment.public_id);
      setSuccessMessage('تم إنشاء نسخة محلية من الواجب.');
    } catch (error: unknown) {
      setError(normalizeApiError(error, 'تعذر إنشاء نسخة محلية من الواجب.'));
    }
  };

  if (user?.userRole !== 'teacher') {
    return null;
  }

  if (isListLoading && assignments.length === 0 && !selectedAssignment) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="asn ui-loaded">
      <header className="asn__header page-header">
        <div>
          <nav className="asn__breadcrumb" aria-label="breadcrumb">
            <Link to="/teacher">الرئيسية</Link>
            <span>←</span>
            <span className="asn__breadcrumb-current">الواجبات</span>
          </nav>
          <h1>إدارة الواجبات المنزلية</h1>
          <p>
            {isScopedView
              ? 'توليد واجبات مرتبطة بخطة الدرس الحالية، مراجعتها، ثم تعديلها بالذكاء الاصطناعي قبل الحفظ النهائي.'
              : 'استعراض الواجبات المحفوظة لحسابك مع فلترة حسب الصف، ثم فتح التفاصيل الكاملة وتعديل أي واجب أو تصديره عند الحاجة.'}
          </p>
        </div>

        <button
          type="button"
          className="asn-btn asn-btn--primary"
          onClick={() => void handleGenerateAssignments()}
          disabled={!context || isGenerating || isListLoading || isEditingAssignment}
        >
          {isGenerating && <span className="ui-button-spinner" aria-hidden />}
          {!isGenerating && <MdAutoAwesome aria-hidden />}
          {isGenerating ? 'جارٍ التوليد...' : 'اقتراح واجبات جديدة'}
        </button>
      </header>

      {draftRecoveredNotice ? (
        <p className="ui-inline-notice ui-inline-notice--info">{draftRecoveredNotice}</p>
      ) : null}

      <section className="asn__context">
        {summaryCards.map((card) => (
          <article key={card.label} className="animate-fadeIn">
            <span>{card.label}</span>
            {card.label.includes('الخطة') ? <code>{card.value}</code> : <p>{card.value}</p>}
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      {!context && (
        <>
          <section className="asn__filters" aria-label="فلترة الواجبات">
            <label className="asn__field" htmlFor="asn-class-filter">
              <span>اختر الصف</span>
              <select
                id="asn-class-filter"
                value={selectedClassId}
                onChange={(event) =>
                  setSelectedClassId(event.target.value ? Number(event.target.value) : '')
                }
                disabled={
                  isClassesLoading || isListLoading || isRefreshing || isEditingAssignment
                }
              >
                <option value="">كل الصفوف</option>
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="asn__filters-note">
              {isClassesLoading
                ? 'جارٍ تحميل الصفوف...'
                : 'يمكنك حصر الواجبات المحفوظة ضمن صف محدد أو عرض كل الصفوف.'}
            </p>
          </section>

          <section className="asn__generate-from-plan" aria-label="توليد واجب من خطة">
            <h3>توليد واجب من خطة</h3>
            <div className="asn__generate-from-plan-row">
              <label className="asn__field" htmlFor="asn-plan-select">
                <span>اختر خطة</span>
                <select
                  id="asn-plan-select"
                  value={selectedPlanIdForGenerate}
                  onChange={(event) => setSelectedPlanIdForGenerate(event.target.value)}
                  disabled={isPlansLoading || isGeneratingFromPlan || isEditingAssignment}
                >
                  <option value="">اختر خطة...</option>
                  {plansForGenerate
                    .filter((p) => p.lesson_id != null)
                    .map((plan) => (
                      <option key={plan.public_id} value={plan.public_id}>
                        {plan.lesson_title} — {plan.subject} / {plan.grade}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="asn-btn asn-btn--primary"
                onClick={() => void handleGenerateFromPlan()}
                disabled={
                  !selectedPlanIdForGenerate ||
                  isGeneratingFromPlan ||
                  isPlansLoading ||
                  isEditingAssignment
                }
              >
                {isGeneratingFromPlan && <span className="ui-button-spinner" aria-hidden />}
                {!isGeneratingFromPlan && <MdAutoAwesome aria-hidden />}
                {isGeneratingFromPlan ? 'جارٍ التوليد...' : 'توليد واجب من هذه الخطة'}
              </button>
            </div>
          </section>
        </>
      )}

      <div className="asn__layout">
        <section className="asn__list" aria-live="polite">
          <div className="asn__list-head">
            <div>
              <h2>
                {context
                  ? `الواجبات المقترحة (${assignments.length})`
                  : `كل الواجبات المحفوظة (${assignments.length})`}
              </h2>
              <p>
                {context
                  ? 'يمكنك عرض التفاصيل أو تعديل أي واجب ثم حفظه مباشرة.'
                  : 'يمكنك استعراض كل الواجبات المحفوظة لحسابك، ثم فتح أي واجب لتفاصيله الكاملة.'}
              </p>
            </div>
            <button
              type="button"
              className="asn-btn asn-btn--secondary"
              onClick={() => void loadAssignments(true)}
              disabled={isListLoading || isRefreshing || isEditingAssignment}
            >
              {isRefreshing && <span className="ui-button-spinner" aria-hidden />}
              {!isRefreshing && <MdRefresh aria-hidden />}
              {isRefreshing ? 'جارٍ التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          {isListLoading ? (
            <div className="asn-loading">
              <div className="asn-spinner" aria-hidden />
              <h3>جارٍ تحميل الواجبات...</h3>
              <p>
                {isScopedView
                  ? 'يتم الآن قراءة الواجبات المحفوظة لهذا الدرس.'
                  : selectedClassId === ''
                    ? 'يتم الآن قراءة جميع الواجبات المحفوظة لحسابك.'
                    : `يتم الآن قراءة واجبات ${selectedClassName}.`}
              </p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="asn-empty">
              <MdAssignment aria-hidden className="asn-empty__icon" />
              <h3>{context ? 'لا توجد واجبات مقترحة بعد' : 'لا توجد واجبات محفوظة بعد'}</h3>
              <p>
                {context
                  ? 'اضغط على "اقتراح واجبات جديدة" لتوليد واجبات مرتبطة بالخطة الحالية.'
                  : selectedClassId === ''
                    ? 'لا توجد واجبات محفوظة لهذا الحساب حتى الآن. افتح درساً محدداً لتوليد واجبات جديدة.'
                    : `لا توجد واجبات محفوظة ضمن ${selectedClassName} حالياً.`}
              </p>
              {context && (
                <button
                  type="button"
                  className="asn-btn asn-btn--primary"
                  onClick={() => void handleGenerateAssignments()}
                  disabled={isGenerating || isEditingAssignment}
                >
                  {isGenerating && <span className="ui-button-spinner" aria-hidden />}
                  {!isGenerating && <MdAutoAwesome aria-hidden />}
                  {isGenerating ? 'جارٍ التوليد...' : 'توليد الواجبات الآن'}
                </button>
              )}
            </div>
          ) : (
            <div className="asn__cards">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.public_id}
                  assignment={assignment}
                  isActive={activeAssignmentId === assignment.public_id}
                  isDetailLoading={isDetailLoading}
                  onView={handleViewAssignment}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="asn__details">
          <div className="asn__details-head">
            <h2>تفاصيل الواجب</h2>
            {selectedAssignment ? (
              isEditingAssignment ? (
                <div className="asn__details-actions">
                  <button
                    type="button"
                    className="asn-btn asn-btn--secondary"
                    onClick={handleCancelEditing}
                    disabled={isSavingAssignment}
                  >
                    <MdClose aria-hidden />
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--primary"
                    onClick={() => void handleSaveAssignment()}
                    disabled={isSavingAssignment || !assignmentDraft}
                  >
                    {isSavingAssignment && (
                      <span className="ui-button-spinner" aria-hidden />
                    )}
                    {!isSavingAssignment && <MdSave aria-hidden />}
                    {isSavingAssignment ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </div>
              ) : (
                <div className="asn__details-actions">
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleExportPdf}
                    disabled={isExporting || !canExportAssignment}
                    aria-busy={isExporting}
                  >
                    {isExporting && <span className="ui-button-spinner" aria-hidden />}
                    {!isExporting && <MdOutlinePictureAsPdf aria-hidden />}
                    تصدير PDF
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleExportWord}
                    disabled={isExporting || !canExportAssignment}
                    aria-busy={isExporting}
                  >
                    {isExporting && <span className="ui-button-spinner" aria-hidden />}
                    {!isExporting && <MdOutlineTextSnippet aria-hidden />}
                    تصدير Word
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleSharePdf}
                    disabled={isExporting || !canExportAssignment}
                    aria-busy={isExporting}
                    title="مشاركة PDF عبر الجهاز"
                  >
                    {isExporting && <span className="ui-button-spinner" aria-hidden />}
                    {!isExporting && 'مشاركة PDF'}
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={() => setWhatsAppExportOpen(true)}
                    disabled={!canExportAssignment}
                    title={
                      !canExportAssignment && selectedAssignment
                        ? 'مزامن الواجب مع الخادم أولاً لتمكين التصدير'
                        : 'إرسال الواجب لولي الأمر عبر واتساب'
                    }
                  >
                    <MdWhatsapp aria-hidden />
                    إرسال بالواتساب
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleStartEditing}
                    disabled={isDetailLoading}
                  >
                    <MdEdit aria-hidden />
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={() => void handleDuplicateAssignment()}
                    disabled={isDetailLoading}
                  >
                    <MdContentCopy aria-hidden />
                    نسخة محلية
                  </button>
                </div>
              )
            ) : null}
          </div>

          {!selectedAssignment ? (
            <div className="asn__details-empty">
              <p>
                {isListLoading
                  ? 'يتم تجهيز أول واجب لعرض تفاصيله.'
                  : 'لا يوجد واجب محدد حالياً. اختر واجباً من القائمة أو حدّث الصفحة.'}
              </p>
            </div>
          ) : (
            <article className="asn__details-card">
              <div className="asn__details-title-row">
                {isEditingAssignment && assignmentDraft ? (
                  <>
                    <input
                      className="asn__edit-input"
                      value={assignmentDraft.name}
                      onChange={(event) =>
                        setAssignmentDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value,
                              }
                            : current
                        )
                      }
                    />
                    <select
                      className="asn__edit-select"
                      value={assignmentDraft.type}
                      onChange={(event) =>
                        setAssignmentDraft((current) =>
                          current
                            ? {
                                ...current,
                                type: event.target.value as Assignment['type'],
                              }
                            : current
                        )
                      }
                    >
                      {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <div className="asn__details-title-text">
                      <h3>{selectedAssignment.name}</h3>
                      <SyncStatusBadge status={selectedAssignment.sync_status} />
                    </div>
                    <span
                      className={`asn-card__type asn-card__type--${selectedAssignment.type}`}
                    >
                      {ASSIGNMENT_TYPE_LABELS[selectedAssignment.type]}
                    </span>
                  </>
                )}
              </div>

              {selectedAssignment.last_sync_error ? (
                <p className="ui-inline-notice ui-inline-notice--warning">
                  {selectedAssignment.last_sync_error}
                </p>
              ) : null}

              <dl className="asn__meta-list">
                <div>
                  <dt>معرّف الواجب</dt>
                  <dd>{selectedAssignment.public_id}</dd>
                </div>
                <div>
                  <dt>موعد التسليم</dt>
                  <dd>
                    {isEditingAssignment && assignmentDraft ? (
                      <input
                        type="date"
                        className="asn__edit-input"
                        value={assignmentDraft.due_date ?? ''}
                        onChange={(event) =>
                          setAssignmentDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  due_date: event.target.value || null,
                                }
                              : current
                          )}
                      />
                    ) : selectedAssignment.due_date ? (
                      selectedAssignment.due_date
                    ) : (
                      'غير محدد'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>آخر تعديل</dt>
                  <dd>{formatDateTimeAr(selectedAssignment.updated_at)}</dd>
                </div>
                <div>
                  <dt>معرّف الخطة</dt>
                  <dd>{selectedAssignment.lesson_plan_public_id}</dd>
                </div>
                <div>
                  <dt>معرّف الدرس</dt>
                  <dd>{selectedAssignment.lesson_id}</dd>
                </div>
                <div>
                  <dt>الصف</dt>
                  <dd>
                    {selectedAssignment.class_name ??
                      (selectedAssignment.class_id != null
                        ? `صف #${selectedAssignment.class_id}`
                        : 'غير مرتبط بصف')}
                  </dd>
                </div>
              </dl>

              <section>
                <h4>الوصف</h4>
                {isEditingAssignment && assignmentDraft ? (
                  <textarea
                    className="asn__edit-textarea"
                    rows={4}
                    value={assignmentDraft.description}
                    onChange={(event) =>
                      setAssignmentDraft((current) =>
                        current
                          ? {
                              ...current,
                              description: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                ) : (
                  <p>
                    {selectedAssignment.description?.trim() ||
                      'لا يوجد وصف إضافي لهذا الواجب.'}
                  </p>
                )}
              </section>

              <section>
                <h4>المحتوى</h4>
                {isEditingAssignment && assignmentDraft ? (
                  <textarea
                    className="asn__edit-textarea asn__edit-textarea--content"
                    rows={12}
                    value={assignmentDraft.content}
                    onChange={(event) =>
                      setAssignmentDraft((current) =>
                        current
                          ? {
                              ...current,
                              content: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                ) : (
                  <pre>{selectedAssignment.content}</pre>
                )}
              </section>

              {!isEditingAssignment && selectedAssignment.server_id ? (
                <SmartRefinementPanel
                  artifactType="assignment"
                  artifactId={selectedAssignment.public_id}
                  assignmentGroupId={selectedAssignment.assignment_group_public_id ?? undefined}
                  baseArtifact={{
                    assignment_id: selectedAssignment.public_id,
                    name: selectedAssignment.name,
                    description: selectedAssignment.description ?? '',
                    type: selectedAssignment.type,
                    content: selectedAssignment.content,
                  }}
                  targetSelectors={getRefinementTargetOptions('assignment')}
                  enableBatchToggle
                  defaultMode="single"
                  onCommitted={handleRefinementCommitted}
                />
              ) : null}
            </article>
          )}
        </aside>
      </div>

      <WhatsAppExportModal
        isOpen={whatsAppExportOpen}
        title="إرسال الواجب عبر واتساب"
        defaultMessage={
          selectedAssignment
            ? buildHomeworkMessage({
                lessonTitle: selectedAssignment.name,
                content: selectedAssignment.content,
                dueDate: selectedAssignment.due_date ?? null,
                customMessageText: selectedAssignment.whatsapp_message_text ?? null,
              })
            : ''
        }
        onClose={() => setWhatsAppExportOpen(false)}
        isExporting={isExporting}
        confirmLabel="تصدير وفتح واتساب"
        onConfirm={async ({ format, message }) => {
          if (!canExportAssignment) return;
          setIsExporting(true);
          setExportError(null);
          try {
            await exportAssignment(selectedAssignment!.public_id, format);
            const text =
              message.trim() ||
              buildHomeworkMessage({
                lessonTitle: selectedAssignment.name,
                content: selectedAssignment.content,
                dueDate: selectedAssignment.due_date ?? null,
                customMessageText: selectedAssignment.whatsapp_message_text ?? null,
              });
            window.open(buildWhatsAppLink(text), '_blank', 'noopener,noreferrer');
            setWhatsAppExportOpen(false);
          } catch {
            setExportError('فشل تصدير الواجب.');
          } finally {
            setIsExporting(false);
          }
        }}
      />
    </div>
  );
}
