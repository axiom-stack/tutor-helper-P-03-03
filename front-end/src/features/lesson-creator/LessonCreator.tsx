import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
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
  generatePlan,
  getLessonById,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  type GeneratePlanErrorResponse,
  type GeneratedPlanResponse,
  type PlanType,
} from './lesson-creator.services';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(
  error: unknown,
  fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'
): string {
  if (error && typeof error === 'object') {
    const parsed = error as ApiErrorShape;

    const nested = parsed.response?.data?.error;
    if (typeof nested === 'string' && nested.trim().length > 0) {
      return nested;
    }

    if (nested && typeof nested === 'object' && 'message' in nested) {
      const maybeMessage = nested.message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
        return maybeMessage;
      }
    }

    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  }

  return fallback;
}

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '—';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    const candidateKeys = [
      'text',
      'objective',
      'description',
      'name',
      'question',
      'content',
      'title',
      'value',
    ];

    for (const key of candidateKeys) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    const entries = Object.entries(value)
      .map(([key, itemValue]) => {
        if (typeof itemValue === 'string' || typeof itemValue === 'number') {
          return `${key}: ${itemValue}`;
        }

        if (Array.isArray(itemValue)) {
          return `${key}: ${itemValue.map((item) => toDisplayText(item)).join('، ')}`;
        }

        if (isRecord(itemValue)) {
          return `${key}: ${JSON.stringify(itemValue)}`;
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));

    return entries.length > 0 ? entries.join(' | ') : '—';
  }

  return '—';
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => toDisplayText(item)).filter((item) => item !== '—');
}

function extractHeaderValue(header: Record<string, unknown>, key: string): string {
  return toDisplayText(header[key]);
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

  const [planType, setPlanType] = useState<PlanType>('traditional');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);

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
    setSelectedClassId(nextClassId);
    setSelectedSubjectId('');
    setSelectedUnitId('');
    setSelectedLessonId('');
    setUnits([]);
    setLessons([]);
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

      setGenerationState('generating_draft_estimated');
      setActiveTimelineIndex(1);
      startEstimatedTimeline();

      const generated = await generatePlan({
        lesson_title: lesson.name,
        lesson_content: lessonContent,
        subject: selectedSubject.name,
        grade: selectedClass.name,
        unit: selectedUnit.name,
        duration_minutes: durationMinutes,
        plan_type: planType,
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

  const planObject = isRecord(generatedPlan?.plan_json)
    ? generatedPlan?.plan_json
    : {};
  const header = isRecord(planObject.header) ? planObject.header : {};

  const traditionalConcepts = toTextList(planObject.concepts);
  const traditionalObjectives = toTextList(planObject.objectives);
  const traditionalActivities = toTextList(planObject.activities);
  const traditionalResources = toTextList(planObject.resources);
  const traditionalAssessment = toTextList(planObject.assessment);

  const activeObjectives = toTextList(planObject.objectives);
  const lessonFlow = Array.isArray(planObject.lesson_flow)
    ? planObject.lesson_flow.filter((item) => isRecord(item))
    : [];

  return (
    <div className="lcp" dir="rtl">
      <header className="lcp__header">
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
          <button type="button" disabled>
            <MdOutlinePictureAsPdf aria-hidden />
            تصدير PDF
          </button>
          <button type="button" disabled>
            <MdOutlineTextSnippet aria-hidden />
            تصدير Word
          </button>
        </div>
      </header>

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
                  {generatedPlan.plan_type === 'traditional'
                    ? 'تقليدية'
                    : 'تعلم نشط'}{' '}
                  | التحقق: {generatedPlan.validation_status} | إعادة التحسين:{' '}
                  {generatedPlan.retry_occurred ? 'نعم' : 'لا'}
                </span>
              </div>

              <div className="lcp__meta-grid">
                <div>
                  <label>التاريخ</label>
                  <p>{extractHeaderValue(header, 'date')}</p>
                </div>
                <div>
                  <label>اليوم</label>
                  <p>{extractHeaderValue(header, 'day')}</p>
                </div>
                <div>
                  <label>الصف</label>
                  <p>
                    {extractHeaderValue(header, 'grade') !== '—'
                      ? extractHeaderValue(header, 'grade')
                      : selectedClass?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <label>الشعبة</label>
                  <p>{extractHeaderValue(header, 'class')}</p>
                </div>
                <div>
                  <label>الدرس</label>
                  <p>
                    {extractHeaderValue(header, 'lesson_title') !== '—'
                      ? extractHeaderValue(header, 'lesson_title')
                      : selectedLesson?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <label>الوحدة</label>
                  <p>
                    {extractHeaderValue(header, 'unit') !== '—'
                      ? extractHeaderValue(header, 'unit')
                      : selectedUnit?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <label>المدة</label>
                  <p>
                    {extractHeaderValue(header, 'duration') !== '—'
                      ? extractHeaderValue(header, 'duration')
                      : `${durationMinutes} دقيقة`}
                  </p>
                </div>
                <div>
                  <label>الخطة</label>
                  <p>
                    {generatedPlan.plan_type === 'traditional'
                      ? 'تقليدية'
                      : 'تعلم نشط'}
                  </p>
                </div>
              </div>

              {generatedPlan.plan_type === 'traditional' ? (
                <div className="lcp__plan-sections">
                  <section>
                    <h3>التمهيد</h3>
                    <p>{toDisplayText(planObject.intro)}</p>
                  </section>

                  <section>
                    <h3>المفاهيم</h3>
                    <ul>
                      {traditionalConcepts.length > 0 ? (
                        traditionalConcepts.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>الأهداف التعليمية</h3>
                    <ul>
                      {traditionalObjectives.length > 0 ? (
                        traditionalObjectives.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>الاستراتيجية</h3>
                    <p>{toDisplayText(planObject.strategy)}</p>
                  </section>

                  <section>
                    <h3>الأنشطة</h3>
                    <ul>
                      {traditionalActivities.length > 0 ? (
                        traditionalActivities.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>الوسائل</h3>
                    <ul>
                      {traditionalResources.length > 0 ? (
                        traditionalResources.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>التقويم</h3>
                    <ul>
                      {traditionalAssessment.length > 0 ? (
                        traditionalAssessment.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>الواجب</h3>
                    <p>{toDisplayText(planObject.homework)}</p>
                  </section>

                  <section>
                    <h3>المصدر</h3>
                    <p>{toDisplayText(planObject.source)}</p>
                  </section>
                </div>
              ) : (
                <div className="lcp__plan-sections">
                  <section>
                    <h3>الأهداف التعليمية</h3>
                    <ul>
                      {activeObjectives.length > 0 ? (
                        activeObjectives.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))
                      ) : (
                        <li>لا توجد بيانات.</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>الاستراتيجية</h3>
                    <p>{toDisplayText(planObject.strategy)}</p>
                  </section>

                  <section>
                    <h3>تدفق الدرس</h3>
                    <div className="lcp__table-wrap">
                      <table className="lcp__flow-table">
                        <thead>
                          <tr>
                            <th>الزمن</th>
                            <th>المحتوى</th>
                            <th>نوع النشاط</th>
                            <th>دور المعلم</th>
                            <th>دور الطالب</th>
                            <th>الوسائل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lessonFlow.length > 0 ? (
                            lessonFlow.map((row, index) => {
                              const resources = Array.isArray(row.resources)
                                ? row.resources.map((item) => toDisplayText(item)).join('، ')
                                : '—';

                              return (
                                <tr key={`flow-${index}`}>
                                  <td>{toDisplayText(row.time)}</td>
                                  <td>{toDisplayText(row.content)}</td>
                                  <td>{toDisplayText(row.activity_type)}</td>
                                  <td>{toDisplayText(row.teacher_action)}</td>
                                  <td>{toDisplayText(row.student_action)}</td>
                                  <td>{resources || '—'}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6}>لا توجد بيانات تدفق.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h3>الواجب</h3>
                    <p>{toDisplayText(planObject.homework)}</p>
                  </section>
                </div>
              )}
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
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
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
      </div>
    </div>
  );
}

export default LessonCreator;
