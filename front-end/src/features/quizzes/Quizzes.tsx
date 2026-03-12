import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';
import {
  MdAutoAwesome,
  MdClose,
  MdContentCopy,
  MdDelete,
  MdEdit,
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdQuiz,
  MdRefresh,
  MdSave,
  MdWhatsapp,
} from 'react-icons/md';
import { SyncStatusBadge } from '../../components/common/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';
import type { Class, Exam, ExamQuestion, Lesson, Subject, Unit } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
import { shareDocumentWithWhatsApp } from '../../utils/whatsapp';
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts';
import { useOffline } from '../../offline/useOffline';
import { isLocalOnlyId } from '../../offline/utils';
import type { OfflineExamRecord } from '../../offline/types';
import {
  deleteExamById,
  duplicateExam,
  exportExam,
  getExamExportBlob,
  shareExam,
  generateExam,
  getAllClasses,
  getAllSubjects,
  getExamById,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  listExams,
  updateExam,
} from './quizzes.services';
import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import WhatsAppExportModal from '../../components/common/WhatsAppExportModal';
import './quizzes.css';

type SelectValue = number | '';

interface LessonOption extends Lesson {
  unit_name: string;
}

interface ExamDraft {
  title: string;
  questions: ExamQuestion[];
}

function formatDateTimeAr(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function autoTitle(subjectName: string): string {
  const date = new Date().toLocaleDateString('ar-SA');
  return `اختبار ${subjectName} - ${date}`;
}

function isQuarterStepMark(value: number): boolean {
  const scaled = value * 4;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function cloneExamQuestion(question: ExamQuestion): ExamQuestion {
  const nextQuestion: ExamQuestion = {
    ...question,
    options: question.options ? [...question.options] : undefined,
    rubric: question.rubric ? [...question.rubric] : undefined,
  };

  if (nextQuestion.question_type === 'multiple_choice' && !nextQuestion.options) {
    nextQuestion.options = ['', '', '', ''];
  }

  if (nextQuestion.question_type === 'open_ended' && !nextQuestion.rubric) {
    nextQuestion.rubric = [];
  }

  return nextQuestion;
}

function createExamDraft(exam: Exam): ExamDraft {
  return {
    title: exam.title,
    questions: (exam.questions ?? []).map(cloneExamQuestion),
  };
}

function joinLines(lines: string[] | undefined): string {
  return (lines ?? []).join('\n');
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function Quizzes() {
  const { user } = useAuth();
  const { lastSyncAt } = useOffline();
  const isAdmin = user?.userRole === 'admin';
  const isTeacher = user?.userRole === 'teacher';

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [examTitle, setExamTitle] = useState('');
  const [isTitleTouched, setIsTitleTouched] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [totalMarks, setTotalMarks] = useState<number>(20);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);

  const [filterSubjectId, setFilterSubjectId] = useState<SelectValue>('');
  const [filterClassId, setFilterClassId] = useState<SelectValue>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [exams, setExams] = useState<OfflineExamRecord[]>([]);
  const [selectedExam, setSelectedExam] = useState<OfflineExamRecord | null>(null);

  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isLessonsLoading, setIsLessonsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [deleteExamRequest, setDeleteExamRequest] = useState<{
    examId: string;
    endpoint: string;
    payload: Record<string, unknown>;
  } | null>(null);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [whatsAppExportOpen, setWhatsAppExportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState<ExamDraft | null>(null);
  const [draftRecoveredNotice, setDraftRecoveredNotice] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setIsListLoading(true);
    try {
      const response = await listExams({
        subject_id: filterSubjectId === '' ? undefined : filterSubjectId,
        class_id: filterClassId === '' ? undefined : filterClassId,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setExams((response.exams ?? []) as OfflineExamRecord[]);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل قائمة الاختبارات.'));
    } finally {
      setIsListLoading(false);
    }
  }, [filterClassId, filterDateFrom, filterDateTo, filterSubjectId]);

  useEffect(() => {
    if (!lastSyncAt || isEditingExam) {
      return;
    }

    void loadExams();
  }, [isEditingExam, lastSyncAt, loadExams]);

  useEffect(() => {
    if (!isTeacher && !isAdmin) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setIsBootLoading(true);
      setError(null);
      try {
        const classesLoader = isAdmin ? getAllClasses : getMyClasses;
        const subjectsLoader = isAdmin ? getAllSubjects : getMySubjects;
        const [classesResponse, subjectsResponse] = await Promise.all([
          classesLoader(),
          subjectsLoader(),
        ]);

        if (cancelled) {
          return;
        }

        setClasses(classesResponse.classes ?? []);
        setSubjects(subjectsResponse.subjects ?? []);
      } catch (bootstrapError: unknown) {
        if (!cancelled) {
          setError(normalizeApiError(bootstrapError, 'فشل تحميل بيانات الاختبارات.'));
        }
      } finally {
        if (!cancelled) {
          setIsBootLoading(false);
        }
      }
    };

    void bootstrap();
    void loadExams();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, isTeacher, loadExams]);

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
    if (!selectedExam) {
      setIsEditingExam(false);
      setIsSavingExam(false);
      setExamDraft(null);
      setDraftRecoveredNotice(null);
      return;
    }

    setIsEditingExam(false);
    setIsSavingExam(false);
    setExamDraft(createExamDraft(selectedExam));
    setDraftRecoveredNotice(null);
  }, [selectedExam]);

  useEffect(() => {
    if (!selectedExam) {
      return;
    }

    let cancelled = false;

    getDraft<ExamDraft>('quizzes', selectedExam.local_id)
      .then((draft) => {
        if (!draft || cancelled) {
          return;
        }

        if (draft.updated_at > selectedExam.updated_at) {
          setExamDraft(draft.payload);
          setIsEditingExam(true);
          setDraftRecoveredNotice('تمت استعادة مسودة الاختبار المحلية.');
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      cancelled = true;
    };
  }, [selectedExam]);

  useEffect(() => {
    if (!isEditingExam || !examDraft || !selectedExam) {
      return;
    }

    const persistDraft = () =>
      saveDraft({
        entityType: 'exam',
        recordLocalId: selectedExam.local_id,
        routeKey: 'quizzes',
        payload: examDraft,
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
  }, [examDraft, isEditingExam, selectedExam]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

  const classesById = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const subjectsById = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  const lessonIdsArray = useMemo(() => {
    const selected = selectedLessonIds;
    return lessonOptions
      .filter((lesson) => selected.has(lesson.id))
      .map((lesson) => lesson.id);
  }, [lessonOptions, selectedLessonIds]);

  const groupedLessons = useMemo(() => {
    const byUnitId = new Map<number, LessonOption[]>();
    for (const lesson of lessonOptions) {
      const existing = byUnitId.get(lesson.unit_id) ?? [];
      existing.push(lesson);
      byUnitId.set(lesson.unit_id, existing);
    }
    return units.map((unit) => ({
      unit,
      lessons: byUnitId.get(unit.id) ?? [],
    }));
  }, [lessonOptions, units]);

  const handleSubjectChange = async (value: string) => {
    const nextSubjectId = value ? Number(value) : '';
    setSelectedSubjectId(nextSubjectId);
    setSelectedLessonIds(new Set());
    setUnits([]);
    setLessonOptions([]);
    setError(null);
    setSuccessMessage(null);

    if (nextSubjectId === '') {
      return;
    }

    const subject = subjects.find((subjectItem) => subjectItem.id === nextSubjectId);
    if (subject && !isTitleTouched) {
      setExamTitle(autoTitle(subject.name));
    }

    setIsLessonsLoading(true);
    try {
      const unitsResponse = await getUnitsBySubject(nextSubjectId);
      const fetchedUnits = unitsResponse.units ?? [];
      setUnits(fetchedUnits);

      const lessonResponses = await Promise.all(
        fetchedUnits.map(async (unitItem) => {
          const response = await getLessonsByUnit(unitItem.id);
          return {
            unit: unitItem,
            lessons: response.lessons ?? [],
          };
        })
      );

      const nextLessons: LessonOption[] = [];
      lessonResponses.forEach(({ unit, lessons }) => {
        lessons.forEach((lesson) => {
          nextLessons.push({
            ...lesson,
            unit_name: unit.name,
          });
        });
      });

      setLessonOptions(nextLessons);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل دروس المادة المختارة.'));
    } finally {
      setIsLessonsLoading(false);
    }
  };

  const toggleLessonSelection = (lessonId: number) => {
    setSelectedLessonIds((previous) => {
      const next = new Set(previous);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const handleGenerateExam = async () => {
    if (!isTeacher) {
      return;
    }

    if (selectedSubjectId === '') {
      setError({ message: 'اختر مادة أولاً.' });
      return;
    }

    if (lessonIdsArray.length < 1) {
      setError({ message: 'اختر درساً واحداً على الأقل.' });
      return;
    }

    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      setError({ message: 'عدد الأسئلة يجب أن يكون رقمًا صحيحًا موجبًا.' });
      return;
    }

    if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
      setError({ message: 'الدرجة الكلية يجب أن تكون رقمًا موجبًا.' });
      return;
    }
    if (!isQuarterStepMark(totalMarks)) {
      setError({ message: 'الدرجة الكلية يجب أن تكون بمضاعفات 0.25 مثل 1 أو 1.25 أو 1.5.' });
      return;
    }
    if (totalMarks * 4 < totalQuestions) {
      setError({ message: 'يجب توفير 0.25 درجة على الأقل لكل سؤال.' });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      setError({ message: 'زمن الاختبار يجب أن يكون رقماً صحيحاً موجباً (دقيقة).' });
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await generateExam({
        subject_id: selectedSubjectId,
        lesson_ids: lessonIdsArray,
        total_questions: totalQuestions,
        total_marks: totalMarks,
        duration_minutes: durationMinutes,
        title: examTitle.trim() || undefined,
      });

      if ('queued' in response && response.queued) {
        setSuccessMessage(response.message);
      } else {
        setSelectedExam((response as { exam: Exam }).exam as OfflineExamRecord);
        setSuccessMessage('تم توليد الاختبار وحفظه بنجاح.');
        await loadExams();
      }
    } catch (generationError: unknown) {
      setError(
        normalizeApiError(
          generationError,
          'تعذر توليد الاختبار. تأكد أن الدروس المختارة تحتوي على خطط درس مولدة وأهداف تعلم.'
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadExamDetails = async (examId: string) => {
    if (isEditingExam) {
      toast.error('احفظ تعديلات الاختبار الحالي أو ألغها قبل فتح اختبار آخر.');
      return;
    }

    setIsExamLoading(true);
    setError(null);
    try {
      const response = await getExamById(examId);
      setSelectedExam(response.exam as OfflineExamRecord);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'تعذر تحميل تفاصيل الاختبار.'));
    } finally {
      setIsExamLoading(false);
    }
  };

  const requestDeleteExam = (examId: string) => {
    if (isEditingExam) {
      toast.error('احفظ تعديلات الاختبار الحالي أو ألغها قبل حذف اختبار آخر.');
      return;
    }

    setDeleteExamRequest({
      examId,
      endpoint: `/api/exams/${examId}`,
      payload: { examId },
    });
  };

  const handleDeleteExam = async (examId: string) => {
    if (!isTeacher) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteExamById(examId);
      setSuccessMessage('تم حذف الاختبار بنجاح.');
      if (selectedExam?.public_id === examId) {
        setSelectedExam(null);
      }
      await loadExams();
    } catch (deleteError: unknown) {
      setError(normalizeApiError(deleteError, 'تعذر حذف الاختبار.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const canExportExam =
    selectedExam?.public_id && !isLocalOnlyId(selectedExam.public_id);

  const handleExportPdf = () => {
    if (!canExportExam || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportExam(selectedExam!.public_id, 'pdf')
      .catch(() => setExportError('فشل تصدير PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleExportWord = () => {
    if (!canExportExam || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportExam(selectedExam!.public_id, 'docx')
      .catch(() => setExportError('فشل تصدير Word.'))
      .finally(() => setIsExporting(false));
  };

  const handleSharePdf = () => {
    if (!canExportExam || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    shareExam(selectedExam!.public_id, 'pdf', selectedExam!.title)
      .catch(() => setExportError('فشل مشاركة PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleStartEditingExam = () => {
    if (!selectedExam) {
      return;
    }

    setExamDraft(createExamDraft(selectedExam));
    setIsEditingExam(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleCancelEditingExam = () => {
    if (selectedExam) {
      setExamDraft(createExamDraft(selectedExam));
      void clearDraft('quizzes', selectedExam.local_id);
    } else {
      setExamDraft(null);
    }
    setIsEditingExam(false);
    setIsSavingExam(false);
  };

  const updateDraftQuestion = (
    slotId: string,
    updater: (question: ExamQuestion) => ExamQuestion
  ) => {
    setExamDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.map((question) =>
          question.slot_id === slotId ? updater(question) : question
        ),
      };
    });
  };

  const handleSaveExam = async () => {
    if (!selectedExam?.public_id || !examDraft || isSavingExam) {
      return;
    }

    const trimmedTitle = examDraft.title.trim();
    if (!trimmedTitle) {
      setError({ message: 'عنوان الاختبار مطلوب.' });
      return;
    }

    setIsSavingExam(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const normalizedQuestions = examDraft.questions.map((question) => {
        if (question.question_type === 'multiple_choice') {
          return {
            ...cloneExamQuestion(question),
            question_text: question.question_text.trim(),
            options: (question.options ?? []).map((option) => option.trim()),
          };
        }

        if (question.question_type === 'true_false') {
          return {
            ...cloneExamQuestion(question),
            question_text: question.question_text.trim(),
          };
        }

        if (question.question_type === 'fill_blank') {
          return {
            ...cloneExamQuestion(question),
            question_text: question.question_text.trim(),
            answer_text: question.answer_text.trim(),
          };
        }

        return {
          ...cloneExamQuestion(question),
          question_text: question.question_text.trim(),
          answer_text: question.answer_text.trim(),
          rubric: (question.rubric ?? []).map((item) => item.trim()).filter(Boolean),
        };
      });

      const response = await updateExam(selectedExam.public_id, {
        title: trimmedTitle,
        questions: normalizedQuestions,
      });

      const nextExam = response.exam as OfflineExamRecord;
      setSelectedExam(nextExam);
      setExams((current) =>
        current.map((exam) =>
          exam.local_id === nextExam.local_id ? nextExam : exam
        )
      );
      setExamDraft(createExamDraft(nextExam));
      setIsEditingExam(false);
      await clearDraft('quizzes', selectedExam.local_id);
      setSuccessMessage(
        nextExam.sync_status === 'synced'
          ? 'تم حفظ تعديلات الاختبار بنجاح.'
          : 'تم حفظ تعديلات الاختبار محليًا وستتم مزامنتها عند عودة الاتصال.'
      );
    } catch (saveError: unknown) {
      setError(normalizeApiError(saveError, 'فشل حفظ تعديلات الاختبار.'));
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleRefinementCommitted = async () => {
    if (!selectedExam?.server_id) {
      return;
    }
    const response = await getExamById(selectedExam.public_id);
    setSelectedExam(response.exam as OfflineExamRecord);
    await loadExams();
  };

  const handleDuplicateExam = async () => {
    if (!selectedExam) {
      return;
    }

    try {
      const response = await duplicateExam(selectedExam.public_id);
      const nextExam = response.exam as OfflineExamRecord;
      setExams((current) => [nextExam, ...current]);
      setSelectedExam(nextExam);
      setSuccessMessage('تم إنشاء نسخة محلية من الاختبار.');
    } catch (error: unknown) {
      setError(normalizeApiError(error, 'تعذر إنشاء نسخة محلية من الاختبار.'));
    }
  };

  if (!user) {
    return null;
  }

  if (isBootLoading) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="qz ui-loaded">
      <header className="qz__header page-header">
        <div>
          <nav className="qz__breadcrumb" aria-label="breadcrumb">
            <Link to="/">الرئيسية</Link>
            <span>←</span>
            <span className="qz__breadcrumb-current">الاختبارات</span>
          </nav>
          <h1>
            {isTeacher
              ? 'توليد الاختبارات بجدول المواصفات'
              : 'إدارة الاختبارات المولدة'}
          </h1>
          <p>
            {isTeacher
              ? 'اختر مادة ودروساً متعددة، ثم حدد عدد الأسئلة والدرجة الكلية ليتم توليد اختبار موزون بشكل آلي وحفظه.'
              : 'عرض نظامي لجميع الاختبارات المولدة مع الفلترة والتفاصيل والتصدير.'}
          </p>
        </div>
      </header>

      {draftRecoveredNotice ? (
        <p className="ui-inline-notice ui-inline-notice--info">{draftRecoveredNotice}</p>
      ) : null}

      <div className={`qz__layout ${isAdmin ? 'qz__layout--admin' : ''}`}>
        {isTeacher ? (
          <aside className="qz__panel">
          <h2>إعداد الاختبار</h2>
          <div className="qz__requirement-note ui-inline-notice ui-inline-notice--info" role="note">
            <strong>متطلبات توليد الاختبار:</strong> اختر مادة ودروساً تحتوي على <strong>خطط درس مولدة</strong> و<strong>أهداف تعلم</strong>. إن لم تكن الدروس تحتوي على خطط أو أهداف، سيظهر خطأ عند التوليد.
          </div>
          <>
              {error ? (
                <div className="qz__error-block ui-inline-notice ui-inline-notice--error" role="alert">
                  <p>{error.message}</p>
                  {Array.isArray(error.details) && error.details.length > 0 ? (
                    <ul className="qz__error-details">
                      {error.details.map((d: { message?: string }, i: number) => (
                        <li key={i}>{typeof d?.message === 'string' ? d.message : String(d)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <div className="qz__field">
                <label htmlFor="qz-subject">المادة</label>
                <select
                  id="qz-subject"
                  value={selectedSubjectId}
                  onChange={(event) => void handleSubjectChange(event.target.value)}
                  disabled={isGenerating || isEditingExam}
                >
                  <option value="">اختر المادة...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="qz__field">
                <label htmlFor="qz-title">عنوان الاختبار</label>
                <input
                  id="qz-title"
                  type="text"
                  value={examTitle}
                  onChange={(event) => {
                    setExamTitle(event.target.value);
                    setIsTitleTouched(true);
                  }}
                  placeholder="عنوان الاختبار"
                  disabled={isGenerating || isEditingExam}
                />
              </div>

              <div className="qz__inline-grid">
                <div className="qz__field">
                  <label htmlFor="qz-total-questions">عدد الأسئلة</label>
                  <input
                    id="qz-total-questions"
                    type="number"
                    min={1}
                    value={totalQuestions}
                    onChange={(event) => setTotalQuestions(Number(event.target.value))}
                    disabled={isGenerating || isEditingExam}
                  />
                </div>
                <div className="qz__field">
                  <label htmlFor="qz-total-marks">الدرجة الكلية</label>
                  <input
                    id="qz-total-marks"
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={totalMarks}
                    onChange={(event) => setTotalMarks(Number(event.target.value))}
                    disabled={isGenerating || isEditingExam}
                  />
                  <small>تُوزَّع الدرجات على الأسئلة بمضاعفات 0.25.</small>
                </div>
                <div className="qz__field">
                  <label htmlFor="qz-duration-minutes">زمن الاختبار (دقيقة)</label>
                  <input
                    id="qz-duration-minutes"
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                    disabled={isGenerating || isEditingExam}
                  />
                </div>
              </div>

              <section className="qz__lesson-picker">
                <h3>اختيار الدروس ({lessonIdsArray.length})</h3>
                {isLessonsLoading ? (
                  <p>جارٍ تحميل الدروس...</p>
                ) : selectedSubjectId === '' ? (
                  <p>اختر مادة لعرض وحداتها ودروسها.</p>
                ) : groupedLessons.length === 0 ? (
                  <p>لا توجد وحدات أو دروس لهذه المادة.</p>
                ) : (
                  groupedLessons.map(({ unit, lessons }) => (
                    <div key={unit.id} className="qz__unit-group">
                      <h4>{unit.name}</h4>
                      {lessons.length === 0 ? (
                        <p className="qz__unit-empty">لا توجد دروس.</p>
                      ) : (
                        lessons.map((lesson) => (
                          <label key={lesson.id} className="qz__lesson-item">
                            <input
                              type="checkbox"
                              checked={selectedLessonIds.has(lesson.id)}
                              onChange={() => toggleLessonSelection(lesson.id)}
                              disabled={isGenerating || isEditingExam}
                            />
                            <span>{lesson.name}</span>
                            <small>{lesson.number_of_periods ?? 1} حصة</small>
                          </label>
                        ))
                      )}
                    </div>
                  ))
                )}
              </section>

              <p className="qz__form-hint">
                الدروس المختارة يجب أن تحتوي على خطط مولدة وأهداف.
              </p>

              <button
                type="button"
                className="qz__generate-btn"
                onClick={() => void handleGenerateExam()}
                disabled={isGenerating || isEditingExam || selectedSubjectId === ''}
              >
                {isGenerating && <span className="ui-button-spinner" aria-hidden />}
                {!isGenerating && <MdAutoAwesome aria-hidden />}
                {isGenerating ? 'جارٍ التوليد...' : 'توليد الاختبار'}
              </button>
          </>
          </aside>
        ) : null}

        <section className="qz__content">
          <div className="qz__filters">
            <h2>الأرشيف</h2>
            <div className="qz__filters-grid">
              <div className="qz__field">
                <label htmlFor="qz-filter-subject">فلترة بالمادة</label>
                <select
                  id="qz-filter-subject"
                  value={filterSubjectId}
                  onChange={(event) =>
                    setFilterSubjectId(event.target.value ? Number(event.target.value) : '')
                  }
                  disabled={isEditingExam}
                >
                  <option value="">الكل</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="qz__field">
                <label htmlFor="qz-filter-class">فلترة بالصف</label>
                <select
                  id="qz-filter-class"
                  value={filterClassId}
                  onChange={(event) =>
                    setFilterClassId(event.target.value ? Number(event.target.value) : '')
                  }
                  disabled={isEditingExam}
                >
                  <option value="">الكل</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="qz__field">
                <label htmlFor="qz-filter-from">من تاريخ</label>
                <input
                  id="qz-filter-from"
                  type="date"
                  value={filterDateFrom}
                  onChange={(event) => setFilterDateFrom(event.target.value)}
                  disabled={isEditingExam}
                />
              </div>
              <div className="qz__field">
                <label htmlFor="qz-filter-to">إلى تاريخ</label>
                <input
                  id="qz-filter-to"
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => setFilterDateTo(event.target.value)}
                  disabled={isEditingExam}
                />
              </div>
            </div>
            <button
              type="button"
              className="qz__refresh-btn"
              onClick={() => void loadExams()}
              disabled={isListLoading || isEditingExam}
            >
              {isListLoading && <span className="ui-button-spinner" aria-hidden />}
              {!isListLoading && <MdRefresh aria-hidden />}
              {isListLoading ? 'جارٍ التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          <div className="qz__archive-and-details">
            <div className="qz__archive">
              <h3>الاختبارات المحفوظة ({exams.length})</h3>
              {isListLoading ? (
                <p>جارٍ تحميل الاختبارات...</p>
              ) : exams.length === 0 ? (
                <p>لا توجد اختبارات محفوظة.</p>
              ) : (
                exams.map((exam) => {
                  const subject = subjectsById.get(exam.subject_id);
                  const classItem = classesById.get(exam.class_id);
                  const isActive = selectedExam?.public_id === exam.public_id;
                  return (
                    <article
                      key={exam.public_id}
                      className={`qz__exam-card animate-fadeIn ${
                        isActive ? 'qz__exam-card--active' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="qz__exam-open"
                        onClick={() => void handleLoadExamDetails(exam.public_id)}
                        disabled={isExamLoading || isEditingExam}
                      >
                        {isExamLoading && isActive ? (
                          <span className="ui-button-spinner" aria-hidden />
                        ) : (
                          <MdQuiz aria-hidden />
                        )}
                        <div>
                          <h4>{exam.title}</h4>
                          <p>
                            {subject?.name ?? `مادة #${exam.subject_id}`} |{' '}
                            {classItem?.name ?? `صف #${exam.class_id}`}
                          </p>
                          <small>
                            {exam.total_questions} سؤال | {exam.total_marks} درجة
                            {exam.duration_minutes != null
                              ? ` | ${exam.duration_minutes} دقيقة`
                              : ''}
                          </small>
                          <small>{formatDateTimeAr(exam.created_at)}</small>
                          <SyncStatusBadge status={exam.sync_status} />
                        </div>
                      </button>

                      {isTeacher ? (
                        <button
                          type="button"
                          className="qz__delete-btn"
                          onClick={() => requestDeleteExam(exam.public_id)}
                          disabled={isDeleting || isEditingExam || !exam.server_id}
                        >
                          <MdDelete aria-hidden />
                          حذف
                        </button>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>

            <div className="qz__details">
              <h3>تفاصيل الاختبار</h3>
              {!selectedExam ? (
                <p>اختر اختباراً من القائمة لعرض تفاصيله.</p>
              ) : isExamLoading ? (
                <p>جارٍ تحميل التفاصيل...</p>
              ) : (
                <div className="qz__details-body">
                  <header className="qz__details-head">
                    <div className="qz__details-heading">
                      {isEditingExam && examDraft ? (
                        <input
                          type="text"
                          className="qz__edit-input"
                          value={examDraft.title}
                          onChange={(event) =>
                            setExamDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    title: event.target.value,
                                  }
                                : current
                            )
                          }
                        />
                      ) : (
                        <div className="qz__details-title">
                          <h4>{selectedExam.title}</h4>
                          <SyncStatusBadge status={selectedExam.sync_status} />
                        </div>
                      )}
                      <p>
                        المعرّف: {selectedExam.public_id} | {selectedExam.total_questions}{' '}
                        سؤال | {selectedExam.total_marks} درجة
                        {selectedExam.duration_minutes != null
                          ? ` | مدة: ${selectedExam.duration_minutes} دقيقة`
                          : ''}
                      </p>
                    </div>
                    <div className="qz__details-actions">
                      {isEditingExam ? (
                        <>
                          <button
                            type="button"
                            className="qz__details-action-btn qz__details-action-btn--secondary"
                            onClick={handleCancelEditingExam}
                            disabled={isSavingExam}
                          >
                            <MdClose aria-hidden />
                            إلغاء
                          </button>
                          <button
                            type="button"
                            className="qz__details-action-btn qz__details-action-btn--primary"
                            onClick={() => void handleSaveExam()}
                            disabled={isSavingExam || !examDraft}
                          >
                            {isSavingExam && <span className="ui-button-spinner" aria-hidden />}
                            {!isSavingExam && <MdSave aria-hidden />}
                            {isSavingExam ? 'جارٍ الحفظ...' : 'حفظ'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="qz__refresh-btn"
                            onClick={handleExportPdf}
                            disabled={isExporting || !canExportExam}
                            aria-busy={isExporting}
                          >
                            {isExporting && (
                              <span className="ui-button-spinner" aria-hidden />
                            )}
                            {!isExporting && <MdOutlinePictureAsPdf aria-hidden />}
                            تصدير PDF
                          </button>
                          <button
                            type="button"
                            className="qz__refresh-btn"
                            onClick={handleExportWord}
                            disabled={isExporting || !canExportExam}
                            aria-busy={isExporting}
                          >
                            {isExporting && (
                              <span className="ui-button-spinner" aria-hidden />
                            )}
                            {!isExporting && <MdOutlineTextSnippet aria-hidden />}
                            تصدير Word
                          </button>
                          <button
                            type="button"
                            className="qz__refresh-btn"
                            onClick={() => setWhatsAppExportOpen(true)}
                            disabled={!canExportExam}
                            title={
                              !canExportExam && selectedExam
                                ? 'مزامن الاختبار مع الخادم أولاً لتمكين التصدير'
                                : 'مشاركة عبر واتساب'
                            }
                          >
                            <MdWhatsapp aria-hidden />
                            واتساب
                          </button>
                          <button
                            type="button"
                            className="qz__refresh-btn"
                            onClick={handleSharePdf}
                            disabled={isExporting || !canExportExam}
                            aria-busy={isExporting}
                            title="مشاركة PDF عبر الجهاز"
                          >
                            {isExporting && (
                              <span className="ui-button-spinner" aria-hidden />
                            )}
                            {!isExporting && 'مشاركة PDF'}
                          </button>
                          <button
                            type="button"
                            className="qz__details-action-btn qz__details-action-btn--secondary"
                            onClick={handleStartEditingExam}
                            disabled={isExamLoading}
                          >
                            <MdEdit aria-hidden />
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="qz__details-action-btn qz__details-action-btn--secondary"
                            onClick={() => void handleDuplicateExam()}
                            disabled={isExamLoading}
                          >
                            <MdContentCopy aria-hidden />
                            نسخة محلية
                          </button>
                        </>
                      )}
                    </div>
                  </header>

                  {selectedExam.last_sync_error ? (
                    <p className="ui-inline-notice ui-inline-notice--warning">
                      {selectedExam.last_sync_error}
                    </p>
                  ) : null}

                  {selectedExam.blueprint?.cells && (
                    <section className="qz__blueprint">
                      <h5>مصفوفة جدول المواصفات</h5>
                      <div className="qz__table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>الدرس</th>
                              <th>المستوى</th>
                              <th>وزن الدرس</th>
                              <th>وزن المستوى</th>
                              <th>وزن الخلية</th>
                              <th>الأسئلة</th>
                              <th>الدرجات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedExam.blueprint.cells.map((cell, index) => (
                              <tr key={`${cell.lesson_id}-${cell.level}-${index}`}>
                                <td>{cell.lesson_name}</td>
                                <td>{cell.level_label}</td>
                                <td>{cell.topic_weight}</td>
                                <td>{cell.level_weight}</td>
                                <td>{cell.cell_weight}</td>
                                <td>{cell.question_count}</td>
                                <td>{cell.cell_marks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  <section className="qz__questions">
                    <h5>الأسئلة والإجابات</h5>
                    {(isEditingExam
                      ? examDraft?.questions ?? []
                      : selectedExam.questions ?? []
                    ).length > 0 ? (
                      (isEditingExam
                        ? examDraft?.questions ?? []
                        : selectedExam.questions ?? []
                      ).map((question) => (
                        <article key={question.slot_id} className="qz__question-card">
                          <div className="qz__question-meta">
                            <strong>س{question.question_number}</strong>
                            <span>{QUESTION_TYPE_LABELS[question.question_type]}</span>
                            <span>{question.bloom_level_label}</span>
                            <span>{question.marks} درجة</span>
                            <span>{question.lesson_name}</span>
                          </div>
                          {isEditingExam ? (
                            <div className="qz__question-editor">
                              <label className="qz__editor-label" htmlFor={question.slot_id}>
                                نص السؤال
                              </label>
                              <textarea
                                id={question.slot_id}
                                className="qz__edit-textarea"
                                rows={4}
                                value={question.question_text}
                                onChange={(event) =>
                                  updateDraftQuestion(question.slot_id, (current) => ({
                                    ...current,
                                    question_text: event.target.value,
                                  }))
                                }
                              />

                              {question.question_type === 'multiple_choice' ? (
                                <>
                                  <div className="qz__question-edit-grid">
                                    <label className="qz__editor-label">الخيار الصحيح</label>
                                    <select
                                      className="qz__edit-select"
                                      value={question.correct_option_index ?? 0}
                                      onChange={(event) =>
                                        updateDraftQuestion(question.slot_id, (current) => ({
                                          ...current,
                                          correct_option_index: Number(event.target.value),
                                        }))
                                      }
                                    >
                                      {(question.options ?? []).map((_, index) => (
                                        <option key={`${question.slot_id}-correct-${index}`} value={index}>
                                          الخيار {index + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="qz__options-edit">
                                    {(question.options ?? []).map((option, index) => (
                                      <label
                                        key={`${question.slot_id}-opt-edit-${index}`}
                                        className="qz__option-edit-row"
                                      >
                                        <span>{index + 1}</span>
                                        <input
                                          type="text"
                                          className="qz__edit-input"
                                          value={option}
                                          onChange={(event) =>
                                            updateDraftQuestion(question.slot_id, (current) => {
                                              const nextOptions = [...(current.options ?? [])];
                                              nextOptions[index] = event.target.value;
                                              return {
                                                ...current,
                                                options: nextOptions,
                                              };
                                            })
                                          }
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </>
                              ) : null}

                              {question.question_type === 'true_false' ? (
                                <div className="qz__question-edit-grid">
                                  <label className="qz__editor-label">الإجابة الصحيحة</label>
                                  <select
                                    className="qz__edit-select"
                                    value={question.correct_answer ? 'true' : 'false'}
                                    onChange={(event) =>
                                      updateDraftQuestion(question.slot_id, (current) => ({
                                        ...current,
                                        correct_answer: event.target.value === 'true',
                                      }))
                                    }
                                  >
                                    <option value="true">صحيح</option>
                                    <option value="false">خطأ</option>
                                  </select>
                                </div>
                              ) : null}

                              {question.question_type === 'fill_blank' ? (
                                <div className="qz__question-edit-grid">
                                  <label className="qz__editor-label">الإجابة النموذجية</label>
                                  <textarea
                                    className="qz__edit-textarea"
                                    rows={3}
                                    value={question.answer_text}
                                    onChange={(event) =>
                                      updateDraftQuestion(question.slot_id, (current) => ({
                                        ...current,
                                        answer_text: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              ) : null}

                              {question.question_type === 'open_ended' ? (
                                <>
                                  <div className="qz__question-edit-grid">
                                    <label className="qz__editor-label">الإجابة النموذجية</label>
                                    <textarea
                                      className="qz__edit-textarea"
                                      rows={4}
                                      value={question.answer_text}
                                      onChange={(event) =>
                                        updateDraftQuestion(question.slot_id, (current) => ({
                                          ...current,
                                          answer_text: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="qz__question-edit-grid">
                                    <label className="qz__editor-label">
                                      معيار التصحيح
                                    </label>
                                    <textarea
                                      className="qz__edit-textarea"
                                      rows={4}
                                      value={joinLines(question.rubric)}
                                      onChange={(event) =>
                                        updateDraftQuestion(question.slot_id, (current) => ({
                                          ...current,
                                          rubric: splitLines(event.target.value),
                                        }))
                                      }
                                    />
                                  </div>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <p className="qz__question-text">{question.question_text}</p>

                              {question.question_type === 'multiple_choice' &&
                                question.options && (
                                  <ul className="qz__options">
                                    {question.options.map((option, index) => (
                                      <li key={`${question.slot_id}-opt-${index}`}>
                                        {index + 1}. {option}
                                      </li>
                                    ))}
                                  </ul>
                                )}

                              {question.question_type === 'open_ended' &&
                                question.rubric &&
                                question.rubric.length > 0 && (
                                  <ul className="qz__rubric">
                                    {question.rubric.map((item, index) => (
                                      <li key={`${question.slot_id}-rubric-${index}`}>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                )}

                              <div className="qz__answer">
                                <label>الإجابة النموذجية</label>
                                <p>{question.answer_text}</p>
                              </div>
                            </>
                          )}
                        </article>
                      ))
                    ) : (
                      <p>لا توجد أسئلة لعرضها.</p>
                    )}
                  </section>

                  {!isEditingExam && selectedExam.server_id ? (
                    <SmartRefinementPanel
                      artifactType="exam"
                      artifactId={selectedExam.public_id}
                      baseArtifact={{
                        id: selectedExam.public_id,
                        title: selectedExam.title,
                        total_questions: selectedExam.total_questions,
                        total_marks: selectedExam.total_marks,
                        lesson_ids: selectedExam.lesson_ids,
                        blueprint: selectedExam.blueprint ?? {},
                        questions: selectedExam.questions ?? [],
                      }}
                      targetSelectors={getRefinementTargetOptions('exam')}
                      onCommitted={handleRefinementCommitted}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <ConfirmActionModal
        isOpen={Boolean(deleteExamRequest)}
        title="تأكيد حذف الاختبار"
        message="سيتم حذف الاختبار نهائيًا. لا يمكن التراجع بعد الحذف."
        endpoint={deleteExamRequest?.endpoint ?? '/api/exams'}
        payload={deleteExamRequest?.payload}
        isLoading={isDeleting}
        onCancel={() => setDeleteExamRequest(null)}
        onConfirm={async () => {
          if (!deleteExamRequest) {
            return;
          }
          await handleDeleteExam(deleteExamRequest.examId);
          setDeleteExamRequest(null);
        }}
      />

      <WhatsAppExportModal
        isOpen={whatsAppExportOpen}
        title="مشاركة الاختبار عبر واتساب"
        defaultMessage={
          selectedExam
            ? `اختبار: ${selectedExam.title}\nالمعرف: ${selectedExam.public_id}`
            : ''
        }
        onClose={() => setWhatsAppExportOpen(false)}
        isExporting={isExporting}
        onConfirm={async ({ format, message }) => {
          if (!canExportExam) return;
          setIsExporting(true);
          try {
            const blob = await getExamExportBlob(selectedExam!.public_id, format);
            const text =
              message.trim() ||
              `اختبار: ${selectedExam!.title}\nالمعرف: ${selectedExam!.public_id}`;
            const ext = format === 'pdf' ? 'pdf' : 'docx';
            const filename = `exam_${selectedExam!.public_id}.${ext}`;
            await shareDocumentWithWhatsApp(blob, filename, text);
            setWhatsAppExportOpen(false);
          } catch {
            setExportError('فشل تصدير الاختبار.');
          } finally {
            setIsExporting(false);
          }
        }}
      />

      {isTeacher && selectedSubject && (
        <footer className="qz__subject-meta">
          المادة المختارة: {selectedSubject.name}
        </footer>
      )}
    </div>
  );
}
