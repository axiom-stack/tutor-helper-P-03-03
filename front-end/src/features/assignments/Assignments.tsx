import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  MdAssignment,
  MdAutoAwesome,
  MdCheckCircle,
  MdErrorOutline,
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdRefresh,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { Assignment } from '../../types';
import { ASSIGNMENT_TYPE_LABELS } from '../../types';
import {
  exportAssignment,
  generateAssignments,
  getAssignmentById,
  listAssignments,
} from './assignments.services';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
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

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(
    null
  );
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(
    null
  );

  const [isListLoading, setIsListLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  }, [assignments, context, isScopedView, lastRefreshedAt]);

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
          ? await listAssignments(context.lessonPlanPublicId, context.lessonId)
          : await listAssignments();
        const nextAssignments = response.assignments ?? [];
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
    [context, isScopedView]
  );

  useEffect(() => {
    if (user?.userRole !== 'teacher') {
      setAssignments([]);
      setSelectedAssignment(null);
      return;
    }

    void loadAssignments();
  }, [context, user?.userRole, loadAssignments]);

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
      await loadAssignments(true);
      const generatedAssignments = response.assignments ?? [];
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

  const handleViewAssignment = async (assignment: Assignment) => {
    setActiveAssignmentId(assignment.public_id);
    setSelectedAssignment(assignment);
    setIsDetailLoading(true);
    setError(null);

    try {
      const response = await getAssignmentById(assignment.public_id);
      setSelectedAssignment(response.assignment);
    } catch (viewError: unknown) {
      setError(normalizeApiError(viewError, 'تعذر تحميل تفاصيل الواجب.'));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRefinementCommitted = async () => {
    await loadAssignments(true);
    if (selectedAssignment?.public_id) {
      const response = await getAssignmentById(selectedAssignment.public_id);
      setSelectedAssignment(response.assignment);
      setActiveAssignmentId(response.assignment.public_id);
    }
    setSuccessMessage('تم حفظ التعديل المعتمد بنجاح.');
  };

  const handleExportPdf = () => {
    if (!selectedAssignment?.public_id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportAssignment(selectedAssignment.public_id, 'pdf')
      .catch(() => setExportError('فشل تصدير PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleExportWord = () => {
    if (!selectedAssignment?.public_id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportAssignment(selectedAssignment.public_id, 'docx')
      .catch(() => setExportError('فشل تصدير Word.'))
      .finally(() => setIsExporting(false));
  };

  if (user?.userRole !== 'teacher') {
    return null;
  }

  return (
    <div className="asn">
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
              : 'استعراض جميع الواجبات المحفوظة لحسابك، فتح التفاصيل الكاملة، ثم تعديل أي واجب أو تصديره عند الحاجة.'}
          </p>
        </div>

        <button
          type="button"
          className="asn-btn asn-btn--primary"
          onClick={() => void handleGenerateAssignments()}
          disabled={!context || isGenerating || isListLoading}
        >
          <MdAutoAwesome aria-hidden />
          {isGenerating ? 'جارٍ التوليد...' : 'اقتراح واجبات جديدة'}
        </button>
      </header>

      <section className="asn__context">
        {summaryCards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            {card.label.includes('الخطة') ? <code>{card.value}</code> : <p>{card.value}</p>}
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      {error && (
        <div className="asn-alert asn-alert--error" role="alert">
          <MdErrorOutline aria-hidden />
          <div>
            <p>{error.message}</p>
            {error.code && <small>رمز الخطأ: {error.code}</small>}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="asn-alert asn-alert--success" role="status">
          <MdCheckCircle aria-hidden />
          <p>{successMessage}</p>
        </div>
      )}

      {!context && (
        <section className="asn-mode-banner">
          <MdAssignment aria-hidden className="asn-mode-banner__icon" />
          <div>
            <h2>وضع مكتبة الواجبات</h2>
            <p>
              لا يوجد سياق درس محدد في الرابط الحالي، لذلك تعرض الصفحة جميع
              الواجبات المحفوظة لحسابك وتسمح بفتحها ومراجعتها من مكان واحد.
            </p>
          </div>
          <Link to="/lessons" className="asn-mode-banner__link">
            فتح خطط الدروس لتوليد واجبات جديدة
          </Link>
        </section>
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
                disabled={isListLoading || isRefreshing}
              >
                <MdRefresh aria-hidden />
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
                    : 'يتم الآن قراءة جميع الواجبات المحفوظة لحسابك.'}
                </p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="asn-empty">
                <MdAssignment aria-hidden className="asn-empty__icon" />
                <h3>
                  {context ? 'لا توجد واجبات مقترحة بعد' : 'لا توجد واجبات محفوظة بعد'}
                </h3>
                <p>
                  {context
                    ? 'اضغط على "اقتراح واجبات جديدة" لتوليد واجبات مرتبطة بالخطة الحالية.'
                    : 'لا توجد واجبات محفوظة لهذا الحساب حتى الآن. افتح درساً محدداً لتوليد واجبات جديدة.'}
                </p>
                {context && (
                  <button
                    type="button"
                    className="asn-btn asn-btn--primary"
                    onClick={() => void handleGenerateAssignments()}
                    disabled={isGenerating}
                  >
                    <MdAutoAwesome aria-hidden />
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
              {selectedAssignment && (
                <>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    aria-busy={isExporting}
                  >
                    <MdOutlinePictureAsPdf aria-hidden />
                    تصدير PDF
                  </button>
                  <button
                    type="button"
                    className="asn-btn asn-btn--ghost"
                    onClick={handleExportWord}
                    disabled={isExporting}
                    aria-busy={isExporting}
                  >
                    <MdOutlineTextSnippet aria-hidden />
                    تصدير Word
                  </button>
                </>
              )}
            </div>

            {exportError && (
              <div className="asn-alert asn-alert--error" role="alert">
                <MdErrorOutline aria-hidden />
                <p>{exportError}</p>
              </div>
            )}

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
                  <h3>{selectedAssignment.name}</h3>
                  <span
                    className={`asn-card__type asn-card__type--${selectedAssignment.type}`}
                  >
                    {ASSIGNMENT_TYPE_LABELS[selectedAssignment.type]}
                  </span>
                </div>

                <dl className="asn__meta-list">
                  <div>
                    <dt>معرّف الواجب</dt>
                    <dd>{selectedAssignment.public_id}</dd>
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
                </dl>

                <section>
                  <h4>الوصف</h4>
                  <p>
                    {selectedAssignment.description?.trim() ||
                      'لا يوجد وصف إضافي لهذا الواجب.'}
                  </p>
                </section>

                <section>
                  <h4>المحتوى</h4>
                  <pre>{selectedAssignment.content}</pre>
                </section>

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
              </article>
            )}
          </aside>
        </div>
    </div>
  );
}
