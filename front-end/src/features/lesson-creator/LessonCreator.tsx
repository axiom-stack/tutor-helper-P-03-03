import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import {
  MdCheckCircle,
  MdClose,
  MdEdit,
  MdHourglassTop,
  MdSave,
  MdViewTimeline,
} from 'react-icons/md';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import ExportFormatModal from '../../components/common/ExportFormatModal';
import { useAuth } from '../../context/AuthContext';
import {
  LESSON_DURATION_OPTIONS,
  PERIOD_OPTIONS,
  PLAN_TYPE_OPTIONS,
} from '../../constants/dropdown-options';
import type { Class, Lesson, Subject, Unit } from '../../types';
import {
  getAllClasses,
  generatePlan,
  getLessonById,
  getLessonsByUnit,
  getMyClasses,
  getPlanById,
  getSubjectsByClass,
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
import {
  deletePlanById,
  updatePlan,
} from '../plans-manager/plans-manager.services';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import { getLocalizedAiLimitMessage } from '../../utils/apiErrors';
import {
  formatClassBaseSelectLabel,
  normalizeAcademicYearLabel,
  normalizeSemesterLabel,
  getClassBaseKey,
  getClassSectionLabel,
} from '../../utils/classDisplay';
import {
  formatUnitDisplayLabel,
  formatUnitOrdinalText,
} from '../../utils/unitDisplay';
import './lesson-creator.css';

type SelectValue = number | '';

type LessonCreatorScreen = 'creator' | 'generated' | 'confirmation';

interface PlanDraft {
  lessonTitle: string;
  planJson: Record<string, unknown>;
}

type GenerationState =
  | 'idle'
  | 'fetching_content'
  | 'generating_draft_estimated'
  | 'polishing_estimated'
  | 'validating_saving_estimated'
  | 'success'
  | 'error';

type TimelineStatus = 'pending' | 'active' | 'done' | 'error';

interface ApiErrorShape {
  response?: {
    data?: GeneratePlanErrorResponse | { error?: string };
  };
  message?: string;
}

const TIMELINE_STEPS = [
  'استرجاع محتوى الدرس',
  'توليد المسودة الأولية',
  'تحسين الخطة تربويًا',
  'التحقق من عرض الخطة وتنسيقها',
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
        return typeof maybeMessage === 'string' &&
          maybeMessage.trim().length > 0
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

    if (
      typeof parsed.message === 'string' &&
      parsed.message.trim().length > 0
    ) {
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
  const subjectsRequestIdRef = useRef(0);
  const timelineTimersRef = useRef<number[]>([]);

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [selectedClassBaseKey, setSelectedClassBaseKey] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');
  const [selectedUnitId, setSelectedUnitId] = useState<SelectValue>('');
  const [selectedLessonId, setSelectedLessonId] = useState<SelectValue>('');
  const [selectedPeriodOrder, setSelectedPeriodOrder] = useState('');

  const [planType, setPlanType] = useState<PlanType>(
    () => user?.profile?.default_plan_type ?? 'traditional'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(() => {
    const profileDuration =
      user?.profile?.default_lesson_duration_minutes ?? 45;
    return LESSON_DURATION_OPTIONS.includes(
      profileDuration as (typeof LESSON_DURATION_OPTIONS)[number]
    )
      ? profileDuration
      : 45;
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [generationState, setGenerationState] =
    useState<GenerationState>('idle');
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);

  const [generatedPlan, setGeneratedPlan] =
    useState<GeneratedPlanResponse | null>(null);
  const [queuedPlanNotice, setQueuedPlanNotice] = useState<string | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [screen, setScreen] = useState<LessonCreatorScreen>('creator');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  const defaultDurationMinutes =
    user?.profile?.default_lesson_duration_minutes ?? 45;
  const defaultPlanType = user?.profile?.default_plan_type ?? 'traditional';

  const resetGeneratedState = () => {
    clearTimelineTimers();
    setGeneratedPlan(null);
    setQueuedPlanNotice(null);
    setGenerationError(null);
    setGenerationState('idle');
    setActiveTimelineIndex(0);
    setIsEditingPlan(false);
    setPlanDraft(null);
    setIsExportModalOpen(false);
    setIsExportingPlan(false);
    setDeleteConfirmOpen(false);
    setIsProgressModalOpen(false);
  };

  const resetCreatorForm = () => {
    setSelectedClassId('');
    setSelectedClassBaseKey('');
    setSelectedSubjectId('');
    setSelectedUnitId('');
    setSelectedLessonId('');
    setSelectedPeriodOrder('');
    setUnits([]);
    setLessons([]);
    setSubjects([]);
    setPlanType(defaultPlanType);
    setDurationMinutes(
      LESSON_DURATION_OPTIONS.includes(
        defaultDurationMinutes as (typeof LESSON_DURATION_OPTIONS)[number]
      )
        ? defaultDurationMinutes
        : 45
    );
    setPageError(null);
    setGenerationError(null);
    setScreen('creator');
  };

  useEffect(() => {
    if (!user) {
      navigate('/authentication');
      return;
    }

    if (user.userRole !== 'teacher' && user.userRole !== 'admin') {
      navigate('/authentication', { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (user?.userRole !== 'teacher' && user?.userRole !== 'admin') {
      return;
    }

    let cancelled = false;

    const loadInitialData = async () => {
      setInitialLoading(true);
      setPageError(null);

      try {
        const classesLoader =
          user.userRole === 'admin' ? getAllClasses : getMyClasses;
        const classesResponse = await classesLoader();

        if (cancelled) {
          return;
        }

        setClasses(classesResponse.classes ?? []);
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
    if (selectedClassId === '') {
      subjectsRequestIdRef.current += 1;
      setSubjects([]);
      setSubjectsLoading(false);
      return;
    }

    const requestId = ++subjectsRequestIdRef.current;
    setSubjectsLoading(true);
    setPageError(null);

    getSubjectsByClass(selectedClassId)
      .then((response) => {
        if (requestId !== subjectsRequestIdRef.current) {
          return;
        }
        setSubjects(response.subjects ?? []);
      })
      .catch((error: unknown) => {
        if (requestId !== subjectsRequestIdRef.current) {
          return;
        }
        setPageError(
          getErrorMessage(error, 'فشل تحميل المواد المرتبطة بالصف المختار.')
        );
      })
      .finally(() => {
        if (requestId === subjectsRequestIdRef.current) {
          setSubjectsLoading(false);
        }
      });
  }, [selectedClassId]);

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
        setPageError(
          getErrorMessage(error, 'فشل تحميل وحدات المادة المختارة.')
        );
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

  useEffect(() => {
    if (pageError) {
      toast.error(pageError);
    }
  }, [pageError]);

  useEffect(() => {
    if (generationError) {
      toast.error(generationError);
    }
  }, [generationError]);

  const subjectsForSelectedClass = useMemo(() => {
    if (selectedClassId === '') {
      return [];
    }

    const selectedClassIdNumber = Number(selectedClassId);
    if (Number.isNaN(selectedClassIdNumber)) {
      return [];
    }

    return subjects.filter(
      (subjectItem) => Number(subjectItem.class_id) === selectedClassIdNumber
    );
  }, [selectedClassId, subjects]);

  const selectedClass = useMemo(
    () =>
      classes.find((item) => Number(item.id) === Number(selectedClassId)) ??
      null,
    [classes, selectedClassId]
  );

  const classGroups = useMemo(() => {
    const grouped = new Map<string, { baseClass: Class; sections: Class[] }>();

    classes.forEach((classItem) => {
      const baseKey = getClassBaseKey(classItem);
      const current = grouped.get(baseKey);
      if (current) {
        current.sections.push(classItem);
        return;
      }

      grouped.set(baseKey, {
        baseClass: classItem,
        sections: [classItem],
      });
    });

    return Array.from(grouped.entries())
      .map(([key, group]) => ({
        key,
        baseClass: group.baseClass,
        sections: [...group.sections].sort((left, right) =>
          getClassSectionLabel(left).localeCompare(
            getClassSectionLabel(right),
            'ar'
          )
        ),
      }))
      .sort((left, right) =>
        formatClassBaseSelectLabel(left.baseClass).localeCompare(
          formatClassBaseSelectLabel(right.baseClass),
          'ar'
        )
      );
  }, [classes]);

  const selectedClassSections = useMemo(() => {
    if (selectedClassBaseKey === '') {
      return [];
    }

    return (
      classGroups.find((group) => group.key === selectedClassBaseKey)
        ?.sections ?? []
    );
  }, [classGroups, selectedClassBaseKey]);

  const selectedSubject = useMemo(
    () =>
      subjectsForSelectedClass.find(
        (item) => Number(item.id) === Number(selectedSubjectId)
      ) ?? null,
    [selectedSubjectId, subjectsForSelectedClass]
  );

  const selectedUnit = useMemo(
    () =>
      units.find((item) => Number(item.id) === Number(selectedUnitId)) ?? null,
    [selectedUnitId, units]
  );

  const selectedLesson = useMemo(
    () =>
      lessons.find((item) => Number(item.id) === Number(selectedLessonId)) ??
      null,
    [selectedLessonId, lessons]
  );

  const canGenerate =
    selectedClassId !== '' &&
    selectedSubjectId !== '' &&
    selectedUnitId !== '' &&
    selectedLessonId !== '' &&
    selectedPeriodOrder !== '' &&
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

  const dismissProgressModal = () => {
    if (isGenerating) {
      return;
    }
    setIsProgressModalOpen(false);
  };

  const handleClassSelect = (value: string) => {
    setSelectedClassBaseKey(value);
    setSelectedClassId('');
    setSelectedSubjectId('');
    setSelectedUnitId('');
    setSelectedLessonId('');
    setSelectedPeriodOrder('');
    setUnits([]);
    setLessons([]);

    setPageError(null);
    setGenerationError(null);
    setScreen('creator');
  };

  const handleSectionSelect = (value: string) => {
    const nextClassId = value ? Number(value) : '';
    const nextClass = classes.find((classItem) => classItem.id === nextClassId);

    setSelectedClassId(nextClassId);
    setSelectedClassBaseKey(
      nextClass ? getClassBaseKey(nextClass) : selectedClassBaseKey
    );
    setSelectedSubjectId('');
    setSelectedUnitId('');
    setSelectedLessonId('');
    setSelectedPeriodOrder('');
    setUnits([]);
    setLessons([]);

    setPageError(null);
    setGenerationError(null);
    setScreen('creator');
  };

  const handleSubjectSelect = (value: string) => {
    const nextSubjectId = value ? Number(value) : '';
    setSelectedSubjectId(nextSubjectId);
    setSelectedUnitId('');
    setSelectedLessonId('');
    setLessons([]);
    setPageError(null);
    setGenerationError(null);
    setScreen('creator');
  };

  const handleUnitSelect = (value: string) => {
    const nextUnitId = value ? Number(value) : '';
    setSelectedUnitId(nextUnitId);
    setSelectedLessonId('');
    setPageError(null);
    setGenerationError(null);
    setScreen('creator');
  };

  const handleLessonSelect = (value: string) => {
    const nextLessonId = value ? Number(value) : '';
    setSelectedLessonId(nextLessonId);
    setGenerationError(null);
    setScreen('creator');
  };

  const handleClearCreator = () => {
    resetGeneratedState();
    resetCreatorForm();
  };

  const handleGeneratePlan = async () => {
    if (!canGenerate || !selectedClass || !selectedSubject || !selectedUnit) {
      return;
    }

    setPageError(null);
    setGenerationError(null);
    setGeneratedPlan(null);
    setQueuedPlanNotice(null);
    setIsGenerating(true);
    setIsProgressModalOpen(true);
    setGenerationState('fetching_content');
    setActiveTimelineIndex(0);

    try {
      const lessonResponse = await getLessonById(Number(selectedLessonId));
      const lesson = lessonResponse.lesson;
      const lessonContent = lesson?.content?.trim();

      if (!lessonContent) {
        throw new Error('لا يمكن توليد الخطة لأن محتوى الدرس فارغ.');
      }

      const lessonTitle =
        lesson?.name?.trim() || selectedLesson?.name?.trim() || '';
      const subjectName = selectedSubject.name?.trim() || '';
      const rawUnitName = selectedUnit.name?.trim() || '';
      const unitName = formatUnitOrdinalText(rawUnitName);
      const gradeValue = selectedClass.grade_label?.trim() || '';
      const classLabel = [
        selectedClass.grade_label,
        selectedClass.section_label,
      ]
        .map((value) => value?.trim() ?? '')
        .filter(Boolean)
        .join(' - ');
      const safeDurationMinutes = Number(durationMinutes);

      if (!lessonTitle) {
        throw new Error('تعذر تحديد عنوان الدرس للتوليد.');
      }
      if (!subjectName) {
        throw new Error('تعذر تحديد اسم المادة للتوليد.');
      }
      if (!rawUnitName) {
        throw new Error('تعذر تحديد اسم الوحدة للتوليد.');
      }
      if (!gradeValue) {
        throw new Error('يرجى تحديد صف قبل التوليد.');
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
        period_order: selectedPeriodOrder,
        preparation_type: user?.profile?.preparation_type ?? null,
        class_id: selectedClass.id,
        class_name: classLabel || undefined,
        section_label: selectedClass.section_label,
        section: selectedClass.section,
      });

      clearTimelineTimers();
      if ('queued' in generated && generated.queued) {
        setQueuedPlanNotice(generated.message);
        setGenerationState('idle');
        setActiveTimelineIndex(0);
        setGeneratedPlan(null);
        setIsProgressModalOpen(false);
        setScreen('creator');
      } else {
        setGeneratedPlan(generated as GeneratedPlanResponse);
        setGenerationState('success');
        setActiveTimelineIndex(3);
        setPlanDraft(null);
        setIsEditingPlan(false);
        clearTimelineTimers();
        timelineTimersRef.current = [
          window.setTimeout(() => {
            setIsProgressModalOpen(false);
            setScreen('confirmation');
          }, 900),
        ];
        toast.success('تم توليد الخطة وحفظها بنجاح.');
      }
    } catch (error: unknown) {
      clearTimelineTimers();
      setGenerationState('error');
      setGenerationError(
        getErrorMessage(
          error,
          'فشل توليد الخطة. تحقق من البيانات وحاول مجددًا.'
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const buildPlanDraftFromGenerated = (
    plan: GeneratedPlanResponse
  ): PlanDraft => {
    const header =
      plan.plan_json?.header &&
      typeof plan.plan_json.header === 'object' &&
      !Array.isArray(plan.plan_json.header)
        ? (plan.plan_json.header as Record<string, unknown>)
        : {};
    const lessonTitle =
      typeof header.lesson_title === 'string'
        ? header.lesson_title
        : (selectedLesson?.name ?? '');
    return {
      lessonTitle,
      planJson: JSON.parse(JSON.stringify(plan.plan_json ?? {})),
    };
  };

  const handleStartEditingPlan = () => {
    if (!generatedPlan) return;
    setPlanDraft(buildPlanDraftFromGenerated(generatedPlan));
    setIsEditingPlan(true);
    setScreen('generated');
  };

  const handleCancelEditingPlan = () => {
    setIsEditingPlan(false);
    setPlanDraft(null);
    setScreen('generated');
  };

  const handleSavePlan = async () => {
    if (!generatedPlan?.id || isSavingPlan) return;
    setIsSavingPlan(true);
    try {
      if (isEditingPlan && planDraft) {
        const nextPlanJson = JSON.parse(JSON.stringify(planDraft.planJson));
        const header =
          nextPlanJson.header &&
          typeof nextPlanJson.header === 'object' &&
          !Array.isArray(nextPlanJson.header)
            ? (nextPlanJson.header as Record<string, unknown>)
            : {};
        nextPlanJson.header = {
          ...header,
          lesson_title: planDraft.lessonTitle,
        };

        const response = await updatePlan(generatedPlan.id, {
          lesson_title: planDraft.lessonTitle,
          plan_json: nextPlanJson,
        });
        const updated = response.plan;
        setGeneratedPlan((prev) =>
          prev
            ? {
                ...prev,
                plan_json: updated.plan_json ?? prev.plan_json,
              }
            : null
        );
      }
      setIsEditingPlan(false);
      setPlanDraft(null);
      setScreen('confirmation');
      toast.success('تم حفظ الخطة بنجاح.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'فشل حفظ الخطة.'));
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleExportPlan = async (format: 'pdf' | 'docx') => {
    if (!generatedPlan?.id) {
      return;
    }

    setIsExportingPlan(true);
    try {
      const { exportPlan } = await import('./lesson-creator.services');
      await exportPlan(generatedPlan.id, format);
      toast.success('تم تصدير الخطة بنجاح.');
      setIsExportModalOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'فشل تصدير الخطة.'));
    } finally {
      setIsExportingPlan(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!generatedPlan?.id) {
      return;
    }

    setIsDeletingPlan(true);
    try {
      await deletePlanById(generatedPlan.id);
      toast.success('تم حذف الخطة بنجاح.');
      resetGeneratedState();
      resetCreatorForm();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'فشل حذف الخطة.'));
    } finally {
      setIsDeletingPlan(false);
      setDeleteConfirmOpen(false);
    }
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
    setScreen('generated');
  };

  const handleCreateNewPlan = () => {
    resetGeneratedState();
    resetCreatorForm();
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
      return 'جارٍ التحقق من عرض الخطة وتنسيقها...';
    }

    if (generationState === 'success') {
      return 'تم توليد الخطة وحفظها بنجاح.';
    }

    if (generationState === 'error') {
      return generationError ?? 'تعذر إكمال العملية.';
    }

    return 'اختر بيانات الدرس واضغط على إنشاء.';
  })();

  const generatedLessonTitle = (() => {
    const header = generatedPlan?.plan_json?.header;
    const headerRecord =
      header && typeof header === 'object' && !Array.isArray(header)
        ? (header as Record<string, unknown>)
        : null;
    const headerTitle =
      headerRecord && typeof headerRecord.lesson_title === 'string'
        ? headerRecord.lesson_title.trim()
        : '';

    return (
      planDraft?.lessonTitle?.trim() ||
      headerTitle ||
      selectedLesson?.name?.trim() ||
      'خطة الدرس'
    );
  })();

  if (user?.userRole !== 'teacher' && user?.userRole !== 'admin') {
    return null;
  }

  if (initialLoading) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="lcp ui-loaded">
      <header className="lcp__header page-header">
        <div>
          <nav className="lcp__breadcrumb" aria-label="breadcrumb">
            <Link to="/">الرئيسية</Link>
            <span>←</span>
            <span className="lcp__breadcrumb-current">خطط الدروس</span>
          </nav>
          <h1>مساحة إنشاء خطة الدرس</h1>
          <p>تجهيز خطة درس ذكية من محتوى درس محفوظ لديك في النظام.</p>
        </div>
      </header>

      {pageError ? (
        <p className="ui-inline-notice ui-inline-notice--error" role="alert">
          {pageError}
        </p>
      ) : null}

      {generationError ? (
        <p className="ui-inline-notice ui-inline-notice--error" role="alert">
          {generationError}
        </p>
      ) : null}

      {screen === 'creator' ? (
        <>
          {queuedPlanNotice ? (
            <p className="ui-inline-notice ui-inline-notice--warning">
              {queuedPlanNotice}
            </p>
          ) : null}

          <section className="lcp__classic-wrap" aria-live="polite">
            <article className="lcp__classic-card">
              <h2>إنشاء خطة درس</h2>

              <ol className="lcp__classic-list">
                <li className="lcp__classic-row">
                  <label htmlFor="lcp-class-select">حدد الصف</label>
                  <select
                    id="lcp-class-select"
                    value={selectedClassBaseKey}
                    onChange={(event) => handleClassSelect(event.target.value)}
                    disabled={initialLoading || isGenerating}
                  >
                    <option value="">اختر الصف...</option>
                    {classGroups.map((group) => (
                      <option key={group.key} value={group.key}>
                        {formatClassBaseSelectLabel(group.baseClass)}
                      </option>
                    ))}
                  </select>
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-section-select">حدد الشعبة</label>
                  <select
                    id="lcp-section-select"
                    value={selectedClassId}
                    onChange={(event) =>
                      handleSectionSelect(event.target.value)
                    }
                    disabled={
                      selectedClassBaseKey === '' ||
                      isGenerating ||
                      selectedClassSections.length === 0
                    }
                  >
                    <option value="">اختر الشعبة...</option>
                    {selectedClassSections.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {getClassSectionLabel(classItem)}
                      </option>
                    ))}
                  </select>
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-subject-select">حدد المادة</label>
                  <select
                    id="lcp-subject-select"
                    value={selectedSubjectId}
                    onChange={(event) =>
                      handleSubjectSelect(event.target.value)
                    }
                    disabled={
                      selectedClassId === '' || subjectsLoading || isGenerating
                    }
                  >
                    <option value="">اختر المادة...</option>
                    {subjectsForSelectedClass.map((subjectItem) => (
                      <option key={subjectItem.id} value={subjectItem.id}>
                        {subjectItem.name}
                      </option>
                    ))}
                  </select>
                  {subjectsLoading ? (
                    <small className="lcp__classic-note-muted">
                      جارٍ تحميل المواد...
                    </small>
                  ) : null}
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-unit-select">حدد الوحدة</label>
                  <select
                    id="lcp-unit-select"
                    value={selectedUnitId}
                    onChange={(event) => handleUnitSelect(event.target.value)}
                    disabled={
                      selectedSubjectId === '' || unitsLoading || isGenerating
                    }
                  >
                    <option value="">اختر الوحدة...</option>
                    {units.map((unitItem) => (
                      <option key={unitItem.id} value={unitItem.id}>
                        {formatUnitDisplayLabel(unitItem.name)}
                      </option>
                    ))}
                  </select>
                  {unitsLoading ? (
                    <small className="lcp__classic-note-muted">
                      جارٍ تحميل وحدات المادة...
                    </small>
                  ) : null}
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-lesson-select">حدد عنوان الدرس</label>
                  <select
                    id="lcp-lesson-select"
                    value={selectedLessonId}
                    onChange={(event) => handleLessonSelect(event.target.value)}
                    disabled={
                      selectedUnitId === '' || lessonsLoading || isGenerating
                    }
                  >
                    <option value="">اختر الدرس...</option>
                    {lessons.map((lessonItem) => (
                      <option key={lessonItem.id} value={lessonItem.id}>
                        {lessonItem.name}
                      </option>
                    ))}
                  </select>
                  {lessonsLoading ? (
                    <small className="lcp__classic-note-muted">
                      جارٍ تحميل دروس الوحدة...
                    </small>
                  ) : null}
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-duration">المدة الزمنية للحصة</label>
                  <select
                    id="lcp-duration"
                    value={durationMinutes}
                    onChange={(event) => {
                      setDurationMinutes(Number(event.target.value));
                    }}
                    disabled={selectedLessonId === '' || isGenerating}
                  >
                    {LESSON_DURATION_OPTIONS.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} دقيقة
                      </option>
                    ))}
                  </select>
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-period-order">ترتيب الحصة</label>
                  <select
                    id="lcp-period-order"
                    value={selectedPeriodOrder}
                    onChange={(event) =>
                      setSelectedPeriodOrder(event.target.value)
                    }
                    disabled={selectedLessonId === '' || isGenerating}
                  >
                    <option value="">اختر ترتيب الحصة...</option>
                    {PERIOD_OPTIONS.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                </li>

                <li className="lcp__classic-row">
                  <label htmlFor="lcp-plan-type">نوع الخطة</label>
                  <select
                    id="lcp-plan-type"
                    value={planType}
                    onChange={(event) =>
                      setPlanType(event.target.value as PlanType)
                    }
                    disabled={selectedLessonId === '' || isGenerating}
                  >
                    {PLAN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </li>
              </ol>

              <div className="lcp__classic-actions">
                <button
                  type="button"
                  className="lcp__generate-btn"
                  onClick={() => void handleGeneratePlan()}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <>
                      <span className="ui-button-spinner" aria-hidden />
                      جارٍ إنشاء الخطة...
                    </>
                  ) : generationState === 'error' ? (
                    'إعادة إنشاء'
                  ) : (
                    'إنشاء'
                  )}
                </button>

                <button
                  type="button"
                  className="lcp__clear-btn"
                  onClick={handleClearCreator}
                  disabled={isGenerating}
                >
                  مسح
                </button>
              </div>
            </article>
          </section>
        </>
      ) : screen === 'generated' && generatedPlan ? (
        <section className="lcp__generated-view" aria-live="polite">
          <header className="lcp__generated-head">
            <h2>{generatedLessonTitle}</h2>
            <p>
              {toPlanTypeLabel(generatedPlan.plan_type)} |{' '}
              {toValidationStatusLabel(generatedPlan.validation_status)} | إعادة
              التحسين: {generatedPlan.retry_occurred ? 'نعم' : 'لا'}
            </p>
          </header>

          <article className="lcp__plan-card">
            <div className="lcp__plan-banner" role="status">
              <MdCheckCircle aria-hidden />
              <span>تم إنشاء الخطة بنجاح | رقم الخطة: #{generatedPlan.id}</span>
            </div>

            <div className="lcp__plan-actions">
              <button
                type="button"
                className="lcp__btn-save"
                onClick={() => void handleSavePlan()}
                disabled={isSavingPlan}
              >
                {isSavingPlan && (
                  <span className="ui-button-spinner" aria-hidden />
                )}
                <MdSave aria-hidden />
                حفظ
              </button>
              {!isEditingPlan ? (
                <button
                  type="button"
                  className="lcp__btn-edit"
                  onClick={handleStartEditingPlan}
                >
                  <MdEdit aria-hidden />
                  تعديل
                </button>
              ) : (
                <button
                  type="button"
                  className="lcp__btn-cancel"
                  onClick={handleCancelEditingPlan}
                  disabled={isSavingPlan}
                >
                  <MdClose aria-hidden />
                  إلغاء
                </button>
              )}
              <button
                type="button"
                className="lcp__btn-edit"
                onClick={() => setIsExportModalOpen(true)}
                disabled={!generatedPlan || isExportingPlan}
              >
                تصدير
              </button>
            </div>

            <LessonPlanDocumentView
              planType={generatedPlan.plan_type}
              planJson={planDraft?.planJson ?? generatedPlan.plan_json}
              mode={isEditingPlan ? 'edit' : 'view'}
              lessonTitle={generatedLessonTitle}
              onLessonTitleChange={
                planDraft
                  ? (value) =>
                      setPlanDraft((draft) =>
                        draft ? { ...draft, lessonTitle: value } : draft
                      )
                  : undefined
              }
              onPlanJsonChange={
                planDraft
                  ? (value) =>
                      setPlanDraft((draft) =>
                        draft ? { ...draft, planJson: value } : draft
                      )
                  : undefined
              }
                fallback={{
                  lessonTitle: selectedLesson?.name,
                  subject: selectedSubject?.name,
                  grade: selectedClass?.grade_label,
                  section: selectedClass?.section_label,
                  unit: formatUnitOrdinalText(selectedUnit?.name ?? ''),
                  durationMinutes,
                }}
              />
          </article>

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
                unit: formatUnitOrdinalText(selectedUnit?.name ?? ''),
                duration_minutes: durationMinutes,
                plan_json: generatedPlan.plan_json,
              }}
              targetSelectors={getRefinementTargetOptions('lesson_plan')}
              onCommitted={handleRefinementCommitted}
            />
          </section>
        </section>
      ) : (
        <section className="lcp__confirmation-view" aria-live="polite">
          <div className="lcp__confirmation-card">
            <h2>تم إنشاء خطة الدرس بنجاح ✓</h2>
            <article className="lcp__confirmation-panel">
              <h3>{generatedLessonTitle}</h3>
              <p>
                الوحدة الأولى | {selectedSubject?.name ?? '—'} | الصف:{' '}
                {selectedClass?.grade_label ?? '—'} | الفصل:{' '}
                {normalizeSemesterLabel(selectedClass?.semester)} |{' '}
                {normalizeAcademicYearLabel(selectedClass?.academic_year) ||
                  '—'}{' '}
                | {toPlanTypeLabel(generatedPlan?.plan_type ?? planType)} |
                المدة: {durationMinutes} د
              </p>

              <div className="lcp__confirmation-actions">
                <button
                  type="button"
                  className="lcp__btn-save"
                  onClick={() => {
                    if (generatedPlan?.id) {
                      navigate(`/plans/${generatedPlan.id}`);
                    }
                  }}
                >
                  عرض
                </button>
                <button
                  type="button"
                  className="lcp__btn-cancel"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isDeletingPlan}
                >
                  حذف
                </button>
                <button
                  type="button"
                  className="lcp__btn-edit"
                  onClick={handleCreateNewPlan}
                >
                  إنشاء خطة جديدة
                </button>
                <button
                  type="button"
                  className="lcp__btn-edit"
                  onClick={() => navigate('/plans')}
                >
                  مكتبة الخطط
                </button>
              </div>
            </article>
          </div>
        </section>
      )}

      {isProgressModalOpen
        ? createPortal(
            <div
              className="lcp__progress-backdrop"
              role="presentation"
              onClick={dismissProgressModal}
            >
              <section
                className="lcp__progress-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lcp-progress-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="lcp__timeline-head">
                  <h2 id="lcp-progress-title">
                    <MdViewTimeline aria-hidden />
                    حالة التنفيذ
                  </h2>
                  {isGenerating ? (
                    <span className="lcp__timeline-badge">
                      <MdHourglassTop aria-hidden />
                      جارٍ التنفيذ
                    </span>
                  ) : null}
                  {generationState === 'success' ? (
                    <span className="lcp__timeline-badge lcp__timeline-badge--success">
                      <MdCheckCircle aria-hidden />
                      اكتمل
                    </span>
                  ) : null}
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

                {generationState === 'error' ? (
                  <div className="lcp__progress-actions">
                    <button
                      type="button"
                      className="lcp__generate-btn"
                      onClick={() => void handleGeneratePlan()}
                      disabled={!canGenerate || isGenerating}
                    >
                      إعادة المحاولة
                    </button>
                    <button
                      type="button"
                      className="lcp__clear-btn"
                      onClick={dismissProgressModal}
                      disabled={isGenerating}
                    >
                      إغلاق
                    </button>
                  </div>
                ) : null}
              </section>
            </div>,
            document.body
          )
        : null}

      <ExportFormatModal
        isOpen={isExportModalOpen}
        title="تصدير خطة الدرس"
        onClose={() => setIsExportModalOpen(false)}
        isSubmitting={isExportingPlan}
        onConfirm={({ format }) => void handleExportPlan(format)}
      />

      <ConfirmActionModal
        isOpen={deleteConfirmOpen}
        title="تأكيد حذف الخطة"
        message="سيتم حذف الخطة نهائيًا من المكتبة. لا يمكن التراجع بعد الحذف."
        endpoint={
          generatedPlan?.id ? `/api/plans/${generatedPlan.id}` : '/api/plans'
        }
        payload={generatedPlan?.id ? { planId: generatedPlan.id } : undefined}
        isLoading={isDeletingPlan}
        confirmLabel="حذف الخطة"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await handleDeletePlan();
        }}
      />
    </div>
  );
}

export default LessonCreator;
