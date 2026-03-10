import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  MdAutoAwesome,
  MdCheckCircle,
  MdDelete,
  MdErrorOutline,
  MdOutlinePictureAsPdf,
  MdOutlineTextSnippet,
  MdQuiz,
  MdRefresh,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { Class, Exam, Lesson, Subject, Unit } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
import {
  deleteExamById,
  exportExam,
  generateExam,
  getAllClasses,
  getAllSubjects,
  getExamById,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  listExams,
} from './quizzes.services';
import './quizzes.css';

type SelectValue = number | '';

interface LessonOption extends Lesson {
  unit_name: string;
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

export default function Quizzes() {
  const { user } = useAuth();
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

  const [filterSubjectId, setFilterSubjectId] = useState<SelectValue>('');
  const [filterClassId, setFilterClassId] = useState<SelectValue>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isLessonsLoading, setIsLessonsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setIsListLoading(true);
    try {
      const response = await listExams({
        subject_id: filterSubjectId === '' ? undefined : filterSubjectId,
        class_id: filterClassId === '' ? undefined : filterClassId,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setExams(response.exams ?? []);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل قائمة الاختبارات.'));
    } finally {
      setIsListLoading(false);
    }
  }, [filterClassId, filterDateFrom, filterDateTo, filterSubjectId]);

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

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await generateExam({
        subject_id: selectedSubjectId,
        lesson_ids: lessonIdsArray,
        total_questions: totalQuestions,
        total_marks: totalMarks,
        title: examTitle.trim() || undefined,
      });

      setSelectedExam(response.exam);
      setSuccessMessage('تم توليد الاختبار وحفظه بنجاح.');
      await loadExams();
    } catch (generationError: unknown) {
      setError(normalizeApiError(generationError, 'فشل توليد الاختبار.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadExamDetails = async (examId: string) => {
    setIsExamLoading(true);
    setError(null);
    try {
      const response = await getExamById(examId);
      setSelectedExam(response.exam);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'تعذر تحميل تفاصيل الاختبار.'));
    } finally {
      setIsExamLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!isTeacher) {
      return;
    }

    const accepted = window.confirm('هل تريد حذف هذا الاختبار نهائيًا؟');
    if (!accepted) {
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

  const handleExportPdf = () => {
    if (!selectedExam?.public_id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportExam(selectedExam.public_id, 'pdf')
      .catch(() => setExportError('فشل تصدير PDF.'))
      .finally(() => setIsExporting(false));
  };

  const handleExportWord = () => {
    if (!selectedExam?.public_id || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    exportExam(selectedExam.public_id, 'docx')
      .catch(() => setExportError('فشل تصدير Word.'))
      .finally(() => setIsExporting(false));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="qz" dir="rtl">
      <header className="qz__header">
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

      {error && (
        <div className="qz-alert qz-alert--error" role="alert">
          <MdErrorOutline aria-hidden />
          <p>{error.message}</p>
        </div>
      )}

      {successMessage && (
        <div className="qz-alert qz-alert--success" role="status">
          <MdCheckCircle aria-hidden />
          <p>{successMessage}</p>
        </div>
      )}

      <div className={`qz__layout ${isAdmin ? 'qz__layout--admin' : ''}`}>
        {isTeacher ? (
          <aside className="qz__panel">
          <h2>إعداد الاختبار</h2>
          {isBootLoading ? (
            <p>جارٍ تحميل المواد...</p>
          ) : (
            <>
              <div className="qz__field">
                <label htmlFor="qz-subject">المادة</label>
                <select
                  id="qz-subject"
                  value={selectedSubjectId}
                  onChange={(event) => void handleSubjectChange(event.target.value)}
                  disabled={isGenerating}
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
                  disabled={isGenerating}
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
                    disabled={isGenerating}
                  />
                </div>
                <div className="qz__field">
                  <label htmlFor="qz-total-marks">الدرجة الكلية</label>
                  <input
                    id="qz-total-marks"
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={totalMarks}
                    onChange={(event) => setTotalMarks(Number(event.target.value))}
                    disabled={isGenerating}
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
                              disabled={isGenerating}
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

              <button
                type="button"
                className="qz__generate-btn"
                onClick={() => void handleGenerateExam()}
                disabled={isGenerating || selectedSubjectId === ''}
              >
                <MdAutoAwesome aria-hidden />
                {isGenerating ? 'جارٍ التوليد...' : 'توليد الاختبار'}
              </button>
            </>
          )}
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
                />
              </div>
              <div className="qz__field">
                <label htmlFor="qz-filter-to">إلى تاريخ</label>
                <input
                  id="qz-filter-to"
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => setFilterDateTo(event.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className="qz__refresh-btn"
              onClick={() => void loadExams()}
              disabled={isListLoading}
            >
              <MdRefresh aria-hidden />
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
                      className={`qz__exam-card ${isActive ? 'qz__exam-card--active' : ''}`}
                    >
                      <button
                        type="button"
                        className="qz__exam-open"
                        onClick={() => void handleLoadExamDetails(exam.public_id)}
                        disabled={isExamLoading}
                      >
                        <MdQuiz aria-hidden />
                        <div>
                          <h4>{exam.title}</h4>
                          <p>
                            {subject?.name ?? `مادة #${exam.subject_id}`} |{' '}
                            {classItem?.name ?? `صف #${exam.class_id}`}
                          </p>
                          <small>
                            {exam.total_questions} سؤال | {exam.total_marks} درجة
                          </small>
                          <small>{formatDateTimeAr(exam.created_at)}</small>
                        </div>
                      </button>

                      {isTeacher ? (
                        <button
                          type="button"
                          className="qz__delete-btn"
                          onClick={() => void handleDeleteExam(exam.public_id)}
                          disabled={isDeleting}
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
                  {exportError && (
                    <div className="qz-alert qz-alert--error" role="alert">
                      <MdErrorOutline aria-hidden />
                      <p>{exportError}</p>
                    </div>
                  )}
                  <header className="qz__details-head">
                    <h4>{selectedExam.title}</h4>
                    <p>
                      المعرف: {selectedExam.public_id} | {selectedExam.total_questions}{' '}
                      سؤال | {selectedExam.total_marks} درجة
                    </p>
                    <div className="qz__details-export-actions">
                      <button
                        type="button"
                        className="qz__refresh-btn"
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        aria-busy={isExporting}
                      >
                        <MdOutlinePictureAsPdf aria-hidden />
                        تصدير PDF
                      </button>
                      <button
                        type="button"
                        className="qz__refresh-btn"
                        onClick={handleExportWord}
                        disabled={isExporting}
                        aria-busy={isExporting}
                      >
                        <MdOutlineTextSnippet aria-hidden />
                        تصدير Word
                      </button>
                    </div>
                  </header>

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
                    {selectedExam.questions && selectedExam.questions.length > 0 ? (
                      selectedExam.questions.map((question) => (
                        <article key={question.slot_id} className="qz__question-card">
                          <div className="qz__question-meta">
                            <strong>س{question.question_number}</strong>
                            <span>{QUESTION_TYPE_LABELS[question.question_type]}</span>
                            <span>{question.bloom_level_label}</span>
                            <span>{question.marks} درجة</span>
                            <span>{question.lesson_name}</span>
                          </div>
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
                                  <li key={`${question.slot_id}-rubric-${index}`}>{item}</li>
                                ))}
                              </ul>
                            )}

                          <div className="qz__answer">
                            <label>الإجابة النموذجية</label>
                            <p>{question.answer_text}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p>لا توجد أسئلة لعرضها.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {isTeacher && selectedSubject && (
        <footer className="qz__subject-meta">
          المادة المختارة: {selectedSubject.name}
        </footer>
      )}
    </div>
  );
}
