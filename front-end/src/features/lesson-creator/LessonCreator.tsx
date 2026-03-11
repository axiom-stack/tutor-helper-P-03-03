import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MdAssignment,
  MdCheckCircle,
  MdHistory,
  MdHourglassTop,
  MdMenuBook,
  MdOutlineError,
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdViewTimeline,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { Class, Lesson, Subject, Unit } from '../../types';
import {
  exportPlan,
  generatePlan,
  getLessonById,
  getLessonsByUnit,
  getMyClasses,
  getPlanById,
  getMySubjects,
  getUnitsBySubject,
  type GeneratePlanErrorResponse,
  type GeneratedPlanResponse,
  type PlanType,
} from './lesson-creator.services';
import LessonPlanDocumentView from '../lesson-plans/components/LessonPlanDocumentView';
import {
  toPlanTypeLabel,
  toValidationStatusLabel,
} from '../lesson-plans/planDisplay';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import { getLocalizedAiLimitMessage } from '../../utils/apiErrors';
import './lesson-creator.css';

type SelectValue = number | '';

type GenerationState =
  | 'idle'
  | 'fetching_content'
  | 'generating_draft_estimated'
  | 'polishing_estimated'
  | 'validating_saving_estimated'
  | 'success'
  | 'error';

type TimelineStatus = 'pending' | 'active' | 'done' | 'error';

type StepState = 'inactive' | 'active' | 'done';

interface ApiErrorShape {
  response?: {
    data?: GeneratePlanErrorResponse | { error?: string };
  };
  message?: string;
}

const DURATION_OPTIONS = [40, 45, 50, 90];

const TIMELINE_STEPS = [
  'استرجاع محتوى الدرس',
  'توليد المسودة الأولية',
  'تحسين الخطة تربويًا',
  'التحقق من الخطة وحفظها',
] as const;

function getErrorMessage(
  error: unknown,
  fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'
): string {
  const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
  if (localizedAiLimitMessage) {
    return localizedAiLimitMessage;
  }

  const extractDetailMessages = (details: unknown): string[] => {
    if (!Array.isArray(details)) {
      return [];
    }

    return details
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const maybeMessage = (item as { message?: unknown }).message;
        return typeof maybeMessage === 'string' && maybeMessage.trim().length > 0
          ? maybeMessage.trim()
          : null;
      })
      .filter((item): item is string => Boolean(item));
  };

  if (error && typeof error === 'object') {
    const parsed = error as ApiErrorShape;

    const nested = parsed.response?.data?.error;
    if (typeof nested === 'string' && nested.trim().length > 0) {
      return nested;
    }

    if (nested && typeof nested === 'object' && 'message' in nested) {
      const maybeMessage = nested.message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
        const detailMessages = extractDetailMessages(
          (nested as { details?: unknown }).details
        );

        if (detailMessages.length > 0) {
          return `${maybeMessage.trim()}: ${detailMessages.slice(0, 2).join(' | ')}`;
        }

        return maybeMessage.trim();
      }
    }

    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  }

  return fallback;
}

function LessonCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const unitsRequestIdRef = useRef(0);
  const lessonsRequestIdRef = useRef(0);
  const timelineTimersRef = useRef<number[]>([]);

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');
  const [selectedUnitId, setSelectedUnitId] = useState<SelectValue>('');
  const [selectedLessonId, setSelectedLessonId] = useState<SelectValue>('');

  const [planType, setPlanType] = useState<PlanType>(
    () => user?.profile?.default_plan_type ?? 'traditional'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(() => {
    const profileDuration = user?.profile?.default_lesson_duration_minutes ?? 45;
    return DURATION_OPTIONS.includes(profileDuration) ? profileDuration : 45;
  });
  const [isDurationManuallySelected, setIsDurationManuallySelected] =
    useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);

  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanResponse | null>(
    null
  );
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

  useEffect(() => {
    if (user?.userRole !== 'teacher') {
      return;
    }

    let cancelled = false;

    const loadInitialData = async () => {
      setInitialLoading(true);
      setPageError(null);

      try {
        const [classesResponse, subjectsResponse] = await Promise.all([
          getMyClasses(),
          getMySubjects(),
        ]);

        if (cancelled) {
          return;
        }

        setClasses(classesResponse.classes ?? []);
        setSubjects(subjectsResponse.subjects ?? []);
      } catch (error: unknown) {
        if (!cancelled) {
          setPageError(
            getErrorMessage(error, 'فشل تحميل الصفوف والمواد. حاول مجددًا.')
          );
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.userRole]);

  useEffect(() => {
    if (selectedSubjectId === '') {
      unitsRequestIdRef.current += 1;
      setUnits([]);
      setUnitsLoading(false);
      return;
    }

    const requestId = ++unitsRequestIdRef.current;
    setUnitsLoading(true);
    setPageError(null);

    getUnitsBySubject(selectedSubjectId)
      .then((response) => {
        if (requestId !== unitsRequestIdRef.current) {
          return;
        }
        setUnits(response.units ?? []);
      })
      .catch((error: unknown) => {
        if (requestId !== unitsRequestIdRef.current) {
          return;
        }
        setPageError(getErrorMessage(error, 'فشل تحميل وحدات المادة المختارة.'));
      })
      .finally(() => {
        if (requestId === unitsRequestIdRef.current) {
          setUnitsLoading(false);
        }
      });
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedUnitId === '') {
      lessonsRequestIdRef.current += 1;
      setLessons([]);
      setLessonsLoading(false);
      return;
    }

    const requestId = ++lessonsRequestIdRef.current;
    setLessonsLoading(true);
    setPageError(null);

    getLessonsByUnit(selectedUnitId)
      .then((response) => {
        if (requestId !== lessonsRequestIdRef.current) {
          return;
        }
        setLessons(response.lessons ?? []);
      })
      .catch((error: unknown) => {
        if (requestId !== lessonsRequestIdRef.current) {
          return;
        }
        setPageError(getErrorMessage(error, 'فشل تحميل دروس الوحدة المختارة.'));
      })
      .finally(() => {
        if (requestId === lessonsRequestIdRef.current) {
          setLessonsLoading(false);
        }
      });
  }, [selectedUnitId]);

  useEffect(() => {
    return () => {
      timelineTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timelineTimersRef.current = [];
    };
  }, []);

  const subjectsForSelectedClass = useMemo(() => {
    if (selectedClassId === '') {
      return [];
    }

    return subjects.filter((subjectItem) => subjectItem.class_id === selectedClassId);
  }, [selectedClassId, subjects]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const selectedSubject = useMemo(
    () => subjectsForSelectedClass.find((item) => item.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjectsForSelectedClass]
  );

  const selectedUnit = useMemo(
    () => units.find((item) => item.id === selectedUnitId) ?? null,
    [selectedUnitId, units]
  );

  const selectedLesson = useMemo(
    () => lessons.find((item) => item.id === selectedLessonId) ?? null,
    [selectedLessonId, lessons]
  );

  const canGenerate =
    selectedClassId !== '' &&
    selectedSubjectId !== '' &&
    selectedUnitId !== '' &&
    selectedLessonId !== '' &&
    !isGenerating;

  const clearTimelineTimers = () => {
    timelineTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    timelineTimersRef.current = [];
  };

  const startEstimatedTimeline = () => {
    clearTimelineTimers();

    timelineTimersRef.current = [
      window.setTimeout(() => {
        setGenerationState('polishing_estimated');
        setActiveTimelineIndex(2);
      }, 1400),
      window.setTimeout(() => {
        setGenerationState('validating_saving_estimated');
        setActiveTimelineIndex(3);
      }, 3200),
    ];
  };

  const handleClassSelect = (value: string) => {
    const nextClassId = value ? Number(value) : '';
    const nextClass =
      nextClassId === ''
        ? null
        : classes.find((classItem) => classItem.id === nextClassId) ?? null;

    setSelectedClassId(nextClassId);
    setSelectedSubjectId('');
    setSelectedUnitId('');
    setSelectedLessonId('');
    setUnits([]);
    setLessons([]);

    if (!isDurationManuallySelected && nextClass) {
      const classDuration = Number(nextClass.default_duration_minutes);
      if (Number.isInteger(classDuration) && classDuration > 0) {
        setDurationMinutes(classDuration);
      }
    }

    setPageError(null);
    setGenerationError(null);
  };

  const handleSubjectSelect = (value: string) => {
    const nextSubjectId = value ? Number(value) : '';
    setSelectedSubjectId(nextSubjectId);
    setSelectedUnitId('');
    setSelectedLessonId('');
    setLessons([]);
    setPageError(null);
    setGenerationError(null);
  };

  const handleUnitSelect = (value: string) => {
    const nextUnitId = value ? Number(value) : '';
    setSelectedUnitId(nextUnitId);
    setSelectedLessonId('');
    setPageError(null);
    setGenerationError(null);
  };

  const handleLessonSelect = (value: string) => {
    const nextLessonId = value ? Number(value) : '';
    setSelectedLessonId(nextLessonId);
    setGenerationError(null);
  };

  const handleGeneratePlan = async () => {
    if (!canGenerate || !selectedClass || !selectedSubject || !selectedUnit) {
      return;
    }

    setPageError(null);
    setGenerationError(null);
    setGeneratedPlan(null);
    setIsGenerating(true);
    setGenerationState('fetching_content');
    setActiveTimelineIndex(0);

    try {
      const lessonResponse = await getLessonById(Number(selectedLessonId));
      const lesson = lessonResponse.lesson;
      const lessonContent = lesson?.content?.trim();

      if (!lessonContent) {
        throw new Error('لا يمكن توليد الخطة لأن محتوى الدرس فارغ.');
      }

      const lessonTitle = lesson?.name?.trim() || selectedLesson?.name?.trim() || '';
      const subjectName = selectedSubject.name?.trim() || '';
      const unitName = selectedUnit.name?.trim() || '';
      const gradeValue =
        selectedClass.grade_label?.trim() || selectedClass.name?.trim() || '';
      const safeDurationMinutes = Number(durationMinutes);

      if (!lessonTitle) {
        throw new Error('تعذر تحديد عنوان الدرس للتوليد.');
      }
      if (!subjectName) {
        throw new Error('تعذر تحديد اسم المادة للتوليد.');
      }
      if (!unitName) {
        throw new Error('تعذر تحديد اسم الوحدة للتوليد.');
      }
      if (!gradeValue) {
        throw new Error('يرجى تحديد صف يحتوي على المرحلة/الصف قبل التوليد.');
      }
      if (!Number.isInteger(safeDurationMinutes) || safeDurationMinutes <= 0) {
        throw new Error('مدة الحصة يجب أن تكون رقمًا صحيحًا موجبًا.');
      }

      setGenerationState('generating_draft_estimated');
      setActiveTimelineIndex(1);
      startEstimatedTimeline();

      const generated = await generatePlan({
        lesson_id: Number(selectedLessonId),
        lesson_title: lessonTitle,
        lesson_content: lessonContent,
        subject: subjectName,
        grade: gradeValue,
        unit: unitName,
        duration_minutes: safeDurationMinutes,
        plan_type: planType,
        class_id: selectedClass.id,
        class_name: selectedClass.name,
        section: selectedClass.section,
      });

      clearTimelineTimers();
      setGeneratedPlan(generated);
      setGenerationState('success');
      setActiveTimelineIndex(3);
    } catch (error: unknown) {
      clearTimelineTimers();
      setGenerationState('error');
      setGenerationError(
        getErrorMessage(error, 'فشل توليد الخطة. تحقق من البيانات وحاول مجددًا.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenAssignments = () => {
    if (!generatedPlan || selectedLessonId === '') {
      return;
    }

    const lessonId = Number(selectedLessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return;
    }

    navigate(`/assignments/${generatedPlan.id}/${lessonId}`, {
      state: {
        lesson_plan_public_id: generatedPlan.id,
        lesson_id: lessonId,
      },
    });
  };

  const handleExportPdf = () => {
    if (!generatedPlan?.id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportPlan(generatedPlan.id, 'pdf').catch((err: unknown) => {
      setExportError(getErrorMessage(err, 'فشل تصدير PDF.'));
    }).finally(() => {
      setIsExporting(false);
    });
  };

  const handleExportWord = () => {
    if (!generatedPlan?.id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportPlan(generatedPlan.id, 'docx').catch((err: unknown) => {
      setExportError(getErrorMessage(err, 'فشل تصدير Word.'));
    }).finally(() => {
      setIsExporting(false);
    });
  };

  const handleRefinementCommitted = async () => {
    if (!generatedPlan?.id) {
      return;
    }

    const response = await getPlanById(generatedPlan.id);
    const plan = response.plan;
    setGeneratedPlan({
      id: plan.public_id,
      plan_type: plan.plan_type,
      plan_json: plan.plan_json ?? {},
      validation_status: plan.validation_status,
      retry_occurred: plan.retry_occurred,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    });
  };

  const getStepState = (step: 1 | 2 | 3 | 4): StepState => {
    if (step === 1) {
      return selectedClassId !== '' ? 'done' : 'active';
    }

    if (step === 2) {
      if (selectedClassId === '') return 'inactive';
      return selectedSubjectId !== '' ? 'done' : 'active';
    }

    if (step === 3) {
      if (selectedSubjectId === '') return 'inactive';
      return selectedUnitId !== '' ? 'done' : 'active';
    }

    if (selectedUnitId === '') return 'inactive';
    return selectedLessonId !== '' ? 'done' : 'active';
  };

  const getTimelineStatus = (index: number): TimelineStatus => {
    if (generationState === 'idle') {
      return 'pending';
    }

    if (generationState === 'success') {
      return 'done';
    }

    if (generationState === 'error') {
      if (index < activeTimelineIndex) {
        return 'done';
      }

      if (index === activeTimelineIndex) {
        return 'error';
      }

      return 'pending';
    }

    if (index < activeTimelineIndex) {
      return 'done';
    }

    if (index === activeTimelineIndex) {
      return 'active';
    }

    return 'pending';
  };

  const timelineSummary = (() => {
    if (generationState === 'fetching_content') {
      return 'جارٍ استرجاع محتوى الدرس...';
    }

    if (generationState === 'generating_draft_estimated') {
      return 'جارٍ توليد المسودة الأولية...';
    }

    if (generationState === 'polishing_estimated') {
      return 'جارٍ تحسين الخطة تربويًا...';
    }

    if (generationState === 'validating_saving_estimated') {
      return 'جارٍ التحقق من الخطة وحفظها...';
    }

    if (generationState === 'success') {
      return 'تم توليد الخطة وحفظها بنجاح.';
    }

    if (generationState === 'error') {
      return generationError ?? 'تعذر إكمال العملية.';
    }

    return 'اختر بيانات الدرس واضغط على توليد الخطة.';
  })();

  if (user?.userRole !== 'teacher') {
    return null;
  }

  return (
    <div className="lcp">
      <header className="lcp__header page-header">
        <div>
          <nav className="lcp__breadcrumb" aria-label="breadcrumb">
            <Link to="/teacher">الرئيسية</Link>
            <span>←</span>
            <span className="lcp__breadcrumb-current">خطط الدروس</span>
          </nav>
          <h1>مساحة إنشاء خطة الدرس</h1>
          <p>تجهيز خطة درس ذكية من محتوى درس محفوظ لديك في النظام.</p>
        </div>

        <div className="lcp__header-actions" aria-hidden>
          <button type="button" disabled>
            حفظ
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!generatedPlan || isExporting}
            aria-busy={isExporting}
          >
            <MdOutlinePictureAsPdf aria-hidden />
            {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportWord}
            disabled={!generatedPlan || isExporting}
            aria-busy={isExporting}
          >
            <MdOutlineTextSnippet aria-hidden />
            {isExporting ? 'جاري التصدير...' : 'تصدير Word'}
          </button>
        </div>
      </header>

      {exportError && (
        <div className="lcp__alert lcp__alert--error" role="alert">
          <MdOutlineError aria-hidden />
          <span>{exportError}</span>
        </div>
      )}

      {pageError && (
        <div className="lcp__alert lcp__alert--error" role="alert">
          <MdOutlineError aria-hidden />
          <span>{pageError}</span>
        </div>
      )}

      <div className="lcp__layout">
        <section className="lcp__preview" aria-live="polite">
          <div className="lcp__timeline-card">
            <div className="lcp__timeline-head">
              <h2>
                <MdViewTimeline aria-hidden />
                حالة التنفيذ
              </h2>
              {isGenerating && (
                <span className="lcp__timeline-badge">
                  <MdHourglassTop aria-hidden />
                  جارٍ التنفيذ
                </span>
              )}
              {generationState === 'success' && (
                <span className="lcp__timeline-badge lcp__timeline-badge--success">
                  <MdCheckCircle aria-hidden />
                  اكتمل
                </span>
              )}
            </div>
            <p className="lcp__timeline-summary">{timelineSummary}</p>

            <ul className="lcp__timeline-list">
              {TIMELINE_STEPS.map((step, index) => {
                const status = getTimelineStatus(index);
                return (
                  <li
                    key={step}
                    className={`lcp__timeline-item lcp__timeline-item--${status}`}
                  >
                    <span className="lcp__timeline-dot" aria-hidden />
                    <span>{step}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {!generatedPlan ? (
            <div className="lcp__empty">
              <MdMenuBook className="lcp__empty-icon" aria-hidden />
              <h3>لم يتم توليد أي خطة بعد</h3>
              <p>
                اختر الصف والمادة والوحدة والدرس من اللوحة اليمنى ثم اضغط على
                "توليد الخطة".
              </p>
            </div>
          ) : (
            <article className="lcp__plan-card">
              <div className="lcp__plan-banner" role="status">
                <MdCheckCircle aria-hidden />
                <span>
                  تم إنشاء الخطة بنجاح | رقم الخطة: #{generatedPlan.id} | النوع:{' '}
                  {toPlanTypeLabel(generatedPlan.plan_type)}{' '}
                  | التحقق: {toValidationStatusLabel(generatedPlan.validation_status)} |
                  {' '}إعادة التحسين:{' '}
                  {generatedPlan.retry_occurred ? 'نعم' : 'لا'}
                </span>
              </div>

              <div className="lcp__plan-actions">
                <button
                  type="button"
                  onClick={handleOpenAssignments}
                  disabled={selectedLessonId === ''}
                >
                  <MdAssignment aria-hidden />
                  الانتقال إلى صفحة الواجبات
                </button>
              </div>
              <LessonPlanDocumentView
                planType={generatedPlan.plan_type}
                planJson={generatedPlan.plan_json}
                fallback={{
                  lessonTitle: selectedLesson?.name,
                  subject: selectedSubject?.name,
                  grade: selectedClass?.grade_label,
                  section: selectedClass?.section_label,
                  unit: selectedUnit?.name,
                  durationMinutes,
                }}
              />

            </article>
          )}
        </section>

        <aside className="lcp__controls">
          <h2>توليد الخطة بالذكاء الاصطناعي</h2>
          <p>أكمل الخطوات بالترتيب، ثم اختر نوع الخطة والزمن واضغط توليد.</p>

          <div className="lcp__steps">
            <div className={`lcp__step lcp__step--${getStepState(1)}`}>
              <div className="lcp__step-index">1</div>
              <div className="lcp__step-content">
                <label htmlFor="lcp-class-select">الصف الدراسي</label>
                <select
                  id="lcp-class-select"
                  value={selectedClassId}
                  onChange={(event) => handleClassSelect(event.target.value)}
                  disabled={initialLoading || isGenerating}
                >
                  <option value="">اختر الصف...</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`lcp__step lcp__step--${getStepState(2)}`}>
              <div className="lcp__step-index">2</div>
              <div className="lcp__step-content">
                <label htmlFor="lcp-subject-select">المادة</label>
                <select
                  id="lcp-subject-select"
                  value={selectedSubjectId}
                  onChange={(event) => handleSubjectSelect(event.target.value)}
                  disabled={selectedClassId === '' || isGenerating}
                >
                  <option value="">اختر المادة...</option>
                  {subjectsForSelectedClass.map((subjectItem) => (
                    <option key={subjectItem.id} value={subjectItem.id}>
                      {subjectItem.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`lcp__step lcp__step--${getStepState(3)}`}>
              <div className="lcp__step-index">3</div>
              <div className="lcp__step-content">
                <label htmlFor="lcp-unit-select">الوحدة</label>
                <select
                  id="lcp-unit-select"
                  value={selectedUnitId}
                  onChange={(event) => handleUnitSelect(event.target.value)}
                  disabled={selectedSubjectId === '' || unitsLoading || isGenerating}
                >
                  <option value="">اختر الوحدة...</option>
                  {units.map((unitItem) => (
                    <option key={unitItem.id} value={unitItem.id}>
                      {unitItem.name}
                    </option>
                  ))}
                </select>
                {unitsLoading && <small>جارٍ تحميل وحدات المادة...</small>}
              </div>
            </div>

            <div className={`lcp__step lcp__step--${getStepState(4)}`}>
              <div className="lcp__step-index">4</div>
              <div className="lcp__step-content">
                <label htmlFor="lcp-lesson-select">الدرس</label>
                <select
                  id="lcp-lesson-select"
                  value={selectedLessonId}
                  onChange={(event) => handleLessonSelect(event.target.value)}
                  disabled={selectedUnitId === '' || lessonsLoading || isGenerating}
                >
                  <option value="">اختر الدرس...</option>
                  {lessons.map((lessonItem) => (
                    <option key={lessonItem.id} value={lessonItem.id}>
                      {lessonItem.name}
                    </option>
                  ))}
                </select>
                {lessonsLoading && <small>جارٍ تحميل دروس الوحدة...</small>}
              </div>
            </div>
          </div>

          <div className="lcp__options">
            <div>
              <label>نوع الخطة</label>
              <div className="lcp__plan-type-toggle">
                <button
                  type="button"
                  className={planType === 'traditional' ? 'is-active' : ''}
                  onClick={() => setPlanType('traditional')}
                  disabled={selectedLessonId === '' || isGenerating}
                >
                  تقليدية
                </button>
                <button
                  type="button"
                  className={planType === 'active_learning' ? 'is-active' : ''}
                  onClick={() => setPlanType('active_learning')}
                  disabled={selectedLessonId === '' || isGenerating}
                >
                  تعلم نشط
                </button>
              </div>
            </div>

            <div className="lcp__duration">
              <label htmlFor="lcp-duration">المدة الزمنية</label>
              <select
                id="lcp-duration"
                value={durationMinutes}
                onChange={(event) => {
                  setDurationMinutes(Number(event.target.value));
                  setIsDurationManuallySelected(true);
                }}
                disabled={selectedLessonId === '' || isGenerating}
              >
                {DURATION_OPTIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} دقيقة
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="lcp__generate-btn"
              onClick={() => void handleGeneratePlan()}
              disabled={!canGenerate}
            >
              {isGenerating ? (
                <>
                  <MdHistory aria-hidden />
                  جارٍ توليد الخطة...
                </>
              ) : generationState === 'error' ? (
                'إعادة المحاولة'
              ) : (
                'توليد الخطة'
              )}
            </button>
          </div>
        </aside>

        {generatedPlan && (
          <section className="lcp__refinement-row">
            <SmartRefinementPanel
              artifactType="lesson_plan"
              artifactId={generatedPlan.id}
              baseArtifact={{
                id: generatedPlan.id,
                plan_type: generatedPlan.plan_type,
                lesson_title: selectedLesson?.name ?? '',
                subject: selectedSubject?.name ?? '',
                grade: selectedClass?.grade_label ?? '',
                unit: selectedUnit?.name ?? '',
                duration_minutes: durationMinutes,
                plan_json: generatedPlan.plan_json,
              }}
              targetSelectors={getRefinementTargetOptions('lesson_plan')}
              onCommitted={handleRefinementCommitted}
            />
          </section>
        )}
      </div>
    </div>
  );
}

export default LessonCreator;
