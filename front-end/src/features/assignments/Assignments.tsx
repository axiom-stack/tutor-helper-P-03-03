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
  modifyAssignment,
} from './assignments.services';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
import AssignmentCard from './components/AssignmentCard';
import ModifyAssignmentModal from './components/ModifyAssignmentModal';
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

  const { context, rawLessonPlanPublicId, rawLessonId } = useMemo(
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

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(
    null
  );
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(
    null
  );
  const [assignmentToModify, setAssignmentToModify] = useState<Assignment | null>(
    null
  );

  const [isListLoading, setIsListLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isModifying, setIsModifying] = useState(false);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [modifyError, setModifyError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
      if (!context) {
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsListLoading(true);
      }

      try {
        const response = await listAssignments(
          context.lessonPlanPublicId,
          context.lessonId
        );
        const nextAssignments = response.assignments ?? [];
        setAssignments(nextAssignments);
        setLastRefreshedAt(new Date());
        setError(null);

        setSelectedAssignment((current) => {
          if (!current) {
            return null;
          }
          return (
            nextAssignments.find(
              (assignment) => assignment.public_id === current.public_id
            ) ?? null
          );
        });
      } catch (listError: unknown) {
        setError(
          normalizeApiError(listError, 'تعذر تحميل قائمة الواجبات لهذا الدرس.')
        );
      } finally {
        setIsListLoading(false);
        setIsRefreshing(false);
      }
    },
    [context]
  );

  useEffect(() => {
    if (!context || user?.userRole !== 'teacher') {
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

      const generatedCount = response.assignments?.length ?? 0;
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

  const handleOpenModifyModal = (assignment: Assignment) => {
    setAssignmentToModify(assignment);
    setModifyError(null);
  };

  const handleCloseModifyModal = () => {
    if (isModifying) {
      return;
    }
    setAssignmentToModify(null);
    setModifyError(null);
  };

  const handleSubmitModification = async (modificationRequest: string) => {
    if (!assignmentToModify) {
      return;
    }

    setIsModifying(true);
    setModifyError(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await modifyAssignment(
        assignmentToModify.public_id,
        modificationRequest
      );

      const updatedAssignment = response.assignment;
      setAssignments((current) =>
        current.map((assignment) =>
          assignment.public_id === updatedAssignment.public_id
            ? updatedAssignment
            : assignment
        )
      );
      setSelectedAssignment((current) =>
        current?.public_id === updatedAssignment.public_id
          ? updatedAssignment
          : current
      );

      setSuccessMessage('تم تعديل الواجب وحفظ التعديلات بنجاح.');
      setAssignmentToModify(null);
      await loadAssignments(true);
    } catch (modificationError: unknown) {
      const normalized = normalizeApiError(
        modificationError,
        'تعذر تعديل الواجب. حاول مرة أخرى.'
      );
      setModifyError(normalized);
      setError(normalized);
    } finally {
      setIsModifying(false);
    }
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
    <div className="asn" dir="rtl">
      <header className="asn__header">
        <div>
          <nav className="asn__breadcrumb" aria-label="breadcrumb">
            <Link to="/teacher">الرئيسية</Link>
            <span>←</span>
            <span className="asn__breadcrumb-current">الواجبات</span>
          </nav>
          <h1>إدارة الواجبات المنزلية</h1>
          <p>
            توليد واجبات مرتبطة بخطة الدرس، مراجعتها، ثم تعديلها بالذكاء الاصطناعي
            مع حفظ التعديلات مباشرة في قاعدة البيانات.
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
        <article>
          <span>معرّف الخطة</span>
          <code>{context?.lessonPlanPublicId ?? rawLessonPlanPublicId ?? '—'}</code>
        </article>
        <article>
          <span>معرّف الدرس</span>
          <p>{context?.lessonId ?? rawLessonId ?? '—'}</p>
        </article>
        <article>
          <span>آخر تحديث</span>
          <p>{formatRefreshTime(lastRefreshedAt)}</p>
        </article>
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

      {!context ? (
        <section className="asn-empty-context">
          <MdAssignment aria-hidden className="asn-empty-context__icon" />
          <h2>تعذر تحديد سياق الدرس والخطة</h2>
          <p>
            هذه الصفحة تحتاج قيمتين صالحـتين: <code>lesson_plan_public_id</code>{' '}
            بشكل <code>trd_1</code> أو <code>act_1</code> و
            <code>lesson_id</code> كرقم صحيح موجب.
          </p>
          <p>
            الأفضل فتحها من صفحة "خطط الدروس" بعد إنشاء خطة، أو عبر رابط يحتوي
            القيم المطلوبة.
          </p>
          <Link to="/lessons" className="asn-empty-context__link">
            العودة إلى صفحة خطط الدروس
          </Link>
        </section>
      ) : (
        <div className="asn__layout">
          <section className="asn__list" aria-live="polite">
            <div className="asn__list-head">
              <div>
                <h2>الواجبات المقترحة ({assignments.length})</h2>
                <p>يمكنك عرض التفاصيل أو تعديل أي واجب ثم حفظه مباشرة.</p>
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
                <p>يتم الآن قراءة الواجبات المحفوظة لهذا الدرس.</p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="asn-empty">
                <MdAssignment aria-hidden className="asn-empty__icon" />
                <h3>لا توجد واجبات مقترحة بعد</h3>
                <p>
                  اضغط على "اقتراح واجبات جديدة" لتوليد واجبات مرتبطة بالخطة
                  الحالية.
                </p>
                <button
                  type="button"
                  className="asn-btn asn-btn--primary"
                  onClick={() => void handleGenerateAssignments()}
                  disabled={isGenerating}
                >
                  <MdAutoAwesome aria-hidden />
                  {isGenerating ? 'جارٍ التوليد...' : 'توليد الواجبات الآن'}
                </button>
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
                    onModify={handleOpenModifyModal}
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
                    onClick={() => void handleOpenModifyModal(selectedAssignment)}
                  >
                    <MdAutoAwesome aria-hidden />
                    تعديل
                  </button>
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
                <p>اختر واجباً من القائمة لعرض تفاصيله كاملة هنا.</p>
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
              </article>
            )}
          </aside>
        </div>
      )}

      <ModifyAssignmentModal
        key={assignmentToModify?.public_id ?? 'closed'}
        assignment={assignmentToModify}
        isOpen={assignmentToModify !== null}
        isSubmitting={isModifying}
        error={modifyError}
        onClose={handleCloseModifyModal}
        onSubmit={handleSubmitModification}
      />
    </div>
  );
}
