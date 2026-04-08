import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import {
  MdAutoAwesome,
  MdAdd,
  MdClose,
  MdDelete,
  MdEdit,
  MdCheckCircle,
  MdLock,
  MdLockOpen,
  MdRefresh,
  MdSave,
} from 'react-icons/md';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import ExportFormatModal from '../../components/common/ExportFormatModal';
import { SyncStatusBadge } from '../../components/common/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';
import type {
  Class,
  Exam,
  ExamQuestion,
  Lesson,
  Subject,
  TeacherManagementRow,
  Unit,
} from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';
import type { NormalizedApiError } from '../../utils/apiErrors';
import { normalizeApiError } from '../../utils/apiErrors';
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts';
import { useOffline } from '../../offline/useOffline';
import { isLocalOnlyId } from '../../offline/utils';
import type { OfflineExamRecord } from '../../offline/types';
import {
  validateExamDraftForSave,
  type ExamDraftValidationError,
  type ExamDraft,
} from './quizzes.validation';
import {
  deleteExamById,
  generateExam,
  getAllClasses,
  getAllSubjects,
  getExamById,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  listExams,
  exportExam,
  updateExam,
} from './quizzes.services';

import SmartRefinementPanel from '../refinements/components/SmartRefinementPanel';
import { getRefinementTargetOptions } from '../refinements/refinementTargets';
import {
  LESSON_DURATION_OPTIONS,
  SEMESTER_OPTIONS,
} from '../../constants/dropdown-options';
import {
  formatClassSelectLabel,
  formatClassBaseSelectLabel,
  formatSubjectSelectLabel,
  getClassBaseKey,
  getClassSectionLabel,
  normalizeAcademicYearLabel,
  normalizeSemesterLabel,
} from '../../utils/classDisplay';
import {
  formatUnitDisplayLabel,
  formatUnitOrdinalText,
} from '../../utils/unitDisplay';
import { listTeachers } from '../users/users.services';
import './quizzes.css';

type SelectValue = number | '';
type QuizScreen = 'creator' | 'generated' | 'confirmation';

interface LessonOption extends Lesson {
  unit_name: string;
}

interface ClassGroup {
  key: string;
  baseClass: Class;
  sections: Class[];
}

const PAPER_SECTION_GROUPS = [
  {
    id: 'true_false',
    title: 'أجب بنعم أو لا',
    questionTypes: ['true_false'] as const,
  },
  {
    id: 'mcq',
    title: 'اختر الإجابة الصحيحة',
    questionTypes: ['multiple_choice'] as const,
  },
  {
    id: 'written',
    title: 'أجب عن الأسئلة الآتية',
    questionTypes: ['fill_blank', 'open_ended'] as const,
  },
] as const;

const QUESTION_TYPE_OPTIONS = Object.entries(QUESTION_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as ExamQuestion['question_type'],
    label,
  })
);

const PAPER_OPTION_LABELS = ['أ', 'ب', 'ج', 'د'];

const ARABIC_DIGIT_MAP: Record<string, string> = {
  0: '٠',
  1: '١',
  2: '٢',
  3: '٣',
  4: '٤',
  5: '٥',
  6: '٦',
  7: '٧',
  8: '٨',
  9: '٩',
};

type PaperQuestion = ExamQuestion & {
  displayNumber: number;
};

interface PaperQuestionSection {
  id: string;
  title: string;
  questionTypes: ExamQuestion['question_type'][];
  questions: PaperQuestion[];
}

function getSectionTotalMarks(section: PaperQuestionSection): number {
  return section.questions.reduce(
    (sum, question) => sum + (Number(question.marks) || 0),
    0
  );
}

function getMainQuestionOrdinal(index: number): string {
  const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
  return ordinals[index] ?? formatArabicNumber(index + 1);
}

function formatArabicNumber(value: number): string {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '—';
  }
  return new Intl.NumberFormat('ar-SA').format(number);
}

function toArabicDigits(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /\d/g,
    (digit) => ARABIC_DIGIT_MAP[digit] ?? digit
  );
}

function splitPaperLines(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePaperGradeLabel(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (!text || text === '—') {
    return '—';
  }

  const firstPart = text.split(' - ')[0]?.trim() ?? text;
  if (firstPart.startsWith('الصف ')) {
    return toArabicDigits(firstPart);
  }
  if (firstPart.startsWith('صف ')) {
    return `الصف ${toArabicDigits(firstPart.slice(4).trim())}`;
  }
  if (firstPart === 'صف') {
    return 'الصف';
  }
  return toArabicDigits(`الصف ${firstPart}`);
}

function groupPaperQuestions(
  questions: ExamQuestion[]
): PaperQuestionSection[] {
  const normalizedQuestions = questions.map((question) => ({ ...question }));
  const sections: PaperQuestionSection[] = [];
  const knownTypes = new Set<ExamQuestion['question_type']>();

  PAPER_SECTION_GROUPS.forEach((group) => {
    group.questionTypes.forEach((questionType) => knownTypes.add(questionType));
    const sectionQuestions = normalizedQuestions.filter((question) =>
      group.questionTypes.some(
        (questionType) => questionType === question.question_type
      )
    );

    if (!sectionQuestions.length) {
      return;
    }

    sections.push({
      id: group.id,
      title: group.title,
      questionTypes: [...group.questionTypes],
      questions: sectionQuestions.map((question, index) => ({
        ...question,
        displayNumber: index + 1,
      })),
    });
  });

  const unknownTypes = Array.from(
    new Set(
      normalizedQuestions
        .map((question) => question.question_type)
        .filter((questionType) => !knownTypes.has(questionType))
    )
  );

  unknownTypes.forEach((questionType) => {
    const sectionQuestions = normalizedQuestions.filter(
      (question) => question.question_type === questionType
    );
    if (!sectionQuestions.length) {
      return;
    }

    sections.push({
      id: `other_${questionType}`,
      title: 'أجب عن الأسئلة الآتية',
      questionTypes: [questionType],
      questions: sectionQuestions.map((question, index) => ({
        ...question,
        displayNumber: index + 1,
      })),
    });
  });

  return sections;
}

function getPaperAnswerLineCount(
  questionType: ExamQuestion['question_type']
): number {
  switch (questionType) {
    case 'fill_blank':
      return 2;
    case 'open_ended':
      return 5;
    default:
      return 0;
  }
}

function PaperQuestionCard({ question }: { question: PaperQuestion }) {
  const promptLines = splitPaperLines(question.question_text);
  const questionNumber = formatArabicNumber(question.displayNumber ?? 1);

  return (
    <article
      className={`qz__paper-question qz__paper-question--${question.question_type}`}
    >
      <div className="qz__paper-question-body">
        {promptLines.length > 1 ? (
          <ol className="qz__paper-question-lines">
            {promptLines.map((line, index) => (
              <li key={`${question.slot_id}-line-${index}`}>
                <span className="qz__paper-question-line-index">
                  {formatArabicNumber(index + 1)}.
                </span>
                <span className="qz__paper-question-line-text">
                  {toArabicDigits(line)}
                </span>
                {question.question_type === 'true_false' ? (
                  <span className="qz__paper-blank" aria-hidden="true">
                    ( )
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : promptLines.length === 1 ? (
          <p className="qz__paper-question-text">
            <span className="qz__paper-question-inline-number">
              {toArabicDigits(`${questionNumber}.`)}
            </span>
            <span>{toArabicDigits(promptLines[0])}</span>
            {question.question_type === 'true_false' ? (
              <span className="qz__paper-blank" aria-hidden="true">
                ( )
              </span>
            ) : null}
          </p>
        ) : null}

        {question.question_type === 'multiple_choice' &&
        Array.isArray(question.options) &&
        question.options.length > 0 ? (
          <ul className="qz__paper-options">
            {question.options.map((option, index) => (
              <li key={`${question.slot_id}-option-${index}`}>
                <span className="qz__paper-option-label">
                  {PAPER_OPTION_LABELS[index] ?? formatArabicNumber(index + 1)}{' '}
                  -
                </span>
                <span className="qz__paper-option-text">
                  {toArabicDigits(option)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {question.question_type === 'fill_blank' ||
        question.question_type === 'open_ended' ? (
          <div
            className={`qz__paper-answer-lines qz__paper-answer-lines--${question.question_type}`}
          >
            {Array.from({
              length: getPaperAnswerLineCount(question.question_type),
            }).map((_, index) => (
              <span
                key={`${question.slot_id}-answer-line-${index}`}
                className="qz__paper-answer-line"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RequiredMark() {
  return (
    <span className="qz__required-star" aria-hidden="true">
      *
    </span>
  );
}

function PaperSectionBlock({
  section,
  sectionIndex,
}: {
  section: PaperQuestionSection;
  sectionIndex: number;
}) {
  const sectionTotalMarks = formatArabicNumber(getSectionTotalMarks(section));
  const mainQuestionTitle = `السؤال ${getMainQuestionOrdinal(sectionIndex)} : ${section.title}`;

  return (
    <section className="qz__paper-section">
      <header className="qz__paper-main-question-header">
        <span className="qz__paper-main-question-title">
          {toArabicDigits(mainQuestionTitle)}
        </span>
        <span className="qz__paper-main-question-marks">
          {toArabicDigits(`الدرجة ${sectionTotalMarks}`)}
        </span>
      </header>
      <div className="qz__paper-section-questions">
        {section.questions.map((question) => (
          <PaperQuestionCard key={question.slot_id} question={question} />
        ))}
      </div>
    </section>
  );
}

interface ExamPaperSheetProps {
  title: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  classLabel: string;
  academicYearLabel: string;
  semesterLabel: string;
  totalMarks: number;
  questions: ExamQuestion[];
}

function ExamPaperSheet({
  title,
  schoolName,
  schoolLogoUrl,
  classLabel,
  academicYearLabel,
  semesterLabel,
  totalMarks,
  questions,
}: ExamPaperSheetProps) {
  const sections = useMemo(() => groupPaperQuestions(questions), [questions]);

  return (
    <section className="qz__paper-shell" aria-label="ورقة الاختبار">
      <div className="qz__paper-page">
        <header className="qz__paper-header">
          <div className="qz__paper-header-cell qz__paper-header-cell--ministry">
            <div className="qz__paper-header-ministry">الجمهورية اليمنية</div>
            <div className="qz__paper-header-ministry">
              وزارة التربية والتعليم
            </div>
            <div className="qz__paper-header-ministry">محافظة عدن</div>
          </div>

          <div className="qz__paper-header-cell qz__paper-header-cell--center">
            <div className="qz__paper-header-title">
              {toArabicDigits(title)}
            </div>
            <div className="qz__paper-header-line">
              {toArabicDigits(classLabel)}
            </div>
            <div className="qz__paper-header-line">
              {toArabicDigits(semesterLabel)}
              {academicYearLabel
                ? ` (${toArabicDigits(academicYearLabel)})`
                : ''}
            </div>
          </div>

          <div className="qz__paper-header-cell qz__paper-header-cell--school">
            <div className="qz__paper-school-logo">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt="شعار المدرسة" />
              ) : (
                <span>شعار المدرسة</span>
              )}
            </div>
            <div className="qz__paper-school-lines">
              <div>مدرسة: {toArabicDigits(schoolName)}</div>
              <div>الدرجة الكلية: {formatArabicNumber(totalMarks)}</div>
            </div>
          </div>
        </header>

        <div className="qz__paper-student-row">
          <div className="qz__paper-student-field qz__paper-student-field--name">
            <span>اسم الطالب:</span>
            <span className="qz__paper-student-line" aria-hidden="true" />
          </div>

          <div className="qz__paper-student-field qz__paper-student-field--section">
            <span>الشعبة:</span>
            <span className="qz__paper-student-box" aria-hidden="true" />
          </div>
        </div>

        <div className="qz__paper-sections">
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <PaperSectionBlock
                key={section.id}
                section={section}
                sectionIndex={index}
              />
            ))
          ) : (
            <div className="qz__paper-empty">لا توجد أسئلة لعرضها.</div>
          )}
        </div>

        <footer className="qz__paper-footer">انتهت الأسئلة</footer>
      </div>
    </section>
  );
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

function formatExamSummaryParts(
  exam: Pick<Exam, 'total_questions' | 'total_marks' | 'duration_minutes'>
): string[] {
  return [
    `عدد الأسئلة: ${formatArabicNumber(exam.total_questions)}`,
    `الدرجة: ${formatArabicNumber(exam.total_marks)}`,
    exam.duration_minutes != null
      ? `المدة: ${formatArabicNumber(exam.duration_minutes)} د`
      : null,
  ].filter((part): part is string => part !== null);
}

function autoTitle(
  subjectName: string,
  classItem: Class | null,
  academicYear: string,
  semester: string
): string {
  const gradeLabel = classItem?.grade_label?.trim() ?? '';
  const semesterLabel = semester ? `الفصل ${semester}` : 'الفصل';
  const yearLabel = academicYear ? `(${academicYear})` : '';
  return `اختبار ${subjectName}-${semesterLabel}-الصف ${gradeLabel} ${yearLabel}`.trim();
}

function formatCombinedSectionLabel(classItems: Class[]): string {
  const labels = Array.from(
    new Set(
      classItems
        .map((classItem) => getClassSectionLabel(classItem).trim())
        .filter((label) => label.length > 0 && label !== '—')
    )
  );

  return labels.length > 0 ? labels.join('، ') : '—';
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

  if (
    nextQuestion.question_type === 'multiple_choice' &&
    !nextQuestion.options
  ) {
    nextQuestion.options = ['', '', '', ''];
  }

  if (nextQuestion.question_type === 'open_ended' && !nextQuestion.rubric) {
    nextQuestion.rubric = [];
  }

  return nextQuestion;
}

function createQuestionId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }

  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getQuestionTemplateQuestion(
  questions: ExamQuestion[],
  preferredType?: ExamQuestion['question_type']
): ExamQuestion | null {
  if (preferredType) {
    const preferred = questions.find(
      (question) => question.question_type === preferredType
    );
    if (preferred) {
      return preferred;
    }
  }

  return questions[questions.length - 1] ?? questions[0] ?? null;
}

function createQuestionDraft(
  questions: ExamQuestion[],
  questionType: ExamQuestion['question_type'] = 'multiple_choice',
  slotId = createQuestionId()
): ExamQuestion {
  const template = getQuestionTemplateQuestion(questions, questionType);
  const baseLessonId = template?.lesson_id ?? 1;
  const baseLessonName = template?.lesson_name ?? 'درس جديد';
  const baseBloomLevel = template?.bloom_level ?? 'remember';
  const baseBloomLevelLabel = template?.bloom_level_label ?? 'التذكر';
  const baseMarks = template?.marks ?? 1;
  const nextBase: ExamQuestion = {
    slot_id: slotId,
    question_number: questions.length + 1,
    lesson_id: baseLessonId,
    lesson_name: baseLessonName,
    bloom_level: baseBloomLevel,
    bloom_level_label: baseBloomLevelLabel,
    question_type: questionType,
    marks: baseMarks,
    question_text: '',
    answer_text: '',
  };

  if (questionType === 'multiple_choice') {
    return {
      ...nextBase,
      options: ['', '', '', ''],
      correct_option_index: 0,
      answer_text: '',
    };
  }

  if (questionType === 'true_false') {
    return {
      ...nextBase,
      correct_answer: true,
      answer_text: 'صحيح',
    };
  }

  if (questionType === 'fill_blank') {
    return {
      ...nextBase,
      answer_text: '',
    };
  }

  return {
    ...nextBase,
    answer_text: '',
    rubric: [],
  };
}

function normalizeQuestionForType(
  question: ExamQuestion,
  questionType: ExamQuestion['question_type']
): ExamQuestion {
  const baseQuestion: ExamQuestion = {
    ...cloneExamQuestion(question),
    question_type: questionType,
    answer_text: '',
  };

  if (questionType === 'multiple_choice') {
    const options =
      Array.isArray(question.options) && question.options.length > 0
        ? [...question.options.slice(0, 4)]
        : ['', '', '', ''];
    while (options.length < 4) {
      options.push('');
    }
    const nextCorrectIndex =
      typeof question.correct_option_index === 'number' &&
      question.correct_option_index >= 0 &&
      question.correct_option_index < options.length
        ? question.correct_option_index
        : 0;
    return {
      ...baseQuestion,
      options,
      correct_option_index: nextCorrectIndex,
      correct_answer: undefined,
      rubric: undefined,
      answer_text: '',
    };
  }

  if (questionType === 'true_false') {
    const nextCorrectAnswer =
      typeof question.correct_answer === 'boolean'
        ? question.correct_answer
        : true;
    return {
      ...baseQuestion,
      correct_answer: nextCorrectAnswer,
      options: undefined,
      correct_option_index: undefined,
      rubric: undefined,
      answer_text: nextCorrectAnswer ? 'صحيح' : 'خطأ',
    };
  }

  if (questionType === 'fill_blank') {
    return {
      ...baseQuestion,
      options: undefined,
      correct_option_index: undefined,
      correct_answer: undefined,
      rubric: undefined,
      answer_text: '',
    };
  }

  return {
    ...baseQuestion,
    options: undefined,
    correct_option_index: undefined,
    correct_answer: undefined,
    answer_text: '',
    rubric: [],
  };
}

function normalizeExamQuestionsForDisplay(
  questions: ExamQuestion[]
): ExamQuestion[] {
  return questions.map((question, index) => ({
    ...cloneExamQuestion(question),
    question_number: index + 1,
  }));
}

function normalizeQuestionForSave(
  question: ExamQuestion,
  index: number
): ExamQuestion {
  const common = {
    ...cloneExamQuestion(question),
    question_number: index + 1,
    question_text: question.question_text.trim(),
    marks: Number(question.marks),
  };

  if (question.question_type === 'multiple_choice') {
    const options = (question.options ?? []).map((option) => option.trim());
    const correctOptionIndex = Number(question.correct_option_index ?? 0);
    return {
      ...common,
      options,
      correct_option_index: correctOptionIndex,
      answer_text: options[correctOptionIndex] ?? '',
      correct_answer: undefined,
      rubric: undefined,
    };
  }

  if (question.question_type === 'true_false') {
    const correctAnswer = Boolean(question.correct_answer);
    return {
      ...common,
      correct_answer: correctAnswer,
      answer_text: correctAnswer ? 'صحيح' : 'خطأ',
      options: undefined,
      correct_option_index: undefined,
      rubric: undefined,
    };
  }

  if (question.question_type === 'fill_blank') {
    return {
      ...common,
      answer_text: question.answer_text.trim(),
      options: undefined,
      correct_option_index: undefined,
      correct_answer: undefined,
      rubric: undefined,
    };
  }

  return {
    ...common,
    answer_text: question.answer_text.trim(),
    rubric: (question.rubric ?? [])
      .map((item) => item.trim())
      .filter(Boolean),
    options: undefined,
    correct_option_index: undefined,
    correct_answer: undefined,
  };
}

function calculateExamTotals(questions: ExamQuestion[]): {
  totalQuestions: number;
  totalMarks: number;
} {
  return questions.reduce(
    (accumulator, question) => ({
      totalQuestions: accumulator.totalQuestions + 1,
      totalMarks: Number(
        (accumulator.totalMarks + (Number(question.marks) || 0)).toFixed(2)
      ),
    }),
    { totalQuestions: 0, totalMarks: 0 }
  );
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

function getValidationMessagesForPath(
  errors: ExamDraftValidationError[],
  fieldPath: string,
  includeDescendants = false
): string[] {
  return Array.from(
    new Set(
      errors
        .filter(
          (error) =>
            error.field === fieldPath ||
            (includeDescendants && error.field.startsWith(`${fieldPath}.`))
        )
        .map((error) => error.message)
        .filter((message) => message.trim().length > 0)
    )
  );
}

function describeDraftValidationField(
  fieldPath: string,
  questions: ExamQuestion[]
): string {
  if (fieldPath === 'title') {
    return 'عنوان الاختبار';
  }

  if (fieldPath === 'questions') {
    return 'الأسئلة';
  }

  const match = /^questions\.(\d+)\.(.+)$/.exec(fieldPath);
  if (!match) {
    return fieldPath;
  }

  const questionIndex = Number(match[1]);
  const question = questions[questionIndex];
  const questionLabel = `السؤال ${formatArabicNumber(questionIndex + 1)}`;
  const field = match[2];

  if (field === 'question_type') {
    return `${questionLabel} - نوع السؤال`;
  }
  if (field === 'marks') {
    return `${questionLabel} - الدرجة`;
  }
  if (field === 'question_text') {
    return `${questionLabel} - نص السؤال`;
  }
  if (field === 'correct_option_index') {
    return `${questionLabel} - الخيار الصحيح`;
  }
  if (field === 'correct_answer') {
    return `${questionLabel} - الإجابة الصحيحة`;
  }
  if (field === 'answer_text') {
    return `${questionLabel} - ${
      question?.question_type === 'multiple_choice'
        ? 'الإجابة'
        : 'الإجابة النموذجية'
    }`;
  }
  if (field === 'lesson_id') {
    return `${questionLabel} - الدرس`;
  }
  if (field === 'lesson_name') {
    return `${questionLabel} - اسم الدرس`;
  }
  if (field === 'bloom_level') {
    return `${questionLabel} - مستوى بلوم`;
  }
  if (field === 'bloom_level_label') {
    return `${questionLabel} - اسم مستوى بلوم`;
  }
  if (field === 'rubric' || field.startsWith('rubric.')) {
    return `${questionLabel} - معيار التصحيح`;
  }
  if (field === 'options' || field.startsWith('options.')) {
    const optionMatch = /^options\.(\d+)$/.exec(field);
    if (optionMatch) {
      return `${questionLabel} - الخيار ${formatArabicNumber(
        Number(optionMatch[1]) + 1
      )}`;
    }
    return `${questionLabel} - الخيارات`;
  }

  return questionLabel;
}

function ApiErrorBanner({ error }: { error: NormalizedApiError | null }) {
  if (!error) {
    return null;
  }

  return (
    <div
      className="qz__error-block ui-inline-notice ui-inline-notice--error"
      role="alert"
    >
      <p>{error.message}</p>
      {Array.isArray(error.details) && error.details.length > 0 ? (
        <ul className="qz__error-details">
          {error.details.map((detail: { message?: string }, index: number) => (
            <li key={`${detail?.message ?? 'detail'}-${index}`}>
              {typeof detail?.message === 'string'
                ? detail.message
                : String(detail)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DraftValidationBanner({
  errors,
  questions,
}: {
  errors: ExamDraftValidationError[];
  questions: ExamQuestion[];
}) {
  if (!errors.length) {
    return null;
  }

  return (
    <div
      className="qz__error-block qz__draft-validation ui-inline-notice ui-inline-notice--error"
      role="alert"
    >
      <p>هناك حقول ناقصة أو غير صحيحة. أكملها قبل الحفظ:</p>
      <ul className="qz__error-details">
        {errors.map((error, index) => (
          <li key={`${error.field}-${error.message}-${index}`}>
            {describeDraftValidationField(error.field, questions)}:{' '}
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldValidationMessages({ messages }: { messages: string[] }) {
  if (!messages.length) {
    return null;
  }

  return <small className="qz__field-error">{messages.join('، ')}</small>;
}

export default function Quizzes() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { examId: examIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { lastSyncAt } = useOffline();
  const isAdmin = user?.userRole === 'admin';
  const isTeacher = user?.userRole === 'teacher';
  const isCreateRoute = location.pathname === '/quizzes/create';
  const selectedExamIdFromRoute = examIdParam?.trim() ?? '';

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>(
    SEMESTER_OPTIONS[0]
  );
  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(
    new Set()
  );
  const [examTitle, setExamTitle] = useState('');
  const [isTitleTouched, setIsTitleTouched] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [totalMarks, setTotalMarks] = useState<number>(20);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [examScreen, setExamScreen] = useState<QuizScreen>('creator');

  const [filterTeacherId, setFilterTeacherId] = useState<SelectValue>('');
  const [filterSubjectId, setFilterSubjectId] = useState<SelectValue>('');
  const [filterClassId, setFilterClassId] = useState<SelectValue>('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterAcademicYear, setFilterAcademicYear] = useState('');
  const academicYearOptions = useMemo(() => {
    const years = new Set<string>();
    classes.forEach((classItem) => {
      const year = normalizeAcademicYearLabel(classItem.academic_year);
      if (year) {
        years.add(year);
      }
    });

    return Array.from(years).sort((left, right) =>
      right.localeCompare(left, 'ar', { numeric: true })
    );
  }, [classes]);

  const semesterOptions = useMemo(() => {
    const semesters = new Set<string>();
    classes.forEach((classItem) => {
      const semester = normalizeSemesterLabel(classItem.semester);
      if (semester) {
        semesters.add(semester);
      }
    });

    return Array.from(semesters).sort((left, right) =>
      left.localeCompare(right, 'ar')
    );
  }, [classes]);

  const [exams, setExams] = useState<OfflineExamRecord[]>([]);
  const [selectedExam, setSelectedExam] = useState<OfflineExamRecord | null>(
    null
  );

  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isLessonsLoading, setIsLessonsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [draftSaveAttempted, setDraftSaveAttempted] = useState(false);

  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportFormatOpen, setExportFormatOpen] = useState(false);
  const [exportTargetType, setExportTargetType] = useState<
    'questions_only' | 'answer_key' | null
  >(null);
  const [isExportingExam, setIsExportingExam] = useState(false);
  const [deleteExamRequest, setDeleteExamRequest] = useState<{
    examId: string;
    endpoint: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const [examDraft, setExamDraft] = useState<ExamDraft | null>(null);
  const [newQuestionType, setNewQuestionType] =
    useState<ExamQuestion['question_type']>('multiple_choice');
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<
    string | null
  >(null);
  const [draftRecoveredNotice, setDraftRecoveredNotice] = useState<
    string | null
  >(null);
  const questionCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const draftValidationErrors = useMemo(() => {
    if (!draftSaveAttempted || !examDraft) {
      return [];
    }

    const validationResult = validateExamDraftForSave(examDraft);
    return validationResult.ok ? [] : validationResult.errors;
  }, [draftSaveAttempted, examDraft]);

  const loadExams = useCallback(async () => {
    setIsListLoading(true);
    try {
      const response = await listExams();
      setExams((response.exams ?? []) as OfflineExamRecord[]);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل قائمة الاختبارات.'));
    } finally {
      setIsListLoading(false);
    }
  }, []);

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
        const classesLoader = isAdmin
          ? () => getAllClasses()
          : () => getMyClasses();
        const subjectsLoader = isAdmin
          ? () => getAllSubjects()
          : () => getMySubjects();
        const [classesResponse, subjectsResponse] = await Promise.all([
          classesLoader(),
          subjectsLoader(),
        ]);

        if (cancelled) {
          return;
        }

        setClasses(classesResponse.classes ?? []);
        setSubjects(subjectsResponse.subjects ?? []);

        if (isAdmin) {
          try {
            const teachersResponse = await listTeachers();
            if (!cancelled) {
              setTeachers(teachersResponse.teachers ?? []);
            }
          } catch {
            if (!cancelled) {
              setTeachers([]);
            }
          }
        } else if (!cancelled) {
          setTeachers([]);
        }
      } catch (bootstrapError: unknown) {
        if (!cancelled) {
          setError(
            normalizeApiError(bootstrapError, 'فشل تحميل بيانات الاختبارات.')
          );
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
    if (!selectedExam) {
      setIsEditingExam(false);
      setIsSavingExam(false);
      setExamDraft(null);
      setDraftRecoveredNotice(null);
      if (isCreateRoute) {
        setExamScreen('creator');
      }
      return;
    }

    setIsEditingExam(false);
    setIsSavingExam(false);
    setExamDraft(createExamDraft(selectedExam));
    setDraftRecoveredNotice(null);
    if (isCreateRoute && examScreen !== 'confirmation') {
      setExamScreen('generated');
    }
  }, [examScreen, isCreateRoute, selectedExam]);

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

  useEffect(() => {
    if (!highlightedQuestionId) {
      return;
    }

    const element = questionCardRefs.current[highlightedQuestionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus({ preventScroll: true });
    }

    const timer = window.setTimeout(() => {
      setHighlightedQuestionId(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedQuestionId, examDraft?.questions.length, isEditingExam]);

  const classesById = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const classGroups = useMemo(() => {
    const grouped = new Map<string, ClassGroup>();

    classes.forEach((classItem) => {
      const baseKey = getClassBaseKey(classItem);
      const current = grouped.get(baseKey);
      if (current) {
        current.sections.push(classItem);
        return;
      }

      grouped.set(baseKey, {
        key: baseKey,
        baseClass: classItem,
        sections: [classItem],
      });
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
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

  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const selectedClassGroup = useMemo(() => {
    if (!selectedClass) {
      return null;
    }

    const baseKey = getClassBaseKey(selectedClass);
    return classGroups.find((group) => group.key === baseKey) ?? null;
  }, [classGroups, selectedClass]);

  const selectedClassSectionLabel = useMemo(() => {
    if (selectedClassGroup) {
      return formatCombinedSectionLabel(selectedClassGroup.sections);
    }

    return (
      (selectedClass ? getClassSectionLabel(selectedClass) : '') ||
      selectedClass?.section_label?.trim() ||
      selectedClass?.section?.trim() ||
      '—'
    );
  }, [selectedClass, selectedClassGroup]);

  const subjectsById = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  const teacherFilterOptions = useMemo(() => {
    const options = [
      ...(user
        ? [
            {
              id: user.id,
              username: user.username,
              display_name: user.display_name,
            },
          ]
        : []),
      ...teachers.map((teacher) => ({
        id: teacher.id,
        username: teacher.username,
        display_name: teacher.display_name,
      })),
    ];

    return Array.from(
      new Map(options.map((teacher) => [teacher.id, teacher])).values()
    ).sort((left, right) =>
      (left.display_name || left.username).localeCompare(
        right.display_name || right.username,
        'ar'
      )
    );
  }, [teachers, user]);

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

  useEffect(() => {
    if (academicYearOptions.length === 0) {
      return;
    }

    setSelectedAcademicYear((current) =>
      academicYearOptions.includes(current) ? current : academicYearOptions[0]
    );
  }, [academicYearOptions]);

  const filteredClassGroups = useMemo(() => {
    return classGroups.filter((group) => {
      const classItem = group.baseClass;
      if (
        selectedAcademicYear &&
        normalizeAcademicYearLabel(classItem.academic_year) !==
          selectedAcademicYear
      ) {
        return false;
      }
      if (
        selectedSemester &&
        normalizeSemesterLabel(classItem.semester) !== selectedSemester
      ) {
        return false;
      }
      return true;
    });
  }, [classGroups, selectedAcademicYear, selectedSemester]);

  const subjectsForSelectedClass = useMemo(() => {
    if (!selectedClassGroup) {
      return [];
    }

    const selectedClassIds = new Set(
      selectedClassGroup.sections.map((classItem) => classItem.id)
    );

    return [...subjects]
      .filter((subjectItem) => selectedClassIds.has(subjectItem.class_id))
      .sort((left, right) => {
        const leftClass = classesById.get(left.class_id) ?? null;
        const rightClass = classesById.get(right.class_id) ?? null;
        const leftLabel = formatSubjectSelectLabel(left, leftClass);
        const rightLabel = formatSubjectSelectLabel(right, rightClass);
        return leftLabel.localeCompare(rightLabel, 'ar');
      });
  }, [classesById, selectedClassGroup, subjects]);

  const selectedSubject = useMemo(
    () =>
      subjectsForSelectedClass.find(
        (subjectItem) => subjectItem.id === selectedSubjectId
      ) ?? null,
    [selectedSubjectId, subjectsForSelectedClass]
  );

  const clearArchiveFilters = () => {
    setFilterTeacherId('');
    setFilterSubjectId('');
    setFilterClassId('');
    setFilterSemester('');
    setFilterAcademicYear('');
  };

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (
        isAdmin &&
        filterTeacherId !== '' &&
        exam.teacher_id !== filterTeacherId
      ) {
        return false;
      }
      if (filterSubjectId !== '' && exam.subject_id !== filterSubjectId) {
        return false;
      }
      if (filterClassId !== '' && exam.class_id !== filterClassId) {
        return false;
      }
      const classItem = classesById.get(exam.class_id) ?? null;
      const examSemester = normalizeSemesterLabel(classItem?.semester);
      const examAcademicYear = normalizeAcademicYearLabel(
        classItem?.academic_year
      );
      if (filterSemester && examSemester !== filterSemester) {
        return false;
      }
      if (filterAcademicYear && examAcademicYear !== filterAcademicYear) {
        return false;
      }
      return true;
    });
  }, [
    classesById,
    exams,
    filterAcademicYear,
    filterClassId,
    filterSemester,
    filterSubjectId,
    filterTeacherId,
    isAdmin,
  ]);

  const isSubjectSelectionLocked =
    selectedAcademicYear === '' ||
    selectedSemester === '' ||
    selectedClassId === '' ||
    isGenerating ||
    isEditingExam;

  const resetExamDraftSelection = useCallback(() => {
    setSelectedClassId('');
    setSelectedSubjectId('');
    setSelectedLessonIds(new Set());
    setUnits([]);
    setLessonOptions([]);
    setExamTitle('');
    setIsTitleTouched(false);
    setExamScreen('creator');
  }, []);

  const resetCreateExamState = useCallback(() => {
    resetExamDraftSelection();
    setSelectedAcademicYear(academicYearOptions[0] ?? '');
    setSelectedSemester(SEMESTER_OPTIONS[0]);
    setTotalQuestions(10);
    setTotalMarks(20);
    setDurationMinutes(45);
    setSelectedExam(null);
    setExamDraft(null);
    setIsEditingExam(false);
    setIsSavingExam(false);
    setExportTargetType(null);
    setExportFormatOpen(false);
    setDeleteExamRequest(null);
    setError(null);
    setSuccessMessage(null);
    setDraftRecoveredNotice(null);
    setIsGenerating(false);
    setNewQuestionType('multiple_choice');
    setHighlightedQuestionId(null);
    setDraftSaveAttempted(false);
    questionCardRefs.current = {};
  }, [academicYearOptions, resetExamDraftSelection]);

  useEffect(() => {
    resetCreateExamState();
  }, [isCreateRoute, resetCreateExamState]);

  const handleAcademicYearChange = (value: string) => {
    setSelectedAcademicYear(value);
    resetExamDraftSelection();
  };

  const handleSemesterChange = (value: string) => {
    setSelectedSemester(value);
    resetExamDraftSelection();
  };

  const handleClassChange = (value: string) => {
    const nextClassId = value ? Number(value) : '';
    setSelectedClassId(nextClassId);
    setSelectedSubjectId('');
    setSelectedLessonIds(new Set());
    setUnits([]);
    setLessonOptions([]);
    setExamTitle('');
    setIsTitleTouched(false);
    setError(null);
    setSuccessMessage(null);
    setExamScreen('creator');
  };

  const handleSubjectChange = async (value: string) => {
    const nextSubjectId = value ? Number(value) : '';
    setSelectedSubjectId(nextSubjectId);
    setSelectedLessonIds(new Set());
    setUnits([]);
    setLessonOptions([]);
    setError(null);
    setSuccessMessage(null);

    if (nextSubjectId === '') {
      setExamTitle('');
      return;
    }

    const subject = subjectsForSelectedClass.find(
      (subjectItem) => subjectItem.id === nextSubjectId
    );
    if (subject && !isTitleTouched) {
      setExamTitle(
        autoTitle(
          subject.name,
          selectedClass,
          selectedAcademicYear,
          selectedSemester
        )
      );
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
            unit_name: formatUnitOrdinalText(unit.name),
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
    if (!isTeacher && !isAdmin) {
      return;
    }

    if (selectedAcademicYear === '') {
      setError({ message: 'اختر العام الدراسي أولاً.' });
      return;
    }

    if (selectedSemester === '') {
      setError({ message: 'اختر الفصل الدراسي أولاً.' });
      return;
    }

    if (selectedClassId === '' || !selectedClass) {
      setError({ message: 'اختر الصف أولاً.' });
      return;
    }

    if (selectedSubjectId === '' || !selectedSubject) {
      setError({ message: 'اختر المادة أولاً.' });
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
      setError({
        message:
          'الدرجة الكلية يجب أن تكون بمضاعفات 0.25 مثل 1 أو 1.25 أو 1.5.',
      });
      return;
    }
    if (totalMarks * 4 < totalQuestions) {
      setError({ message: 'يجب توفير 0.25 درجة على الأقل لكل سؤال.' });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      setError({
        message: 'زمن الاختبار يجب أن يكون رقماً صحيحاً موجباً (دقيقة).',
      });
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const suggestedTitle =
        examTitle.trim() ||
        autoTitle(
          selectedSubject.name,
          selectedClass,
          selectedAcademicYear,
          selectedSemester
        );
      const response = await generateExam({
        subject_id: selectedSubjectId,
        lesson_ids: lessonIdsArray,
        total_questions: totalQuestions,
        total_marks: totalMarks,
        duration_minutes: durationMinutes,
        title: suggestedTitle,
        academic_year: selectedAcademicYear,
        semester: selectedSemester,
        grade: selectedClass.grade_label,
        section:
          selectedClassSectionLabel.trim() === '—'
            ? undefined
            : selectedClassSectionLabel,
      });

      if ('queued' in response && response.queued) {
        setSuccessMessage(response.message);
        setSelectedExam(null);
        setExamDraft(null);
        setIsEditingExam(false);
        setExamScreen('creator');
      } else {
        setSelectedExam((response as { exam: Exam }).exam as OfflineExamRecord);
        setExamScreen('confirmation');
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

  const handleLoadExamDetails = useCallback(
    async (examId: string) => {
      if (isEditingExam) {
        toast.error(
          'احفظ تعديلات الاختبار الحالي أو ألغها قبل فتح اختبار آخر.'
        );
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
    },
    [isEditingExam]
  );

  useEffect(() => {
    if (!selectedExamIdFromRoute || isCreateRoute || isEditingExam) {
      return;
    }

    if (selectedExam?.public_id === selectedExamIdFromRoute) {
      return;
    }

    void handleLoadExamDetails(selectedExamIdFromRoute);
  }, [
    handleLoadExamDetails,
    isCreateRoute,
    isEditingExam,
    selectedExam?.public_id,
    selectedExamIdFromRoute,
  ]);

  useEffect(() => {
    if (isCreateRoute || !selectedExamIdFromRoute || !selectedExam) {
      return;
    }

    if (selectedExam.public_id !== selectedExamIdFromRoute) {
      return;
    }

    const requestedType = searchParams.get('export');
    if (requestedType !== 'questions_only' && requestedType !== 'answer_key') {
      return;
    }

    if (isLocalOnlyId(selectedExam.public_id)) {
      toast.error('لا يمكن تصدير اختبار محلي غير مزامن.');
      setSearchParams({}, { replace: true });
      return;
    }

    setExportTargetType(requestedType);
    setExportFormatOpen(true);
    setSearchParams({}, { replace: true });
  }, [
    isCreateRoute,
    searchParams,
    selectedExam,
    selectedExamIdFromRoute,
    setSearchParams,
  ]);

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
        if (isCreateRoute) {
          resetCreateExamState();
        } else {
          setSelectedExam(null);
          setExamDraft(null);
          setIsEditingExam(false);
        }
      }
      await loadExams();
    } catch (deleteError: unknown) {
      setError(normalizeApiError(deleteError, 'تعذر حذف الاختبار.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedExamCanExport = selectedExam
    ? !isLocalOnlyId(selectedExam.public_id)
    : false;

  const paperSchoolName = user?.profile?.school_name?.trim() || '—';
  const paperSchoolLogoUrl = user?.profile?.school_logo_url ?? null;
  const paperSourceClass =
    (selectedExam
      ? (classesById.get(selectedExam.class_id) ?? selectedClass)
      : selectedClass) ?? null;
  const paperGradeLabel = normalizePaperGradeLabel(
    paperSourceClass?.grade_label?.trim() ||
      selectedExam?.class_name?.trim() ||
      '—'
  );
  const paperAcademicYearLabel = paperSourceClass
    ? normalizeAcademicYearLabel(paperSourceClass.academic_year) || '—'
    : isCreateRoute
      ? selectedAcademicYear || '—'
      : '—';
  const paperSemesterLabel = paperSourceClass
    ? normalizeSemesterLabel(paperSourceClass.semester)
    : isCreateRoute
      ? normalizeSemesterLabel(selectedSemester)
      : '—';
  const paperClassLabel = paperGradeLabel;

  const examDetailsTitle =
    isCreateRoute && examScreen === 'generated'
      ? 'عرض الاختبار المولد'
      : 'تفاصيل الاختبار';

  const openExportDialog = (type: 'questions_only' | 'answer_key') => {
    setExportTargetType(type);
    setExportFormatOpen(true);
  };

  const handleExportSelectedExam = async (format: 'pdf' | 'docx') => {
    if (!selectedExam?.public_id || !exportTargetType) {
      return;
    }

    setIsExportingExam(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await exportExam(selectedExam.public_id, format, exportTargetType);
      setExportFormatOpen(false);
      toast.success('تم تصدير الاختبار بنجاح.');
    } catch (exportError: unknown) {
      setError(normalizeApiError(exportError, 'فشل تصدير الاختبار.'));
    } finally {
      setIsExportingExam(false);
      setExportTargetType(null);
    }
  };

  const handleStartEditingExam = () => {
    if (!selectedExam) {
      return;
    }

    setExamDraft(createExamDraft(selectedExam));
    setIsEditingExam(true);
    setDraftSaveAttempted(false);
    setError(null);
    setSuccessMessage(null);
    setNewQuestionType('multiple_choice');
    setHighlightedQuestionId(null);
    questionCardRefs.current = {};
    if (isCreateRoute) {
      setExamScreen('generated');
    }
  };

  const handleOpenGeneratedExamFromConfirmation = () => {
    if (!selectedExam) {
      return;
    }

    setIsEditingExam(false);
    setIsSavingExam(false);
    setExamScreen('generated');
  };

  const handleCreateNewExam = () => {
    resetCreateExamState();
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
    setDraftSaveAttempted(false);
    setNewQuestionType('multiple_choice');
    setHighlightedQuestionId(null);
    if (isCreateRoute && selectedExam) {
      setExamScreen('generated');
    }
  };

  const handleAddQuestion = (
    questionType: ExamQuestion['question_type'] = newQuestionType
  ) => {
    if (!examDraft) {
      return;
    }

    const nextQuestionId = createQuestionId();
    setExamDraft({
      ...examDraft,
      questions: [
        ...examDraft.questions,
        createQuestionDraft(examDraft.questions, questionType, nextQuestionId),
      ],
    });
    setHighlightedQuestionId(nextQuestionId);
  };

  const handleRemoveQuestion = (slotId: string) => {
    setExamDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.filter(
          (question) => question.slot_id !== slotId
        ),
      };
    });
  };

  const handleChangeQuestionType = (
    slotId: string,
    questionType: ExamQuestion['question_type']
  ) => {
    setExamDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.map((question) =>
          question.slot_id === slotId
            ? normalizeQuestionForType(question, questionType)
            : question
        ),
      };
    });
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

    setDraftSaveAttempted(true);
    const draftValidation = validateExamDraftForSave(examDraft);
    if (!draftValidation.ok) {
      const firstQuestionIssue = draftValidation.errors.find((issue) =>
        issue.field.startsWith('questions.')
      );
      if (firstQuestionIssue) {
        const match = /^questions\.(\d+)\./.exec(firstQuestionIssue.field);
        if (match) {
          const questionIndex = Number(match[1]);
          setHighlightedQuestionId(
            examDraft.questions[questionIndex]?.slot_id ?? null
          );
        }
      } else {
        setHighlightedQuestionId(null);
      }

      setError(null);
      setSuccessMessage(null);
      return;
    }

    setIsSavingExam(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const normalizedQuestions = examDraft.questions.map(
        (question, index) => normalizeQuestionForSave(question, index)
      );

      const response = await updateExam(selectedExam.public_id, {
        title: examDraft.title.trim(),
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
      setNewQuestionType('multiple_choice');
      setHighlightedQuestionId(null);
      setDraftSaveAttempted(false);
      await clearDraft('quizzes', selectedExam.local_id);
      if (isCreateRoute) {
        setExamScreen('confirmation');
      }
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
    if (isCreateRoute) {
      setExamScreen('generated');
    }
  };

  const displayedExamQuestions = isEditingExam
    ? normalizeExamQuestionsForDisplay(examDraft?.questions ?? [])
    : (selectedExam?.questions ?? []);
  const displayedExamTotals = calculateExamTotals(displayedExamQuestions);

  const examDetailsView = selectedExam ? (
    <div
      className={`qz__details ${!isEditingExam ? 'qz__details--paper' : ''}`}
    >
      <h3>{examDetailsTitle}</h3>
      {isExamLoading ? (
        <p>جارٍ تحميل التفاصيل...</p>
      ) : (
        <div className="qz__details-body">
          <header className="qz__details-head">
            <div className="qz__details-heading">
              {isEditingExam && examDraft ? (
                <div className="qz__question-edit-grid qz__question-edit-grid--title">
                  <label className="qz__editor-label" htmlFor="qz-exam-title-edit">
                    عنوان الاختبار <RequiredMark />
                  </label>
                  <input
                    id="qz-exam-title-edit"
                    type="text"
                    className="qz__edit-input"
                    value={examDraft.title}
                    required
                    aria-required="true"
                    aria-invalid={
                      getValidationMessagesForPath(draftValidationErrors, 'title')
                        .length > 0
                    }
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
                  <FieldValidationMessages
                    messages={getValidationMessagesForPath(
                      draftValidationErrors,
                      'title'
                    )}
                  />
                </div>
              ) : (
                <div className="qz__details-title">
                  <h4>{toArabicDigits(selectedExam.title)}</h4>
                  <SyncStatusBadge status={selectedExam.sync_status} />
                </div>
              )}
              <p>
                {formatArabicNumber(
                  isEditingExam
                    ? displayedExamTotals.totalQuestions
                    : selectedExam.total_questions
                )}{' '}
                سؤال |{' '}
                {formatArabicNumber(
                  isEditingExam
                    ? displayedExamTotals.totalMarks
                    : selectedExam.total_marks
                )}{' '}
                درجة
                {selectedExam.duration_minutes != null
                  ? ` | مدة: ${formatArabicNumber(selectedExam.duration_minutes)} دقيقة`
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
                    disabled={
                      isSavingExam ||
                      !examDraft ||
                      examDraft.questions.length === 0
                    }
                  >
                    {isSavingExam && (
                      <span className="ui-button-spinner" aria-hidden />
                    )}
                    {!isSavingExam && <MdSave aria-hidden />}
                    {isSavingExam ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </>
              ) : isCreateRoute ? (
                <>
                  <button
                    type="button"
                    className="qz__details-action-btn qz__details-action-btn--primary"
                    onClick={() => void handleSaveExam()}
                    disabled={
                      isSavingExam ||
                      !examDraft ||
                      !selectedExam ||
                      examDraft.questions.length === 0
                    }
                  >
                    {isSavingExam && (
                      <span className="ui-button-spinner" aria-hidden />
                    )}
                    {!isSavingExam && <MdSave aria-hidden />}
                    {isSavingExam ? 'جارٍ الحفظ...' : 'حفظ'}
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
                    onClick={() => openExportDialog('questions_only')}
                    disabled={!selectedExamCanExport || isExportingExam}
                  >
                    تصدير نموذج اختبار
                  </button>
                  <button
                    type="button"
                    className="qz__details-action-btn qz__details-action-btn--secondary"
                    onClick={() => openExportDialog('answer_key')}
                    disabled={!selectedExamCanExport || isExportingExam}
                  >
                    تصدير نموذج إجابات
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="qz__details-action-btn qz__details-action-btn--secondary"
                    onClick={() => openExportDialog('questions_only')}
                    disabled={!selectedExamCanExport || isExportingExam}
                  >
                    تصدير
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
                    className="qz__details-action-btn qz__details-action-btn--secondary qz__details-action-btn--danger"
                    onClick={() => requestDeleteExam(selectedExam.public_id)}
                    disabled={isExamLoading}
                  >
                    <MdDelete aria-hidden />
                    حذف
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

          <ApiErrorBanner error={error} />

          {!isEditingExam && draftValidationErrors.length > 0 ? (
            <DraftValidationBanner
              errors={draftValidationErrors}
              questions={examDraft?.questions ?? []}
            />
          ) : null}

          {isEditingExam ? (
            <section className="qz__questions qz__questions--editor">
              <div className="qz__questions-toolbar">
                <div>
                  <h5>الأسئلة والإجابات</h5>
                  <p>
                    كل حقل عليه نجمة حمراء مطلوب. أضف السؤال الجديد من الأسفل
                    ليظهر في نهاية الاختبار.
                  </p>
                </div>
                <div className="qz__questions-summary" aria-live="polite">
                  <span>عدد الأسئلة: {formatArabicNumber(displayedExamQuestions.length)}</span>
                  <span>الدرجة الكلية: {formatArabicNumber(displayedExamTotals.totalMarks)}</span>
                </div>
              </div>

              {displayedExamQuestions.length > 0 ? (
                <div className="qz__questions-list">
                  {displayedExamQuestions.map((question, index) => (
                    <article
                      key={question.slot_id}
                      ref={(element) => {
                        questionCardRefs.current[question.slot_id] = element;
                      }}
                      tabIndex={-1}
                      className={`qz__question-card ${
                        highlightedQuestionId === question.slot_id
                          ? 'qz__question-card--highlighted'
                          : ''
                      } ${
                        getValidationMessagesForPath(
                          draftValidationErrors,
                          `questions.${index}`,
                          true
                        ).length > 0
                          ? 'qz__question-card--invalid'
                          : ''
                      }`}
                    >
                      <div className="qz__question-card-top">
                        <div className="qz__question-meta">
                          <strong>س{question.question_number}</strong>
                          <span>{QUESTION_TYPE_LABELS[question.question_type]}</span>
                          <span>{question.bloom_level_label}</span>
                          <span>{question.lesson_name}</span>
                        </div>
                        <button
                          type="button"
                          className="qz__details-action-btn qz__details-action-btn--secondary qz__details-action-btn--danger qz__question-remove-btn"
                          onClick={() => handleRemoveQuestion(question.slot_id)}
                        >
                          <MdDelete aria-hidden />
                          حذف السؤال
                        </button>
                      </div>

                      <div className="qz__question-editor">
                        <div className="qz__question-edit-grid">
                          <label
                            className="qz__editor-label"
                            htmlFor={`qz-question-type-${question.slot_id}`}
                          >
                            نوع السؤال <RequiredMark />
                          </label>
                          <select
                            id={`qz-question-type-${question.slot_id}`}
                            className="qz__edit-select"
                            value={question.question_type}
                            required
                            aria-required="true"
                            onChange={(event) =>
                              handleChangeQuestionType(
                                question.slot_id,
                                event.target.value as ExamQuestion['question_type']
                              )
                            }
                          >
                            {QUESTION_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="qz__question-edit-grid">
                          <label
                            className="qz__editor-label"
                            htmlFor={`qz-question-marks-${question.slot_id}`}
                          >
                            الدرجة <RequiredMark />
                          </label>
                          <input
                            id={`qz-question-marks-${question.slot_id}`}
                            type="number"
                            className="qz__edit-input"
                            min={0.25}
                            step={0.25}
                            value={question.marks}
                            required
                            aria-required="true"
                            onChange={(event) =>
                              updateDraftQuestion(question.slot_id, (current) => ({
                                ...current,
                                marks: Number(event.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="qz__question-edit-grid">
                          <label
                            className="qz__editor-label"
                            htmlFor={`qz-question-text-${question.slot_id}`}
                          >
                            نص السؤال <RequiredMark />
                          </label>
                          <textarea
                            id={`qz-question-text-${question.slot_id}`}
                            className="qz__edit-textarea"
                            rows={4}
                            value={question.question_text}
                            required
                            aria-required="true"
                            onChange={(event) =>
                              updateDraftQuestion(question.slot_id, (current) => ({
                                ...current,
                                question_text: event.target.value,
                              }))
                            }
                          />
                        </div>

                        {question.question_type === 'multiple_choice' ? (
                          <>
                            <div className="qz__question-edit-grid">
                              <label
                                className="qz__editor-label"
                                htmlFor={`qz-question-correct-${question.slot_id}`}
                              >
                                الخيار الصحيح <RequiredMark />
                              </label>
                              <select
                                id={`qz-question-correct-${question.slot_id}`}
                                className="qz__edit-select"
                                value={question.correct_option_index ?? 0}
                                required
                                aria-required="true"
                                onChange={(event) =>
                                  updateDraftQuestion(question.slot_id, (current) => ({
                                    ...current,
                                    correct_option_index: Number(event.target.value),
                                  }))
                                }
                              >
                                {(question.options ?? []).map((_, index) => (
                                  <option
                                    key={`${question.slot_id}-correct-${index}`}
                                    value={index}
                                  >
                                    الخيار {formatArabicNumber(index + 1)}
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
                                  <span>
                                    {formatArabicNumber(index + 1)}
                                    <span
                                      className="qz__required-star qz__required-star--inline"
                                      aria-hidden="true"
                                    >
                                      *
                                    </span>
                                  </span>
                                  <input
                                    type="text"
                                    className="qz__edit-input"
                                    value={option}
                                    required
                                    aria-required="true"
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
                            <label
                              className="qz__editor-label"
                              htmlFor={`qz-question-true-false-${question.slot_id}`}
                            >
                              الإجابة الصحيحة <RequiredMark />
                            </label>
                            <select
                              id={`qz-question-true-false-${question.slot_id}`}
                              className="qz__edit-select"
                              value={question.correct_answer ? 'true' : 'false'}
                              required
                              aria-required="true"
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
                            <label
                              className="qz__editor-label"
                              htmlFor={`qz-question-fill-blank-${question.slot_id}`}
                            >
                              الإجابة النموذجية <RequiredMark />
                            </label>
                            <textarea
                              id={`qz-question-fill-blank-${question.slot_id}`}
                              className="qz__edit-textarea"
                              rows={3}
                              value={question.answer_text}
                              required
                              aria-required="true"
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
                              <label
                                className="qz__editor-label"
                                htmlFor={`qz-question-open-answer-${question.slot_id}`}
                              >
                                الإجابة النموذجية <RequiredMark />
                              </label>
                              <textarea
                                id={`qz-question-open-answer-${question.slot_id}`}
                                className="qz__edit-textarea"
                                rows={4}
                                value={question.answer_text}
                                required
                                aria-required="true"
                                onChange={(event) =>
                                  updateDraftQuestion(question.slot_id, (current) => ({
                                    ...current,
                                    answer_text: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="qz__question-edit-grid">
                              <label
                                className="qz__editor-label"
                                htmlFor={`qz-question-rubric-${question.slot_id}`}
                              >
                                معيار التصحيح <RequiredMark />
                              </label>
                              <textarea
                                id={`qz-question-rubric-${question.slot_id}`}
                                className="qz__edit-textarea"
                                rows={4}
                                value={joinLines(question.rubric)}
                                required
                                aria-required="true"
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
                    </article>
                  ))}
                </div>
              ) : (
                <p className="qz__questions-empty">
                  لا توجد أسئلة بعد. أضف أول سؤال من الأسفل.
                </p>
              )}

              <DraftValidationBanner
                errors={draftValidationErrors}
                questions={examDraft?.questions ?? []}
              />

              <div className="qz__questions-footer">
                <div className="qz__field qz__field--inline qz__question-picker">
                  <label htmlFor="qz-new-question-type">
                    نوع السؤال <RequiredMark />
                  </label>
                  <select
                    id="qz-new-question-type"
                    value={newQuestionType}
                    required
                    aria-required="true"
                    onChange={(event) =>
                      setNewQuestionType(
                        event.target.value as ExamQuestion['question_type']
                      )
                    }
                  >
                    {QUESTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small>سيُضاف السؤال الجديد في نهاية الاختبار مباشرة.</small>
                </div>

                <button
                  type="button"
                  className="qz__details-action-btn qz__details-action-btn--primary qz__question-add-btn"
                  onClick={() => handleAddQuestion(newQuestionType)}
                >
                  <MdAdd aria-hidden />
                  إضافة سؤال جديد
                </button>
              </div>

              <div className="qz__questions-save-row">
                <button
                  type="button"
                  className="qz__details-action-btn qz__details-action-btn--primary qz__questions-save-btn"
                  onClick={() => void handleSaveExam()}
                  disabled={
                    isSavingExam ||
                    !examDraft ||
                    examDraft.questions.length === 0
                  }
                >
                  {isSavingExam && (
                    <span className="ui-button-spinner" aria-hidden />
                  )}
                  {!isSavingExam && <MdSave aria-hidden />}
                  {isSavingExam ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </section>
          ) : (
            <ExamPaperSheet
              title={selectedExam.title}
              schoolName={paperSchoolName}
              schoolLogoUrl={paperSchoolLogoUrl}
              classLabel={paperClassLabel}
              academicYearLabel={paperAcademicYearLabel}
              semesterLabel={`الفصل الدراسي ${paperSemesterLabel}`}
              totalMarks={selectedExam.total_marks}
              questions={displayedExamQuestions}
            />
          )}

          {!isEditingExam && selectedExam.blueprint?.cells ? (
            <section className="qz__blueprint qz__blueprint--paper">
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
          ) : null}

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
  ) : (
    <div className="qz__details">
      <h3>{examDetailsTitle}</h3>
      <p>اختر اختباراً من القائمة لعرض تفاصيله.</p>
    </div>
  );

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

  if (!isCreateRoute && selectedExam) {
    return (
      <div className="qz ui-loaded">
        <header className="qz__header page-header">
          <div>
            <nav className="qz__breadcrumb" aria-label="breadcrumb">
              <Link to="/quizzes" className="qz__breadcrumb-button">
                مكتبة الاختبارات
              </Link>
              <span>←</span>
              <span className="qz__breadcrumb-current">تفاصيل الاختبار</span>
            </nav>
            <h1>{toArabicDigits(selectedExam.title)}</h1>
            <p>
              {formatArabicNumber(selectedExam.total_questions)} سؤال |{' '}
              {formatArabicNumber(selectedExam.total_marks)} درجة
              {selectedExam.duration_minutes != null
                ? ` | مدة: ${formatArabicNumber(selectedExam.duration_minutes)} دقيقة`
                : ''}
            </p>
          </div>
        </header>

        {draftRecoveredNotice ? (
          <p className="ui-inline-notice ui-inline-notice--info">
            {draftRecoveredNotice}
          </p>
        ) : null}

        <section className="qz__content qz__detail-page" aria-live="polite">
          <Link to="/quizzes" className="qz__detail-back-btn qz__btn-edit">
            العودة إلى المكتبة
          </Link>
          {examDetailsView}
        </section>

        <ExportFormatModal
          isOpen={exportFormatOpen}
          title={
            exportTargetType === 'answer_key'
              ? 'تصدير نموذج الإجابات'
              : 'تصدير نموذج الاختبار'
          }
          onClose={() => setExportFormatOpen(false)}
          isSubmitting={isExportingExam}
          onConfirm={({ format }) => void handleExportSelectedExam(format)}
        />

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
            {isCreateRoute
              ? 'توليد الاختبارات بجدول المواصفات'
              : 'مكتبة الاختبارات'}
          </h1>
          <p>
            {isCreateRoute
              ? 'اختر العام الدراسي والفصل والصف والمادة والدروس، ثم حدد عدد الأسئلة والدرجة الكلية ليتم توليد اختبار موزون بشكل آلي وحفظه.'
              : 'عرض نظامي لجميع الاختبارات المولدة مع فلترة العرض والتفاصيل والتصدير.'}
          </p>
        </div>
      </header>

      {draftRecoveredNotice ? (
        <p className="ui-inline-notice ui-inline-notice--info">
          {draftRecoveredNotice}
        </p>
      ) : null}

      <div
        className={`qz__layout ${isCreateRoute ? 'qz__layout--creator' : 'qz__layout--admin'}`}
      >
        {isCreateRoute && examScreen === 'creator' ? (
          <aside className="qz__panel">
            <h2>إعداد الاختبار</h2>
            <div
              className="qz__requirement-note ui-inline-notice ui-inline-notice--info"
              role="note"
            >
              <strong>متطلبات توليد الاختبار:</strong> اختر مادة ودروساً تحتوي
              على <strong>خطط درس مولدة</strong> و<strong>أهداف تعلم</strong>.
              إن لم تكن الدروس تحتوي على خطط أو أهداف، سيظهر خطأ عند التوليد.
            </div>

            <ApiErrorBanner error={error} />

            <section className="qz__setup-card qz__setup-card--foundation">
              <div className="qz__setup-card-header" aria-hidden="true">
                <span className="qz__setup-step">٠١</span>
              </div>

              <div className="qz__selection-grid qz__selection-grid--foundation">
                <div className="qz__field">
                  <label htmlFor="qz-academic-year">العام الدراسي</label>
                  <select
                    id="qz-academic-year"
                    value={selectedAcademicYear}
                    onChange={(event) =>
                      handleAcademicYearChange(event.target.value)
                    }
                    disabled={isGenerating || isEditingExam}
                  >
                    {academicYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="qz__field">
                  <label htmlFor="qz-semester">الفصل الدراسي</label>
                  <select
                    id="qz-semester"
                    value={selectedSemester}
                    onChange={(event) =>
                      handleSemesterChange(event.target.value)
                    }
                    disabled={isGenerating || isEditingExam}
                  >
                    {SEMESTER_OPTIONS.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="qz__field">
                  <label htmlFor="qz-class">الصف</label>
                  <select
                    id="qz-class"
                    value={selectedClassId}
                    onChange={(event) => handleClassChange(event.target.value)}
                    disabled={isGenerating || isEditingExam}
                  >
                    <option value="">اختر الصف...</option>
                    {filteredClassGroups.map((group) => (
                      <option key={group.key} value={group.baseClass.id}>
                        {formatClassBaseSelectLabel(group.baseClass)}
                        {group.sections.length > 1
                          ? ` | الشعبة: ${formatCombinedSectionLabel(
                              group.sections
                            )}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section
              className={`qz__setup-card qz__setup-card--subject ${
                isSubjectSelectionLocked ? 'qz__setup-card--locked' : ''
              }`}
            >
              <div className="qz__setup-card-header">
                <span className="qz__setup-step">٠٢</span>
                <span className="qz__setup-card-icon" aria-hidden="true">
                  {isSubjectSelectionLocked ? <MdLock /> : <MdLockOpen />}
                </span>
              </div>

              <div className="qz__field qz__field--subject">
                <label htmlFor="qz-subject">المادة</label>
                <select
                  id="qz-subject"
                  value={selectedSubjectId}
                  onChange={(event) =>
                    void handleSubjectChange(event.target.value)
                  }
                  disabled={isSubjectSelectionLocked}
                >
                  <option value="">اختر المادة...</option>
                  {subjectsForSelectedClass.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {formatSubjectSelectLabel(
                        subject,
                        classesById.get(subject.class_id) ?? null
                      )}
                    </option>
                  ))}
                </select>
              </div>
            </section>

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
                placeholder={
                  selectedSubject && selectedClass
                    ? autoTitle(
                        selectedSubject.name,
                        selectedClass,
                        selectedAcademicYear,
                        selectedSemester
                      )
                    : 'عنوان الاختبار'
                }
                disabled={isGenerating || isEditingExam}
              />
            </div>

            <div className="qz__selection-grid qz__selection-grid--settings">
              <div className="qz__field">
                <label htmlFor="qz-total-questions">عدد الأسئلة</label>
                <input
                  id="qz-total-questions"
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(event) =>
                    setTotalQuestions(Number(event.target.value))
                  }
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
                  onChange={(event) =>
                    setTotalMarks(Number(event.target.value))
                  }
                  disabled={isGenerating || isEditingExam}
                />
              </div>
              <div className="qz__field">
                <label htmlFor="qz-duration-minutes">
                  زمن الاختبار (دقيقة)
                </label>
                <select
                  id="qz-duration-minutes"
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(Number(event.target.value))
                  }
                  disabled={isGenerating || isEditingExam}
                >
                  {LESSON_DURATION_OPTIONS.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} دقيقة
                    </option>
                  ))}
                </select>
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
                    <h4>{formatUnitDisplayLabel(unit.name)}</h4>
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
                          <small>
                            {formatArabicNumber(lesson.number_of_periods ?? 1)}{' '}
                            حصة
                          </small>
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
              disabled={
                isGenerating ||
                isEditingExam ||
                selectedSubjectId === '' ||
                selectedClassId === ''
              }
            >
              {isGenerating && (
                <span className="ui-button-spinner" aria-hidden />
              )}
              {!isGenerating && <MdAutoAwesome aria-hidden />}
              {isGenerating ? 'جارٍ التوليد...' : 'توليد الاختبار'}
            </button>
          </aside>
        ) : null}

        {isCreateRoute && examScreen === 'generated' && selectedExam ? (
          <section
            className="qz__content qz__generated-view"
            aria-live="polite"
          >
            {examDetailsView}
          </section>
        ) : null}

        {isCreateRoute && examScreen === 'confirmation' && selectedExam ? (
          <section className="qz__confirmation-view" aria-live="polite">
            <div className="qz__confirmation-card">
              <h2>تم إنشاء اختبار بنجاح ✓</h2>
              <article className="qz__confirmation-panel">
                <div className="qz__confirmation-banner" role="status">
                  <MdCheckCircle aria-hidden />
                  <span>تم حفظ الاختبار الجديد بنجاح.</span>
                </div>
                <h3>{toArabicDigits(selectedExam.title)}</h3>
                <p>
                  عدد الأسئلة:{' '}
                  {formatArabicNumber(selectedExam.total_questions)} | الدرجة:{' '}
                  {formatArabicNumber(selectedExam.total_marks)} | المدة:{' '}
                  {formatArabicNumber(
                    selectedExam.duration_minutes ?? durationMinutes
                  )}{' '}
                  د
                </p>
                <p>
                  العام الدراسي: {toArabicDigits(selectedAcademicYear)} | الفصل
                  الدراسي: {toArabicDigits(selectedSemester)} | الصف:{' '}
                  {toArabicDigits(selectedClass?.grade_label ?? '—')} | الشعبة:{' '}
                  {toArabicDigits(selectedClassSectionLabel)} | المادة:{' '}
                  {selectedSubject?.name ?? '—'}
                </p>
                <div className="qz__confirmation-actions">
                  <button
                    type="button"
                    className="qz__btn-save"
                    onClick={handleOpenGeneratedExamFromConfirmation}
                  >
                    عرض
                  </button>
                  <button
                    type="button"
                    className="qz__btn-cancel"
                    onClick={() => requestDeleteExam(selectedExam.public_id)}
                    disabled={isDeleting || isExamLoading}
                  >
                    حذف
                  </button>
                  <button
                    type="button"
                    className="qz__btn-edit"
                    onClick={handleCreateNewExam}
                  >
                    إنشاء اختبار جديد
                  </button>
                  <button
                    type="button"
                    className="qz__btn-edit"
                    onClick={() => navigate('/quizzes')}
                  >
                    مكتبة الاختبارات
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {!isCreateRoute ? (
          <section className="qz__content">
            <div className="qz__filters">
              <h2>فلترة عرض الاختبارات</h2>
              <div className="qz__filters-grid">
                {isAdmin ? (
                  <div className="qz__field">
                    <label htmlFor="qz-filter-teacher">فلترة باسم المعلم</label>
                    <select
                      id="qz-filter-teacher"
                      value={filterTeacherId}
                      onChange={(event) =>
                        setFilterTeacherId(
                          event.target.value ? Number(event.target.value) : ''
                        )
                      }
                      disabled={isEditingExam}
                    >
                      <option value="">الكل</option>
                      {teacherFilterOptions.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.display_name || teacher.username}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="qz__field">
                  <label htmlFor="qz-filter-subject">فلترة بالمادة</label>
                  <select
                    id="qz-filter-subject"
                    value={filterSubjectId}
                    onChange={(event) =>
                      setFilterSubjectId(
                        event.target.value ? Number(event.target.value) : ''
                      )
                    }
                    disabled={isEditingExam}
                  >
                    <option value="">الكل</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {formatSubjectSelectLabel(
                          subject,
                          classesById.get(subject.class_id) ?? null
                        )}
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
                      setFilterClassId(
                        event.target.value ? Number(event.target.value) : ''
                      )
                    }
                    disabled={isEditingExam}
                  >
                    <option value="">الكل</option>
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {formatClassSelectLabel(classItem)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qz__field">
                  <label htmlFor="qz-filter-semester">
                    فلترة بالفصل الدراسي
                  </label>
                  <select
                    id="qz-filter-semester"
                    value={filterSemester}
                    onChange={(event) => setFilterSemester(event.target.value)}
                    disabled={isEditingExam}
                  >
                    <option value="">الكل</option>
                    {semesterOptions.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qz__field">
                  <label htmlFor="qz-filter-academic-year">
                    فلترة بالعام الدراسي
                  </label>
                  <select
                    id="qz-filter-academic-year"
                    value={filterAcademicYear}
                    onChange={(event) =>
                      setFilterAcademicYear(event.target.value)
                    }
                    disabled={isEditingExam}
                  >
                    <option value="">الكل</option>
                    {academicYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="qz__filters-actions">
                <button
                  type="button"
                  className="qz__refresh-btn"
                  onClick={clearArchiveFilters}
                  disabled={
                    isEditingExam ||
                    (!filterTeacherId &&
                      !filterSubjectId &&
                      !filterClassId &&
                      !filterSemester &&
                      !filterAcademicYear)
                  }
                >
                  مسح الكل
                </button>
                <button
                  type="button"
                  className="qz__refresh-btn"
                  onClick={() => void loadExams()}
                  disabled={isListLoading || isEditingExam}
                >
                  {isListLoading && (
                    <span className="ui-button-spinner" aria-hidden />
                  )}
                  {!isListLoading && <MdRefresh aria-hidden />}
                  {isListLoading ? 'جارٍ التحديث...' : 'تحديث القائمة'}
                </button>
              </div>
            </div>

            <div className="qz__archive-and-details">
              <div className="qz__archive">
                <div className="qz__archive-head">
                  <div>
                    <h3>الاختبارات المحفوظة ({filteredExams.length})</h3>
                    <p>عرض مركّز وسريع للاختبارات المحفوظة حديثًا.</p>
                  </div>
                  <span className="qz__archive-count">
                    {filteredExams.length}
                  </span>
                </div>
                {isListLoading ? (
                  <p>جارٍ تحميل الاختبارات...</p>
                ) : filteredExams.length === 0 ? (
                  <p>لا توجد اختبارات محفوظة.</p>
                ) : (
                  filteredExams.map((exam) => {
                    const subject = subjectsById.get(exam.subject_id);
                    const classItem = classesById.get(exam.class_id);
                    const isActive = selectedExam?.public_id === exam.public_id;
                    const canExportExam = !isLocalOnlyId(exam.public_id);
                    const classLabel = classItem
                      ? [classItem.grade_label, classItem.section_label]
                          .map((value) => value?.trim() ?? '')
                          .filter(Boolean)
                          .join(' - ')
                      : `صف #${exam.class_id}`;
                    const metadataParts = [
                      subject?.name ?? `مادة #${exam.subject_id}`,
                      classLabel,
                      formatDateTimeAr(exam.created_at),
                    ];
                    const summaryParts = formatExamSummaryParts(exam);
                    return (
                      <article
                        key={exam.public_id}
                        className={`qz__exam-card animate-fadeIn ${
                          isActive ? 'qz__exam-card--active' : ''
                        }`}
                      >
                        <div className="qz__exam-topline">
                          <div className="qz__exam-heading">
                            <h4>
                              <button
                                type="button"
                                className="qz__exam-title-button"
                                onClick={() =>
                                  navigate(`/quizzes/${exam.public_id}`)
                                }
                                disabled={isExamLoading || isEditingExam}
                              >
                                {exam.title}
                              </button>
                            </h4>
                            <div
                              className="qz__exam-meta-line"
                              aria-label="تفاصيل الاختبار"
                            >
                              {metadataParts.map((part, index) => (
                                <Fragment
                                  key={`${exam.public_id}-${part}-${index}`}
                                >
                                  {index > 0 ? (
                                    <span
                                      className="qz__meta-separator"
                                      aria-hidden
                                    >
                                      |
                                    </span>
                                  ) : null}
                                  <span className="qz__meta-item">{part}</span>
                                </Fragment>
                              ))}
                            </div>
                            <div
                              className="qz__exam-summary-line"
                              aria-label="ملخص الاختبار"
                            >
                              {summaryParts.map((part, index) => (
                                <Fragment
                                  key={`${exam.public_id}-summary-${part}-${index}`}
                                >
                                  {index > 0 ? (
                                    <span
                                      className="qz__meta-separator"
                                      aria-hidden
                                    >
                                      |
                                    </span>
                                  ) : null}
                                  <span className="qz__meta-item">{part}</span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="qz__card-actions">
                          <button
                            type="button"
                            className="qz__card-action"
                            onClick={() =>
                              navigate(`/quizzes/${exam.public_id}`)
                            }
                            disabled={isExamLoading || isEditingExam}
                          >
                            عرض
                          </button>
                          <button
                            type="button"
                            className="qz__card-action qz__card-action--danger"
                            onClick={() => requestDeleteExam(exam.public_id)}
                            disabled={isDeleting || isEditingExam}
                          >
                            حذف
                          </button>
                          <button
                            type="button"
                            className="qz__card-action qz__card-action--subtle"
                            onClick={() =>
                              navigate(
                                `/quizzes/${exam.public_id}?export=questions_only`
                              )
                            }
                            disabled={!canExportExam || isExportingExam}
                          >
                            تصدير
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <ExportFormatModal
        isOpen={exportFormatOpen}
        title={
          exportTargetType === 'answer_key'
            ? 'تصدير نموذج الإجابات'
            : 'تصدير نموذج الاختبار'
        }
        onClose={() => setExportFormatOpen(false)}
        isSubmitting={isExportingExam}
        onConfirm={({ format }) => void handleExportSelectedExam(format)}
      />

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

      {isTeacher && selectedSubject && (
        <footer className="qz__subject-meta">
          المادة المختارة: {selectedSubject.name}
        </footer>
      )}
    </div>
  );
}
