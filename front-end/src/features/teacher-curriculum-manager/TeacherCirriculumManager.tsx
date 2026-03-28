import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdMenuBook,
  MdSchool,
  MdSubject,
  MdViewModule,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import {
  ACADEMIC_YEAR_OPTIONS,
  GRADE_OPTIONS,
  LESSON_PERIOD_COUNT_OPTIONS,
  LESSON_DURATION_OPTIONS,
  PERIOD_OPTIONS,
  SEMESTER_OPTIONS,
} from '../../constants/dropdown-options';
import type {
  Class,
  Lesson,
  LessonContentType,
  Subject,
  Unit,
} from '../../types';
import {
  getScopedClasses,
  getScopedSubjects,
} from '../control-dashboard/control-dashboard.services';
import {
  createClass,
  createLesson,
  createSubject,
  createUnit,
  deleteClass,
  deleteLesson,
  deleteSubject,
  deleteUnit,
  getMyClasses,
  getMyLessons,
  getMySubjects,
  getMyUnits,
  updateClass,
  updateLesson,
  updateSubject,
  updateUnit,
  type CreateLessonResponse,
} from './teacher-curriculum-manager.services';
import {
  formatClassSelectLabel,
  formatClassShortLabel,
  formatSubjectSelectLabel,
  isSameClassIdentity,
  normalizeAcademicYearLabel,
  normalizeSemesterLabel,
} from '../../utils/classDisplay';
import {
  getScopedLessons,
  getScopedUnits,
} from '../control-dashboard/control-dashboard.services';
import './teacher-cirriculum-manager.css';

export interface TeacherCirriculumManagerScope {
  role: 'admin';
  selectedTeacherId: number;
}

type SelectValue = number | '';
type ClassMode = 'existing' | 'new';
type LessonMode = 'skip' | 'new';
type EntityKind = 'class' | 'subject' | 'unit' | 'lesson';

interface SearchSuggestion {
  id: number;
  label: string;
  description?: string | null;
}

interface ApiErrorShape {
  response?: {
    data?: {
      error?: string | { message?: string; code?: string };
    };
  };
  message?: string;
}

interface EditDraft {
  kind: EntityKind;
  id: number;
  name: string;
  description: string;
  gradeLabel?: string;
  semester?: string;
  sectionLabel?: string;
  section?: string;
  academicYear?: string;
  defaultDurationMinutes?: number;
  content?: string;
  contentType?: LessonContentType;
  file?: File | null;
  unitId?: number;
  numberOfPeriods?: number;
  periodNumber?: number;
}

interface QuickAddDraft {
  kind: EntityKind;
  name: string;
  description: string;
  classId?: number;
  subjectId?: number;
  unitId?: number;
  gradeLabel?: string;
  semester?: string;
  sectionLabel?: string;
  section?: string;
  academicYear?: string;
  defaultDurationMinutes?: number;
  contentType?: LessonContentType;
  content?: string;
  file?: File | null;
  numberOfPeriods?: number;
  periodNumber?: number;
}

interface DeleteRequestDraft {
  kind: EntityKind;
  id: number;
  label: string;
  endpoint: string;
  payload?: Record<string, unknown>;
}

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

function getErrorMessage(
  error: unknown,
  fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'
): string {
  if (error && typeof error === 'object') {
    const parsed = error as ApiErrorShape;
    const backendError = parsed.response?.data?.error;
    if (typeof backendError === 'string' && backendError.trim().length > 0) {
      return backendError;
    }
    if (
      backendError &&
      typeof backendError === 'object' &&
      typeof backendError.message === 'string' &&
      backendError.message.trim().length > 0
    ) {
      return backendError.message;
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

function isPdfFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return file.type === 'application/pdf' || lowerName.endsWith('.pdf');
}

function isDocxFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  );
}

function matchesLessonFileType(
  file: File,
  contentType: Exclude<LessonContentType, 'text'>
): boolean {
  return contentType === 'pdf' ? isPdfFile(file) : isDocxFile(file);
}

function validateLessonFile(
  file: File | null,
  contentType: Exclude<LessonContentType, 'text'>
): string | null {
  if (!file) {
    return 'اختر ملف الدرس.';
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'حجم الملف أكبر من 25 ميجابايت.';
  }
  if (!matchesLessonFileType(file, contentType)) {
    return contentType === 'pdf'
      ? 'الملف يجب أن يكون PDF.'
      : 'الملف يجب أن يكون DOCX.';
  }
  return null;
}

function normalizeLookupText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function matchesLookupQuery(value: string, query: string): boolean {
  const normalizedQuery = normalizeLookupText(query).toLowerCase();
  if (!normalizedQuery) {
    return false;
  }
  return normalizeLookupText(value).toLowerCase().includes(normalizedQuery);
}

function SearchablePickerField(props: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  statusText?: string;
  suggestions: SearchSuggestion[];
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
  disabled?: boolean;
}) {
  const {
    id,
    label,
    value,
    placeholder,
    helperText,
    statusText,
    suggestions,
    onChange,
    onSelectSuggestion,
    disabled,
  } = props;

  return (
    <div className="tcm2__field">
      <label htmlFor={id}>{label}</label>
      <div className="tcm2__picker">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        {helperText ? <small>{helperText}</small> : null}
        {statusText ? (
          <small className="tcm2__picker-status">{statusText}</small>
        ) : null}
        {value.trim().length > 0 && suggestions.length > 0 ? (
          <div className="tcm2__picker-results" role="listbox">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="tcm2__picker-result"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelectSuggestion(suggestion);
                }}
              >
                <strong>{suggestion.label}</strong>
                {suggestion.description ? (
                  <span>{suggestion.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getLessonCreationMessage(result: CreateLessonResponse): string {
  if (result.message) {
    return result.message;
  }
  if (result.content_type === 'text') {
    return 'تم إنشاء الدرس النصي بنجاح.';
  }
  return 'تم إنشاء الدرس بنجاح.';
}

function TeacherCirriculumManager(props: {
  scope?: TeacherCirriculumManagerScope;
}) {
  const { scope } = props;
  const { user } = useAuth();
  const navigate = useNavigate();
  const curriculumLoadRequestIdRef = useRef(0);

  const teacherId =
    scope?.role === 'admin' ? scope.selectedTeacherId : (user?.id ?? 0);
  const preferredDefaultDuration =
    user?.profile?.default_lesson_duration_minutes ?? 45;
  const resolvedDefaultDuration = LESSON_DURATION_OPTIONS.includes(
    preferredDefaultDuration as (typeof LESSON_DURATION_OPTIONS)[number]
  )
    ? preferredDefaultDuration
    : 45;

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(
    new Set()
  );

  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');
  const [classSelectionMode, setClassSelectionMode] =
    useState<ClassMode>('existing');
  const [existingClassYearFilter, setExistingClassYearFilter] = useState('');
  const [existingClassSemesterFilter, setExistingClassSemesterFilter] =
    useState('');
  const [existingClassGradeFilter, setExistingClassGradeFilter] = useState('');
  const [newClassAcademicYear, setNewClassAcademicYear] = useState<string>(
    ACADEMIC_YEAR_OPTIONS[0]
  );
  const [newClassSemester, setNewClassSemester] = useState<string>(
    SEMESTER_OPTIONS[0]
  );
  const [newClassGradeLabel, setNewClassGradeLabel] = useState('');
  const [newClassSectionLabel, setNewClassSectionLabel] = useState('');
  const [newClassDefaultDuration, setNewClassDefaultDuration] =
    useState<number>(() => resolvedDefaultDuration);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraft | null>(
    null
  );
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequestDraft | null>(
    null
  );
  const [showCreatorFlow, setShowCreatorFlow] = useState(false);

  const [creatorClassMode, setCreatorClassMode] =
    useState<ClassMode>('existing');
  const [creatorExistingClassId, setCreatorExistingClassId] =
    useState<SelectValue>('');
  const [creatorNewClassGradeLabel, setCreatorNewClassGradeLabel] =
    useState('');
  const [creatorNewClassSemester, setCreatorNewClassSemester] =
    useState<string>(SEMESTER_OPTIONS[0]);
  const [creatorNewClassSectionLabel, setCreatorNewClassSectionLabel] =
    useState('');
  const [creatorNewClassAcademicYear, setCreatorNewClassAcademicYear] =
    useState<string>(ACADEMIC_YEAR_OPTIONS[0]);
  const [creatorNewClassDefaultDuration, setCreatorNewClassDefaultDuration] =
    useState<number>(() => resolvedDefaultDuration);

  const [creatorSubjectName, setCreatorSubjectName] = useState('');
  const [creatorNewSubjectDescription, setCreatorNewSubjectDescription] =
    useState('');

  const [creatorUnitName, setCreatorUnitName] = useState('');
  const [creatorNewUnitDescription, setCreatorNewUnitDescription] =
    useState('');

  const [creatorLessonMode, setCreatorLessonMode] =
    useState<LessonMode>('skip');
  const [creatorLessonName, setCreatorLessonName] = useState('');
  const [creatorLessonDescription, setCreatorLessonDescription] = useState('');
  const [creatorLessonContentType, setCreatorLessonContentType] =
    useState<LessonContentType>('text');
  const [creatorLessonNumberOfPeriods, setCreatorLessonNumberOfPeriods] =
    useState<number>(1);
  const [creatorLessonPeriodNumber, setCreatorLessonPeriodNumber] =
    useState<number>(1);
  const [creatorLessonTextContent, setCreatorLessonTextContent] = useState('');
  const [creatorLessonFile, setCreatorLessonFile] = useState<File | null>(null);

  const selectedClass =
    selectedClassId === ''
      ? null
      : (classes.find((classItem) => classItem.id === selectedClassId) ?? null);
  const selectedSubject =
    selectedSubjectId === ''
      ? null
      : (subjects.find((subjectItem) => subjectItem.id === selectedSubjectId) ??
        null);

  const selectedSubjectUnits = useMemo(
    () => units.filter((unitItem) => unitItem.subject_id === selectedSubjectId),
    [units, selectedSubjectId]
  );

  const lessonsByUnit = useMemo<Record<number, Lesson[]>>(() => {
    return lessons.reduce<Record<number, Lesson[]>>(
      (accumulator, lessonItem) => {
        const nextLessons = accumulator[lessonItem.unit_id] ?? [];
        nextLessons.push(lessonItem);
        accumulator[lessonItem.unit_id] = nextLessons;
        return accumulator;
      },
      {}
    );
  }, [lessons]);

  const classByIdMap = useMemo(
    () =>
      new Map<number, Class>(
        classes.map((classItem) => [classItem.id, classItem])
      ),
    [classes]
  );

  const orderedSubjects = useMemo<Subject[]>(() => {
    return [...subjects].sort((left, right) => {
      const leftClass = classByIdMap.get(left.class_id);
      const rightClass = classByIdMap.get(right.class_id);
      const leftClassLabel = leftClass
        ? formatClassSelectLabel(leftClass)
        : `#${left.class_id}`;
      const rightClassLabel = rightClass
        ? formatClassSelectLabel(rightClass)
        : `#${right.class_id}`;

      const classComparison = leftClassLabel.localeCompare(
        rightClassLabel,
        'ar'
      );
      if (classComparison !== 0) {
        return classComparison;
      }

      return left.name.localeCompare(right.name, 'ar');
    });
  }, [subjects, classByIdMap]);

  const creatorResolvedClassId =
    creatorClassMode === 'existing' && creatorExistingClassId !== ''
      ? creatorExistingClassId
      : null;

  const creatorSubjectMatch = useMemo(() => {
    if (creatorResolvedClassId === null) {
      return null;
    }

    const normalizedSubjectName = normalizeLookupText(creatorSubjectName);
    if (!normalizedSubjectName) {
      return null;
    }

    return (
      subjects.find(
        (subjectItem) =>
          subjectItem.class_id === creatorResolvedClassId &&
          normalizeLookupText(subjectItem.name) === normalizedSubjectName
      ) ?? null
    );
  }, [creatorResolvedClassId, creatorSubjectName, subjects]);

  const creatorUnitMatch = useMemo(() => {
    if (!creatorSubjectMatch) {
      return null;
    }

    const normalizedUnitName = normalizeLookupText(creatorUnitName);
    if (!normalizedUnitName) {
      return null;
    }

    return (
      units.find(
        (unitItem) =>
          unitItem.subject_id === creatorSubjectMatch.id &&
          normalizeLookupText(unitItem.name) === normalizedUnitName
      ) ?? null
    );
  }, [creatorSubjectMatch, creatorUnitName, units]);

  const creatorSubjectSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (creatorResolvedClassId === null) {
      return [];
    }

    const normalizedQuery = normalizeLookupText(creatorSubjectName);
    if (!normalizedQuery) {
      return [];
    }

    return subjects
      .filter(
        (subjectItem) =>
          subjectItem.class_id === creatorResolvedClassId &&
          matchesLookupQuery(subjectItem.name, normalizedQuery)
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      .slice(0, 6)
      .map((subjectItem) => ({
        id: subjectItem.id,
        label: subjectItem.name,
        description: subjectItem.description ?? null,
      }));
  }, [creatorResolvedClassId, creatorSubjectName, subjects]);

  const creatorUnitSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!creatorSubjectMatch) {
      return [];
    }

    const normalizedQuery = normalizeLookupText(creatorUnitName);
    if (!normalizedQuery) {
      return [];
    }

    return units
      .filter(
        (unitItem) =>
          unitItem.subject_id === creatorSubjectMatch.id &&
          matchesLookupQuery(unitItem.name, normalizedQuery)
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      .slice(0, 6)
      .map((unitItem) => ({
        id: unitItem.id,
        label: unitItem.name,
        description: unitItem.description ?? null,
      }));
  }, [creatorSubjectMatch, creatorUnitName, units]);

  const quickAddSubjectSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (
      !quickAddDraft ||
      quickAddDraft.kind !== 'subject' ||
      !quickAddDraft.classId
    ) {
      return [];
    }

    const normalizedQuery = normalizeLookupText(quickAddDraft.name);
    if (!normalizedQuery) {
      return [];
    }

    return subjects
      .filter(
        (subjectItem) =>
          subjectItem.class_id === quickAddDraft.classId &&
          matchesLookupQuery(subjectItem.name, normalizedQuery)
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      .slice(0, 6)
      .map((subjectItem) => ({
        id: subjectItem.id,
        label: subjectItem.name,
        description: subjectItem.description ?? null,
      }));
  }, [quickAddDraft, subjects]);

  const quickAddUnitSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (
      !quickAddDraft ||
      quickAddDraft.kind !== 'unit' ||
      !quickAddDraft.subjectId
    ) {
      return [];
    }

    const normalizedQuery = normalizeLookupText(quickAddDraft.name);
    if (!normalizedQuery) {
      return [];
    }

    return units
      .filter(
        (unitItem) =>
          unitItem.subject_id === quickAddDraft.subjectId &&
          matchesLookupQuery(unitItem.name, normalizedQuery)
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      .slice(0, 6)
      .map((unitItem) => ({
        id: unitItem.id,
        label: unitItem.name,
        description: unitItem.description ?? null,
      }));
  }, [quickAddDraft, units]);

  const filteredExistingClasses = classes.filter((classItem) => {
    if (
      existingClassYearFilter &&
      normalizeAcademicYearLabel(classItem.academic_year) !==
        normalizeAcademicYearLabel(existingClassYearFilter)
    ) {
      return false;
    }

    if (existingClassSemesterFilter) {
      if (
        normalizeSemesterLabel(classItem.semester) !==
        existingClassSemesterFilter
      ) {
        return false;
      }
    }

    if (
      existingClassGradeFilter &&
      (classItem.grade_label?.trim() ?? '') !== existingClassGradeFilter
    ) {
      return false;
    }

    return true;
  });

  const existingClassYearOptions = Array.from(
    new Set([
      ...ACADEMIC_YEAR_OPTIONS,
      ...classes
        .map((classItem) => normalizeAcademicYearLabel(classItem.academic_year))
        .filter((value) => value.trim().length > 0),
    ])
  );

  const duplicateNewClass = classes.find((classItem) =>
    isSameClassIdentity(classItem, {
      academicYear: newClassAcademicYear,
      semester: newClassSemester,
      gradeLabel: newClassGradeLabel,
      sectionLabel: newClassSectionLabel,
    })
  );

  const totalLessons = selectedSubjectUnits.reduce(
    (sum, unitItem) => sum + (lessonsByUnit[unitItem.id]?.length ?? 0),
    0
  );

  const isNewClassFormValid =
    newClassAcademicYear.trim().length > 0 &&
    newClassSemester.trim().length > 0 &&
    newClassGradeLabel.trim().length > 0 &&
    newClassSectionLabel.trim().length > 0 &&
    Number.isInteger(newClassDefaultDuration) &&
    newClassDefaultDuration > 0 &&
    !duplicateNewClass;

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      toast.success(success);
    }
  }, [success]);

  const isCreatorValid = (() => {
    const hasExistingClass = creatorClassMode === 'existing';
    const hasNewClass =
      creatorClassMode === 'new' &&
      creatorNewClassGradeLabel.trim().length > 0 &&
      creatorNewClassSemester.trim().length > 0 &&
      creatorNewClassSectionLabel.trim().length > 0 &&
      creatorNewClassAcademicYear.trim().length > 0 &&
      Number.isInteger(creatorNewClassDefaultDuration) &&
      creatorNewClassDefaultDuration > 0;

    if (hasExistingClass && creatorExistingClassId === '') {
      return false;
    }
    if (creatorClassMode === 'new' && !hasNewClass) {
      return false;
    }

    const subjectName = normalizeLookupText(creatorSubjectName);
    const unitName = normalizeLookupText(creatorUnitName);

    if (!subjectName && (unitName.length > 0 || creatorLessonMode === 'new')) {
      return false;
    }
    if (subjectName && unitName.length > 0 && creatorLessonMode === 'new') {
      if (!creatorLessonName.trim()) {
        return false;
      }
    }
    if (unitName.length > 0 && !subjectName) {
      return false;
    }
    if (creatorLessonMode !== 'new') {
      return true;
    }
    if (!subjectName || !unitName) {
      return false;
    }
    if (
      !creatorLessonName.trim() ||
      !Number.isInteger(creatorLessonPeriodNumber) ||
      creatorLessonPeriodNumber <= 0 ||
      !Number.isInteger(creatorLessonNumberOfPeriods) ||
      creatorLessonNumberOfPeriods <= 0
    ) {
      return false;
    }

    if (creatorLessonContentType === 'text') {
      return creatorLessonTextContent.trim().length > 0;
    }

    if (!creatorLessonFile || creatorLessonFile.size > MAX_UPLOAD_SIZE_BYTES) {
      return false;
    }

    return (
      validateLessonFile(
        creatorLessonFile,
        creatorLessonContentType as Exclude<LessonContentType, 'text'>
      ) === null
    );
  })();

  const isQuickAddValid = (() => {
    if (!quickAddDraft) {
      return false;
    }

    if (quickAddDraft.kind === 'class') {
      return Boolean(
        quickAddDraft.gradeLabel?.trim() &&
        quickAddDraft.semester?.trim() &&
        quickAddDraft.sectionLabel?.trim() &&
        quickAddDraft.academicYear?.trim() &&
        Number.isInteger(quickAddDraft.defaultDurationMinutes) &&
        Number(quickAddDraft.defaultDurationMinutes) > 0
      );
    }

    if (quickAddDraft.kind === 'subject') {
      return Boolean(quickAddDraft.classId && quickAddDraft.name.trim());
    }

    if (quickAddDraft.kind === 'unit') {
      return Boolean(quickAddDraft.subjectId && quickAddDraft.name.trim());
    }

    if (quickAddDraft.kind === 'lesson') {
      if (
        !quickAddDraft.name.trim() ||
        !quickAddDraft.unitId ||
        !Number.isInteger(quickAddDraft.periodNumber) ||
        Number(quickAddDraft.periodNumber) <= 0 ||
        !Number.isInteger(quickAddDraft.numberOfPeriods) ||
        Number(quickAddDraft.numberOfPeriods) <= 0
      ) {
        return false;
      }
      if (quickAddDraft.contentType === 'text') {
        return Boolean(quickAddDraft.content?.trim());
      }
      if (
        !quickAddDraft.file ||
        quickAddDraft.file.size > MAX_UPLOAD_SIZE_BYTES
      ) {
        return false;
      }
      return (
        validateLessonFile(
          quickAddDraft.file,
          (quickAddDraft.contentType === 'pdf' ? 'pdf' : 'word') as Exclude<
            LessonContentType,
            'text'
          >
        ) === null
      );
    }

    return true;
  })();

  const ensureUnitExpanded = useCallback((unitId: number) => {
    setExpandedUnitIds((previous) => {
      const next = new Set(previous);
      next.add(unitId);
      return next;
    });
  }, []);

  const loadCurriculumData = useCallback(async () => {
    const requestId = ++curriculumLoadRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const isAdminScoped =
        scope?.role === 'admin' && scope?.selectedTeacherId != null;

      const [
        classesResponse,
        subjectsResponse,
        unitsResponse,
        lessonsResponse,
      ] = await Promise.all([
        isAdminScoped ? getScopedClasses('admin') : getMyClasses(),
        isAdminScoped ? getScopedSubjects('admin') : getMySubjects(),
        isAdminScoped ? getScopedUnits('admin') : getMyUnits(),
        isAdminScoped ? getScopedLessons('admin') : getMyLessons(),
      ]);

      if (requestId !== curriculumLoadRequestIdRef.current) {
        return;
      }

      const teacherFilterId = isAdminScoped ? scope.selectedTeacherId : null;
      const nextClasses = teacherFilterId
        ? (classesResponse.classes ?? []).filter(
            (classItem) => classItem.teacher_id === teacherFilterId
          )
        : (classesResponse.classes ?? []);
      const nextSubjects = teacherFilterId
        ? (subjectsResponse.subjects ?? []).filter(
            (subjectItem) => subjectItem.teacher_id === teacherFilterId
          )
        : (subjectsResponse.subjects ?? []);
      const nextUnits = teacherFilterId
        ? (unitsResponse.units ?? []).filter(
            (unitItem) => unitItem.teacher_id === teacherFilterId
          )
        : (unitsResponse.units ?? []);
      const nextLessons = teacherFilterId
        ? (lessonsResponse.lessons ?? []).filter(
            (lessonItem) => lessonItem.teacher_id === teacherFilterId
          )
        : (lessonsResponse.lessons ?? []);

      setClasses(nextClasses);
      setSubjects(nextSubjects);
      setUnits(nextUnits);
      setLessons(nextLessons);
      setSelectedClassId('');
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
    } catch (loadError: unknown) {
      if (requestId === curriculumLoadRequestIdRef.current) {
        setError(getErrorMessage(loadError, 'فشل تحميل بيانات المنهج.'));
      }
    } finally {
      if (requestId === curriculumLoadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [scope?.role, scope?.selectedTeacherId]);

  const activateSubjectView = useCallback(
    (subjectId: number, classId: number, nextUnits: Unit[] = units) => {
      setSelectedClassId(classId);
      setSelectedSubjectId(subjectId);
      setExpandedUnitIds(
        new Set(
          nextUnits
            .filter((unitItem) => unitItem.subject_id === subjectId)
            .map((unitItem) => unitItem.id)
        )
      );
    },
    [units]
  );

  const resetCreatorForm = () => {
    setCreatorClassMode('existing');
    setCreatorExistingClassId('');
    setCreatorNewClassGradeLabel('');
    setCreatorNewClassSemester(SEMESTER_OPTIONS[0]);
    setCreatorNewClassSectionLabel('');
    setCreatorNewClassAcademicYear(ACADEMIC_YEAR_OPTIONS[0]);
    setCreatorNewClassDefaultDuration(resolvedDefaultDuration);
    setCreatorSubjectName('');
    setCreatorNewSubjectDescription('');
    setCreatorUnitName('');
    setCreatorNewUnitDescription('');
    setCreatorLessonMode('skip');
    setCreatorLessonName('');
    setCreatorLessonDescription('');
    setCreatorLessonContentType('text');
    setCreatorLessonNumberOfPeriods(1);
    setCreatorLessonPeriodNumber(1);
    setCreatorLessonTextContent('');
    setCreatorLessonFile(null);
  };

  useEffect(() => {
    if (!user) {
      navigate('/authentication');
      return;
    }
    if (!scope && user.userRole === 'admin') {
      navigate('/admin');
    }
  }, [user, scope, navigate]);

  // Load classes and subjects on mount (or when admin scope teacher changes).
  useEffect(() => {
    const isAdminScoped = scope?.role === 'admin' && scope?.selectedTeacherId;
    const isTeacher = user?.userRole === 'teacher';
    if (!isTeacher && !isAdminScoped) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError(
          (prev) => prev ?? 'تعذر تحميل بيانات المنهج. تحقق من الاتصال بالخادم.'
        );
        toast.error('تعذر تحميل بيانات المنهج. تحقق من الاتصال بالخادم.');
      }
    }, 15_000);

    void loadCurriculumData().finally(() => {
      if (!cancelled) {
        window.clearTimeout(timeoutId);
      }
    });

    return () => {
      cancelled = true;
      curriculumLoadRequestIdRef.current += 1;
      window.clearTimeout(timeoutId);
    };
  }, [
    loadCurriculumData,
    scope?.role,
    scope?.selectedTeacherId,
    user?.userRole,
  ]);

  useEffect(() => {
    if (selectedSubjectId === '') {
      setExpandedUnitIds(new Set());
      return;
    }

    setExpandedUnitIds(
      new Set(selectedSubjectUnits.map((unitItem) => unitItem.id))
    );
  }, [selectedSubjectId, selectedSubjectUnits]);

  // When not in admin scope: show loading until user is known; hide view only for non-teachers.
  if (!scope) {
    if (user == null) {
      return (
        <div className="ui-loading-screen">
          <div className="ui-loading-shell">
            <span className="ui-spinner" aria-hidden />
          </div>
        </div>
      );
    }
    if (user.userRole !== 'teacher') {
      return null;
    }
  }

  if (loading) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  const handleClassChange = (nextValue: SelectValue) => {
    setError(null);
    setSuccess(null);
    setClassSelectionMode('existing');
    setSelectedClassId(nextValue);

    if (nextValue === '') {
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
      return;
    }

    if (!selectedSubject || selectedSubject.class_id !== nextValue) {
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
    }
  };

  const handleSubjectChange = (nextValue: SelectValue) => {
    setError(null);
    setSuccess(null);
    setSelectedSubjectId(nextValue);

    if (nextValue === '') {
      setExpandedUnitIds(new Set());
      return;
    }

    const nextSubject =
      subjects.find((subjectItem) => subjectItem.id === nextValue) ?? null;
    if (nextSubject && selectedClassId !== nextSubject.class_id) {
      setSelectedClassId(nextSubject.class_id);
    }
  };

  const handleCreateClassFromSelector = async () => {
    if (!teacherId) {
      setError('المعلم غير معروف. سجل الدخول مرة أخرى.');
      return;
    }

    if (duplicateNewClass) {
      setError('هذا الصف محفوظ مسبقاً بنفس بيانات العام والفصل والشعبة.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createClass({
        grade_label: newClassGradeLabel.trim(),
        semester: newClassSemester.trim(),
        section_label: newClassSectionLabel.trim(),
        section: 'أ',
        academic_year: normalizeAcademicYearLabel(newClassAcademicYear),
        default_duration_minutes: newClassDefaultDuration,
        teacher_id: teacherId,
      });

      setClasses((previous) =>
        previous.some((classItem) => classItem.id === response.class.id)
          ? previous.map((classItem) =>
              classItem.id === response.class.id ? response.class : classItem
            )
          : [...previous, response.class]
      );
      setExistingClassYearFilter(
        normalizeAcademicYearLabel(newClassAcademicYear)
      );
      setExistingClassSemesterFilter(newClassSemester);
      setExistingClassGradeFilter(newClassGradeLabel);
      setClassSelectionMode('existing');
      setSelectedClassId(response.class.id);
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
      setNewClassSectionLabel('');
      setSuccess('تم إنشاء الصف والشعبة بنجاح.');
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'تعذّر إنشاء الصف.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleUnitExpansion = (unitId: number) => {
    setExpandedUnitIds((previous) => {
      const next = new Set(previous);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const openQuickAddClass = () => {
    setClassSelectionMode('new');
    setNewClassAcademicYear(ACADEMIC_YEAR_OPTIONS[0]);
    setNewClassSemester(SEMESTER_OPTIONS[0]);
    setNewClassGradeLabel('');
    setNewClassSectionLabel('');
    setNewClassDefaultDuration(resolvedDefaultDuration);
  };

  const openQuickAddSubject = (classId: number) => {
    setQuickAddDraft({
      kind: 'subject',
      classId,
      name: '',
      description: '',
    });
  };

  const openQuickAddUnit = (subjectId: number) => {
    setQuickAddDraft({
      kind: 'unit',
      subjectId,
      name: '',
      description: '',
    });
  };

  const openQuickAddLesson = (unitId: number) => {
    setQuickAddDraft({
      kind: 'lesson',
      unitId,
      name: '',
      description: '',
      contentType: 'text',
      content: '',
      file: null,
      periodNumber: 1,
      numberOfPeriods: 1,
    });
  };

  const handleQuickAddSubmit = async () => {
    if (!quickAddDraft) {
      return;
    }
    if (!teacherId) {
      setError('المعلم غير معروف. سجل الدخول مرة أخرى.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (quickAddDraft.kind === 'class') {
        const response = await createClass({
          grade_label: quickAddDraft.gradeLabel?.trim() ?? '',
          semester: quickAddDraft.semester?.trim() ?? '',
          section_label: quickAddDraft.sectionLabel?.trim() ?? '',
          section: quickAddDraft.section?.trim() || 'أ',
          academic_year: normalizeAcademicYearLabel(
            quickAddDraft.academicYear?.trim() ?? ''
          ),
          default_duration_minutes: quickAddDraft.defaultDurationMinutes ?? 45,
          teacher_id: teacherId,
        });
        setClasses((previous) =>
          previous.some((classItem) => classItem.id === response.class.id)
            ? previous.map((classItem) =>
                classItem.id === response.class.id ? response.class : classItem
              )
            : [...previous, response.class]
        );
        setSelectedClassId(response.class.id);
        setSelectedSubjectId('');
        setExpandedUnitIds(new Set());
      }

      if (quickAddDraft.kind === 'subject') {
        if (!quickAddDraft.classId) {
          throw new Error('اختر الصف أولاً.');
        }
        const normalizedSubjectName = normalizeLookupText(quickAddDraft.name);
        const existingSubject = subjects.find(
          (subjectItem) =>
            subjectItem.class_id === quickAddDraft.classId &&
            normalizeLookupText(subjectItem.name) === normalizedSubjectName
        );
        if (existingSubject) {
          activateSubjectView(existingSubject.id, existingSubject.class_id);
        } else {
          const response = await createSubject({
            class_id: quickAddDraft.classId,
            teacher_id: teacherId,
            name: normalizedSubjectName,
            description: quickAddDraft.description.trim(),
          });
          setSubjects((previous) => [...previous, response.subject]);
          activateSubjectView(response.subject.id, response.subject.class_id);
        }
      }

      if (quickAddDraft.kind === 'unit') {
        if (!quickAddDraft.subjectId) {
          throw new Error('اختر المادة أولاً.');
        }
        const targetSubject =
          subjects.find(
            (subjectItem) => subjectItem.id === quickAddDraft.subjectId
          ) ?? null;
        if (!targetSubject) {
          throw new Error('المادة المختارة غير موجودة.');
        }
        const normalizedUnitName = normalizeLookupText(quickAddDraft.name);
        const existingUnit = units.find(
          (unitItem) =>
            unitItem.subject_id === quickAddDraft.subjectId &&
            normalizeLookupText(unitItem.name) === normalizedUnitName
        );
        if (existingUnit) {
          activateSubjectView(targetSubject.id, targetSubject.class_id, units);
          ensureUnitExpanded(existingUnit.id);
        } else {
          const response = await createUnit({
            subject_id: quickAddDraft.subjectId,
            teacher_id: teacherId,
            name: normalizedUnitName,
            description: quickAddDraft.description.trim(),
          });
          const nextUnits = [...units, response.unit];
          setUnits(nextUnits);
          activateSubjectView(
            targetSubject.id,
            targetSubject.class_id,
            nextUnits
          );
        }
      }

      if (quickAddDraft.kind === 'lesson') {
        if (!quickAddDraft.unitId) {
          throw new Error('اختر الوحدة أولاً.');
        }
        const targetUnit =
          units.find((unitItem) => unitItem.id === quickAddDraft.unitId) ??
          null;
        if (!targetUnit) {
          throw new Error('الوحدة المختارة غير موجودة.');
        }
        const targetSubject =
          subjects.find(
            (subjectItem) => subjectItem.id === targetUnit.subject_id
          ) ?? null;
        if (!targetSubject) {
          throw new Error('المادة المرتبطة بالوحدة غير موجودة.');
        }
        const targetClass =
          classes.find(
            (classItem) => classItem.id === targetSubject.class_id
          ) ?? null;
        if (!targetClass) {
          throw new Error('الصف المرتبط بالمادة غير موجود.');
        }
        if (quickAddDraft.contentType === 'text') {
          const response = await createLesson({
            content_type: 'text',
            content: quickAddDraft.content?.trim() ?? '',
            description: quickAddDraft.description.trim(),
            name: quickAddDraft.name.trim(),
            period_number: quickAddDraft.periodNumber ?? 1,
            number_of_periods: quickAddDraft.numberOfPeriods ?? 1,
            teacher_id: teacherId,
            unit_id: quickAddDraft.unitId,
          });
          if (response.lesson) {
            setLessons((previous) => [...previous, response.lesson as Lesson]);
          }
          ensureUnitExpanded(targetUnit.id);
          setSelectedClassId(targetClass.id);
          setSelectedSubjectId(targetSubject.id);
        } else {
          const fileValidationError = validateLessonFile(
            quickAddDraft.file ?? null,
            quickAddDraft.contentType === 'pdf' ? 'pdf' : 'word'
          );
          if (fileValidationError) {
            throw new Error(fileValidationError);
          }
          const response = await createLesson({
            content_type: quickAddDraft.contentType === 'pdf' ? 'pdf' : 'word',
            file: quickAddDraft.file as File,
            description: quickAddDraft.description.trim(),
            name: quickAddDraft.name.trim(),
            period_number: quickAddDraft.periodNumber ?? 1,
            number_of_periods: quickAddDraft.numberOfPeriods ?? 1,
            teacher_id: teacherId,
            unit_id: quickAddDraft.unitId,
          });
          if (response.lesson) {
            setLessons((previous) => [...previous, response.lesson as Lesson]);
          }
          ensureUnitExpanded(targetUnit.id);
          setSelectedClassId(targetClass.id);
          setSelectedSubjectId(targetSubject.id);
        }
      }

      setQuickAddDraft(null);
      setSuccess('تمت الإضافة بنجاح.');
    } catch (quickAddError: unknown) {
      setError(getErrorMessage(quickAddError, 'تعذرت الإضافة.'));
    } finally {
      setSaving(false);
    }
  };

  const openEditForSelectedClass = () => {
    if (!selectedClass) {
      return;
    }
    setEditDraft({
      kind: 'class',
      id: selectedClass.id,
      name: '',
      description: '',
      gradeLabel: selectedClass.grade_label,
      semester: selectedClass.semester ?? SEMESTER_OPTIONS[0],
      sectionLabel: selectedClass.section_label,
      section: selectedClass.section,
      academicYear: selectedClass.academic_year,
      defaultDurationMinutes: selectedClass.default_duration_minutes,
    });
  };

  const openEditForSelectedSubject = () => {
    if (!selectedSubject) {
      return;
    }
    setEditDraft({
      kind: 'subject',
      id: selectedSubject.id,
      name: selectedSubject.name,
      description: selectedSubject.description ?? '',
    });
  };

  const openEditForUnit = (unitItem: Unit) => {
    setEditDraft({
      kind: 'unit',
      id: unitItem.id,
      name: unitItem.name,
      description: unitItem.description ?? '',
    });
  };

  const openEditForLesson = (lessonItem: Lesson) => {
    setEditDraft({
      kind: 'lesson',
      id: lessonItem.id,
      name: lessonItem.name,
      description: lessonItem.description ?? '',
      contentType: 'text',
      content: lessonItem.content,
      file: null,
      unitId: lessonItem.unit_id,
      periodNumber: Number(lessonItem.period_number ?? 1),
      numberOfPeriods: Number(lessonItem.number_of_periods ?? 1),
    });
  };

  const handleSaveEdit = async () => {
    if (!editDraft) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editDraft.kind !== 'class' && !editDraft.name.trim()) {
        throw new Error('الاسم مطلوب.');
      }

      if (editDraft.kind === 'class') {
        if (!editDraft.gradeLabel?.trim()) {
          throw new Error('الصف مطلوب.');
        }
        if (!editDraft.semester?.trim()) {
          throw new Error('الفصل الدراسي مطلوب.');
        }
        if (!editDraft.sectionLabel?.trim()) {
          throw new Error('الشعبة مطلوبة.');
        }
        if (!editDraft.academicYear?.trim()) {
          throw new Error('العام الدراسي مطلوب.');
        }
        if (
          editDraft.defaultDurationMinutes !== undefined &&
          (!Number.isInteger(editDraft.defaultDurationMinutes) ||
            editDraft.defaultDurationMinutes <= 0)
        ) {
          throw new Error('المدة الافتراضية يجب أن تكون رقمًا صحيحًا موجبًا.');
        }
      }

      if (editDraft.kind === 'class') {
        const response = await updateClass(editDraft.id, {
          grade_label: editDraft.gradeLabel?.trim() ?? '',
          semester: editDraft.semester?.trim() ?? '',
          section_label: editDraft.sectionLabel?.trim() ?? '',
          section: editDraft.section?.trim() || 'أ',
          academic_year: normalizeAcademicYearLabel(
            editDraft.academicYear?.trim() ?? ''
          ),
          default_duration_minutes: editDraft.defaultDurationMinutes ?? 45,
        });
        setClasses((previous) =>
          previous.map((item) =>
            item.id === response.class.id ? response.class : item
          )
        );
      }

      if (editDraft.kind === 'subject') {
        const response = await updateSubject(editDraft.id, {
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
        });
        setSubjects((previous) =>
          previous.map((item) =>
            item.id === response.subject.id ? response.subject : item
          )
        );
      }

      if (editDraft.kind === 'unit') {
        if (selectedSubjectId === '') {
          throw new Error('اختر مادة قبل تعديل الوحدة.');
        }
        const response = await updateUnit(editDraft.id, {
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
          subject_id: selectedSubjectId,
        });
        setUnits((previous) =>
          previous.map((item) =>
            item.id === response.unit.id ? response.unit : item
          )
        );
      }

      if (editDraft.kind === 'lesson') {
        if (!editDraft.unitId) {
          throw new Error('اختر وحدة للدرس.');
        }
        if (
          !Number.isInteger(editDraft.periodNumber) ||
          Number(editDraft.periodNumber) <= 0
        ) {
          throw new Error('ترتيب الحصة يجب أن يكون رقمًا صحيحًا موجبًا.');
        }
        if (
          !Number.isInteger(editDraft.numberOfPeriods) ||
          Number(editDraft.numberOfPeriods) <= 0
        ) {
          throw new Error('عدد الحصص يجب أن يكون رقمًا صحيحًا موجبًا.');
        }
        const lessonContentType = editDraft.contentType ?? 'text';
        if (lessonContentType === 'text') {
          if (!editDraft.content || !editDraft.content.trim()) {
            throw new Error('محتوى الدرس مطلوب.');
          }
          const response = await updateLesson(editDraft.id, {
            name: editDraft.name.trim(),
            description: editDraft.description.trim(),
            content_type: 'text',
            content: editDraft.content,
            unit_id: editDraft.unitId,
            period_number: Number(editDraft.periodNumber),
            number_of_periods: Number(editDraft.numberOfPeriods),
          });
          if (response.lesson) {
            setLessons((previous) =>
              previous.map((item) =>
                item.id === response.lesson?.id
                  ? (response.lesson as Lesson)
                  : item
              )
            );
          }
          ensureUnitExpanded(editDraft.unitId);
        } else {
          const fileValidationError = validateLessonFile(
            editDraft.file ?? null,
            lessonContentType
          );
          if (fileValidationError) {
            throw new Error(fileValidationError);
          }
          const response = await updateLesson(editDraft.id, {
            name: editDraft.name.trim(),
            description: editDraft.description.trim(),
            content_type: lessonContentType,
            file: editDraft.file as File,
            unit_id: editDraft.unitId,
            period_number: Number(editDraft.periodNumber),
            number_of_periods: Number(editDraft.numberOfPeriods),
          });
          if (response.lesson) {
            setLessons((previous) =>
              previous.map((item) =>
                item.id === response.lesson?.id
                  ? (response.lesson as Lesson)
                  : item
              )
            );
          }
          ensureUnitExpanded(editDraft.unitId);
        }
      }

      setEditDraft(null);
      setSuccess('تم حفظ التعديلات بنجاح.');
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'فشل حفظ التعديلات.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntity = async (kind: EntityKind, id: number) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (kind === 'class') {
        const subjectIdsToRemove = subjects
          .filter((item) => item.class_id === id)
          .map((item) => item.id);
        const unitIdsToRemove = units
          .filter((item) => subjectIdsToRemove.includes(item.subject_id))
          .map((item) => item.id);
        await deleteClass(id);
        setClasses((previous) => previous.filter((item) => item.id !== id));
        setSubjects((previous) =>
          previous.filter((item) => item.class_id !== id)
        );
        setUnits((previous) =>
          previous.filter(
            (item) => !subjectIdsToRemove.includes(item.subject_id)
          )
        );
        setLessons((previous) =>
          previous.filter((item) => !unitIdsToRemove.includes(item.unit_id))
        );
        if (selectedClassId === id) {
          setSelectedClassId('');
          setSelectedSubjectId('');
          setExpandedUnitIds(new Set());
        }
      }

      if (kind === 'subject') {
        const unitIdsToRemove = units
          .filter((item) => item.subject_id === id)
          .map((item) => item.id);
        await deleteSubject(id);
        setSubjects((previous) => previous.filter((item) => item.id !== id));
        setUnits((previous) =>
          previous.filter((item) => item.subject_id !== id)
        );
        setLessons((previous) =>
          previous.filter((item) => !unitIdsToRemove.includes(item.unit_id))
        );
        if (selectedSubjectId === id) {
          setSelectedSubjectId('');
          setExpandedUnitIds(new Set());
        }
      }

      if (kind === 'unit') {
        await deleteUnit(id);
        setUnits((previous) => previous.filter((item) => item.id !== id));
        setLessons((previous) =>
          previous.filter((item) => item.unit_id !== id)
        );
      }

      if (kind === 'lesson') {
        await deleteLesson(id);
        setLessons((previous) => previous.filter((item) => item.id !== id));
      }

      setSuccess('تم الحذف بنجاح.');
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, 'فشل تنفيذ عملية الحذف.'));
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteEntity = (kind: EntityKind, id: number, label: string) => {
    const endpointByKind: Record<EntityKind, string> = {
      class: `/api/classes/${id}`,
      subject: `/api/subjects/${id}`,
      unit: `/api/units/${id}`,
      lesson: `/api/lessons/${id}`,
    };

    setDeleteRequest({
      kind,
      id,
      label,
      endpoint: endpointByKind[kind],
      payload: { id, kind },
    });
  };

  const handleCreatorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!teacherId) {
      setError('المعلم غير معرف. قم بإعادة تسجيل الدخول.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let resolvedClassId: number;
      let resolvedSubject: Subject | null = null;
      let resolvedUnit: Unit | null = null;
      let createdUnit: Unit | null = null;
      let lessonCreationResult: CreateLessonResponse | null = null;

      if (creatorClassMode === 'existing') {
        if (creatorExistingClassId === '') {
          throw new Error('اختر صفاً موجوداً.');
        }
        resolvedClassId = creatorExistingClassId;
      } else {
        if (!creatorNewClassGradeLabel.trim()) {
          throw new Error('يرجى إدخال الصف.');
        }
        if (!creatorNewClassSemester.trim()) {
          throw new Error('يرجى اختيار الفصل الدراسي.');
        }
        if (!creatorNewClassSectionLabel.trim()) {
          throw new Error('يرجى إدخال الشعبة.');
        }
        if (!creatorNewClassAcademicYear.trim()) {
          throw new Error('يرجى إدخال العام الدراسي.');
        }
        if (
          !Number.isInteger(creatorNewClassDefaultDuration) ||
          creatorNewClassDefaultDuration <= 0
        ) {
          throw new Error('المدة الافتراضية يجب أن تكون رقمًا صحيحًا موجبًا.');
        }

        const classResponse = await createClass({
          grade_label: creatorNewClassGradeLabel.trim(),
          semester: creatorNewClassSemester.trim(),
          section_label: creatorNewClassSectionLabel.trim(),
          section: 'أ',
          academic_year: normalizeAcademicYearLabel(
            creatorNewClassAcademicYear.trim()
          ),
          default_duration_minutes: creatorNewClassDefaultDuration,
          teacher_id: teacherId,
        });
        resolvedClassId = classResponse.class.id;
        setClasses((previous) =>
          previous.some((classItem) => classItem.id === classResponse.class.id)
            ? previous.map((classItem) =>
                classItem.id === classResponse.class.id
                  ? classResponse.class
                  : classItem
              )
            : [...previous, classResponse.class]
        );
      }

      const normalizedSubjectName = normalizeLookupText(creatorSubjectName);
      const normalizedUnitName = normalizeLookupText(creatorUnitName);

      if (normalizedSubjectName.length > 0) {
        const existingSubject =
          creatorClassMode === 'existing'
            ? (subjects.find(
                (subjectItem) =>
                  subjectItem.class_id === resolvedClassId &&
                  normalizeLookupText(subjectItem.name) ===
                    normalizedSubjectName
              ) ?? null)
            : null;

        if (existingSubject) {
          resolvedSubject = existingSubject;
        } else {
          const subjectResponse = await createSubject({
            class_id: resolvedClassId,
            teacher_id: teacherId,
            name: normalizedSubjectName,
            description: creatorNewSubjectDescription.trim(),
          });
          resolvedSubject = subjectResponse.subject;
          setSubjects((previous) => [...previous, subjectResponse.subject]);
        }
      } else if (normalizedUnitName.length > 0 || creatorLessonMode === 'new') {
        throw new Error('لا يمكن إضافة وحدة أو درس بدون تحديد مادة.');
      }

      if (normalizedUnitName.length > 0) {
        if (!resolvedSubject) {
          throw new Error('لا يمكن إنشاء وحدة بدون مادة.');
        }

        const existingUnit =
          units.find(
            (unitItem) =>
              unitItem.subject_id === resolvedSubject.id &&
              normalizeLookupText(unitItem.name) === normalizedUnitName
          ) ?? null;

        if (existingUnit) {
          resolvedUnit = existingUnit;
        } else {
          const unitResponse = await createUnit({
            subject_id: resolvedSubject.id,
            teacher_id: teacherId,
            name: normalizedUnitName,
            description: creatorNewUnitDescription.trim(),
          });
          resolvedUnit = unitResponse.unit;
          createdUnit = unitResponse.unit;
          setUnits((previous) => [...previous, unitResponse.unit]);
        }
      } else if (creatorLessonMode === 'new') {
        if (!resolvedSubject) {
          throw new Error('لا يمكن إضافة درس بدون تحديد وحدة.');
        }
      }

      if (creatorLessonMode === 'new') {
        if (!resolvedUnit) {
          throw new Error('لا يمكن إنشاء درس بدون وحدة.');
        }
        if (!creatorLessonName.trim()) {
          throw new Error('يرجى إدخال اسم الدرس.');
        }
        if (
          !Number.isInteger(creatorLessonPeriodNumber) ||
          creatorLessonPeriodNumber <= 0
        ) {
          throw new Error('يرجى اختيار الحصة.');
        }
        if (
          !Number.isInteger(creatorLessonNumberOfPeriods) ||
          creatorLessonNumberOfPeriods <= 0
        ) {
          throw new Error('عدد الحصص يجب أن يكون رقمًا صحيحًا موجبًا.');
        }

        if (creatorLessonContentType === 'text') {
          if (!creatorLessonTextContent.trim()) {
            throw new Error('يرجى إدخال المحتوى النصي للدرس.');
          }
          lessonCreationResult = await createLesson({
            content_type: 'text',
            content: creatorLessonTextContent.trim(),
            description: creatorLessonDescription.trim(),
            name: creatorLessonName.trim(),
            period_number: creatorLessonPeriodNumber,
            number_of_periods: creatorLessonNumberOfPeriods,
            teacher_id: teacherId,
            unit_id: resolvedUnit.id,
          });
          if (lessonCreationResult && lessonCreationResult.lesson) {
            const lesson = lessonCreationResult.lesson;
            setLessons((previous) => [...previous, lesson as Lesson]);
          }
        } else {
          const fileValidationError = validateLessonFile(
            creatorLessonFile,
            creatorLessonContentType
          );
          if (fileValidationError) {
            throw new Error(fileValidationError);
          }

          lessonCreationResult = await createLesson({
            content_type: creatorLessonContentType,
            description: creatorLessonDescription.trim(),
            file: creatorLessonFile as File,
            name: creatorLessonName.trim(),
            period_number: creatorLessonPeriodNumber,
            number_of_periods: creatorLessonNumberOfPeriods,
            teacher_id: teacherId,
            unit_id: resolvedUnit.id,
          });
          if (lessonCreationResult && lessonCreationResult.lesson) {
            const lesson = lessonCreationResult.lesson;
            setLessons((previous) => [...previous, lesson as Lesson]);
          }
        }
      }

      const nextUnits = createdUnit ? [...units, createdUnit] : units;

      setSelectedClassId(resolvedClassId);
      if (resolvedSubject) {
        setSelectedSubjectId(resolvedSubject.id);
        setExpandedUnitIds(
          new Set(
            nextUnits
              .filter((unitItem) => unitItem.subject_id === resolvedSubject?.id)
              .map((unitItem) => unitItem.id)
          )
        );
      } else {
        setSelectedSubjectId('');
        setExpandedUnitIds(new Set());
      }

      resetCreatorForm();
      setCreatorClassMode('existing');
      setCreatorExistingClassId(resolvedClassId);
      if (resolvedSubject) {
        setCreatorSubjectName(resolvedSubject.name);
        setCreatorNewSubjectDescription(resolvedSubject.description ?? '');
      }
      if (resolvedUnit) {
        setCreatorUnitName(resolvedUnit.name);
        setCreatorNewUnitDescription(resolvedUnit.description ?? '');
      }

      if (lessonCreationResult) {
        setSuccess(getLessonCreationMessage(lessonCreationResult));
      } else {
        setSuccess('تم حفظ التغييرات بنجاح.');
      }
    } catch (creatorError: unknown) {
      setError(getErrorMessage(creatorError, 'فشل تنفيذ عملية الإنشاء.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tcm2 ui-loaded">
      <nav aria-label="breadcrumb">
        <ol className="tcm2__breadcrumb">
          <li>
            <Link to="/teacher">الرئيسية</Link>
          </li>
          <li className="tcm2__breadcrumb-current">المنهج الدراسي</li>
        </ol>
      </nav>

      <header className="tcm2__header page-header">
        <h1>إدارة المنهج الدراسي</h1>
        <p>إدارة الصفوف والمواد والوحدات والدروس من صفحة واحدة.</p>
      </header>

      <div className="tcm2__grid">
        <section className="tcm2__panel">
          <div className="tcm2__panel-head">
            <h2>
              <MdSchool aria-hidden />
              هيكل المنهج
            </h2>
            <span>
              {selectedSubjectUnits.length} وحدة / {totalLessons} درس
            </span>
          </div>

          <div className="tcm2__selectors">
            <div className="tcm2__field">
              <div className="tcm2__selector-row">
                <label htmlFor="active-class">الصف</label>
                <div className="tcm2__selector-actions">
                  <button
                    type="button"
                    className="tcm2__primary-soft tcm2__quick-select-btn"
                    onClick={openQuickAddClass}
                  >
                    <MdAdd aria-hidden />
                    إنشاء صف جديد
                  </button>
                  <button
                    type="button"
                    className="tcm2__danger tcm2__quick-select-btn"
                    onClick={() =>
                      selectedClassId !== ''
                        ? requestDeleteEntity(
                            'class',
                            selectedClassId,
                            'هذا الصف'
                          )
                        : undefined
                    }
                    disabled={selectedClassId === ''}
                  >
                    <MdDelete aria-hidden />
                    حذف الصف
                  </button>
                </div>
              </div>
              <div className="tcm2__mode-toggle">
                <button
                  type="button"
                  className={
                    classSelectionMode === 'existing' ? 'tcm2__mode-active' : ''
                  }
                  onClick={() => setClassSelectionMode('existing')}
                >
                  اختيار صف محفوظ
                </button>
                <button
                  type="button"
                  className={
                    classSelectionMode === 'new' ? 'tcm2__mode-active' : ''
                  }
                  onClick={() => setClassSelectionMode('new')}
                >
                  إنشاء صف جديد
                </button>
              </div>

              {classSelectionMode === 'existing' ? (
                <>
                  <div className="tcm2__class-filter-grid">
                    <div className="tcm2__field">
                      <label htmlFor="class-year-filter">العام الدراسي</label>
                      <select
                        id="class-year-filter"
                        value={existingClassYearFilter}
                        onChange={(event) =>
                          setExistingClassYearFilter(event.target.value)
                        }
                      >
                        <option value="">الكل</option>
                        {existingClassYearOptions.map((yearOption) => (
                          <option key={yearOption} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="class-semester-filter">
                        الفصل الدراسي
                      </label>
                      <select
                        id="class-semester-filter"
                        value={existingClassSemesterFilter}
                        onChange={(event) =>
                          setExistingClassSemesterFilter(event.target.value)
                        }
                      >
                        <option value="">الكل</option>
                        {SEMESTER_OPTIONS.map((semesterOption) => (
                          <option key={semesterOption} value={semesterOption}>
                            {semesterOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="class-grade-filter">الصف الدراسي</label>
                      <select
                        id="class-grade-filter"
                        value={existingClassGradeFilter}
                        onChange={(event) =>
                          setExistingClassGradeFilter(event.target.value)
                        }
                      >
                        <option value="">الكل</option>
                        {GRADE_OPTIONS.map((gradeOption) => (
                          <option key={gradeOption} value={gradeOption}>
                            {gradeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="tcm2__field tcm2__stored-class-field">
                    <label htmlFor="active-class">الصف المحفوظ</label>
                    <select
                      id="active-class"
                      value={selectedClassId}
                      onChange={(event) =>
                        handleClassChange(
                          event.target.value ? Number(event.target.value) : ''
                        )
                      }
                    >
                      <option value="">اختر الصف</option>
                      {filteredExistingClasses.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {formatClassSelectLabel(classItem)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="tcm2__step tcm2__step--compact">
                  <h3>إنشاء صف جديد</h3>
                  <div className="tcm2__inline-grid">
                    <div className="tcm2__field">
                      <label htmlFor="new-class-year">1. العام الدراسي *</label>
                      <select
                        id="new-class-year"
                        value={newClassAcademicYear}
                        onChange={(event) =>
                          setNewClassAcademicYear(event.target.value)
                        }
                      >
                        {ACADEMIC_YEAR_OPTIONS.map((yearOption) => (
                          <option key={yearOption} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="new-class-semester">
                        2. الفصل الدراسي *
                      </label>
                      <select
                        id="new-class-semester"
                        value={newClassSemester}
                        onChange={(event) =>
                          setNewClassSemester(event.target.value)
                        }
                      >
                        {SEMESTER_OPTIONS.map((semesterOption) => (
                          <option key={semesterOption} value={semesterOption}>
                            {semesterOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="new-class-grade">
                        3. الصف الدراسي (1-12) *
                      </label>
                      <select
                        id="new-class-grade"
                        value={newClassGradeLabel}
                        onChange={(event) =>
                          setNewClassGradeLabel(event.target.value)
                        }
                      >
                        <option value="">اختر الصف</option>
                        {GRADE_OPTIONS.map((gradeOption) => (
                          <option key={gradeOption} value={gradeOption}>
                            {gradeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="new-class-section">4. الشعبة *</label>
                      <input
                        id="new-class-section"
                        type="text"
                        value={newClassSectionLabel}
                        onChange={(event) =>
                          setNewClassSectionLabel(event.target.value)
                        }
                        placeholder="مثال: أ"
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="new-class-duration">
                        مدة الحصة الافتراضية (دقيقة)
                      </label>
                      <select
                        id="new-class-duration"
                        value={newClassDefaultDuration}
                        onChange={(event) =>
                          setNewClassDefaultDuration(Number(event.target.value))
                        }
                      >
                        {LESSON_DURATION_OPTIONS.map((durationOption) => (
                          <option key={durationOption} value={durationOption}>
                            {durationOption} دقيقة
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {duplicateNewClass ? (
                    <p className="tcm2__warning">
                      هذا الصف موجود بالفعل:{' '}
                      {formatClassSelectLabel(duplicateNewClass)}
                    </p>
                  ) : null}

                  <div className="tcm2__form-actions">
                    <button
                      type="button"
                      onClick={() => setClassSelectionMode('existing')}
                      disabled={saving}
                    >
                      رجوع إلى الصفوف المحفوظة
                    </button>
                    <button
                      type="button"
                      className="tcm2__primary"
                      onClick={() => void handleCreateClassFromSelector()}
                      disabled={saving || !isNewClassFormValid}
                    >
                      {saving && (
                        <span className="ui-button-spinner" aria-hidden />
                      )}
                      {saving ? 'جارٍ الحفظ...' : 'حفظ الصف'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="tcm2__field">
              <div className="tcm2__selector-row">
                <label htmlFor="active-subject">المادة المحفوظة</label>
                <div className="tcm2__selector-actions">
                  <button
                    type="button"
                    className="tcm2__primary-soft tcm2__quick-select-btn"
                    onClick={() =>
                      selectedClassId !== ''
                        ? openQuickAddSubject(selectedClassId)
                        : undefined
                    }
                    disabled={selectedClassId === ''}
                  >
                    <MdAdd aria-hidden />
                    إضافة مادة
                  </button>
                </div>
              </div>
              <select
                id="active-subject"
                aria-label="اختيار المادة"
                value={selectedSubjectId}
                onChange={(event) =>
                  handleSubjectChange(
                    event.target.value ? Number(event.target.value) : ''
                  )
                }
              >
                <option value="">اختر المادة</option>
                {orderedSubjects.map((subjectItem) => (
                  <option key={subjectItem.id} value={subjectItem.id}>
                    {formatSubjectSelectLabel(
                      subjectItem,
                      classByIdMap.get(subjectItem.class_id) ?? null
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedClass && (
            <div className="tcm2__meta">
              <div>
                <h3>
                  <MdSchool aria-hidden />
                  {formatClassShortLabel(selectedClass)}
                </h3>
                <p>
                  الصف: {selectedClass.grade_label} | الشعبة:{' '}
                  {selectedClass.section_label} | الفصل:{' '}
                  {normalizeSemesterLabel(selectedClass.semester)}
                </p>
                <p>
                  العام الدراسي:{' '}
                  {normalizeAcademicYearLabel(selectedClass.academic_year)} |
                  المدة الافتراضية: {selectedClass.default_duration_minutes}{' '}
                  دقيقة
                </p>
              </div>
              <div className="tcm2__meta-actions">
                <button type="button" onClick={openEditForSelectedClass}>
                  <MdEdit aria-hidden />
                  تعديل
                </button>
                <button
                  type="button"
                  className="tcm2__danger"
                  onClick={() =>
                    requestDeleteEntity('class', selectedClass.id, 'هذا الصف')
                  }
                  disabled={saving}
                >
                  <MdDelete aria-hidden />
                  حذف
                </button>
              </div>
            </div>
          )}

          {selectedSubject && (
            <div className="tcm2__meta">
              <div>
                <h3>
                  <MdSubject aria-hidden />
                  {selectedSubject.name}
                </h3>
                <p>
                  {selectedSubject.description?.trim() || 'لا يوجد وصف للمادة.'}
                </p>
              </div>
              <div className="tcm2__meta-actions">
                <button
                  type="button"
                  className="tcm2__primary-soft"
                  onClick={() => openQuickAddUnit(selectedSubject.id)}
                >
                  <MdAdd aria-hidden />
                  إضافة وحدة
                </button>
                <button type="button" onClick={openEditForSelectedSubject}>
                  <MdEdit aria-hidden />
                  تعديل
                </button>
                <button
                  type="button"
                  className="tcm2__danger"
                  onClick={() =>
                    requestDeleteEntity(
                      'subject',
                      selectedSubject.id,
                      'هذه المادة'
                    )
                  }
                  disabled={saving}
                >
                  <MdDelete aria-hidden />
                  حذف
                </button>
              </div>
            </div>
          )}

          <div className="tcm2__helper-actions">
            <button
              type="button"
              className="tcm2__primary-soft"
              onClick={() =>
                selectedSubject
                  ? openQuickAddUnit(selectedSubject.id)
                  : undefined
              }
              disabled={!selectedSubject}
            >
              <MdAdd aria-hidden />
              إضافة وحدة للمادة
            </button>
            <button
              type="button"
              className="tcm2__primary-soft"
              onClick={() =>
                selectedSubjectUnits[0]
                  ? openQuickAddLesson(selectedSubjectUnits[0].id)
                  : undefined
              }
              disabled={!selectedSubject || selectedSubjectUnits.length === 0}
            >
              <MdAdd aria-hidden />
              إضافة درس سريع
            </button>
          </div>

          {!selectedSubject ? (
            <div className="tcm2__empty">اختر الصف أو المادة لعرض الهيكل.</div>
          ) : selectedSubjectUnits.length === 0 ? (
            <div className="tcm2__empty">لا توجد وحدات بعد لهذه المادة.</div>
          ) : (
            <div className="tcm2__hierarchy">
              {selectedSubjectUnits.map((unitItem) => {
                const unitLessons = lessonsByUnit[unitItem.id] ?? [];
                const isExpanded = expandedUnitIds.has(unitItem.id);

                return (
                  <article
                    key={unitItem.id}
                    className="tcm2__unit animate-fadeIn"
                  >
                    <header className="tcm2__unit-head">
                      <button
                        type="button"
                        className="tcm2__unit-toggle"
                        onClick={() => toggleUnitExpansion(unitItem.id)}
                      >
                        {isExpanded ? (
                          <MdExpandLess aria-hidden />
                        ) : (
                          <MdExpandMore aria-hidden />
                        )}
                        <span>{unitItem.name}</span>
                        <small>{unitLessons.length} درس</small>
                      </button>
                      <div className="tcm2__row-actions">
                        <button
                          type="button"
                          className="tcm2__primary-soft"
                          onClick={() => openQuickAddLesson(unitItem.id)}
                        >
                          <MdAdd aria-hidden />
                          درس
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForUnit(unitItem)}
                        >
                          <MdEdit aria-hidden />
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="tcm2__danger"
                          onClick={() =>
                            requestDeleteEntity(
                              'unit',
                              unitItem.id,
                              'هذه الوحدة'
                            )
                          }
                          disabled={saving}
                        >
                          <MdDelete aria-hidden />
                          حذف
                        </button>
                      </div>
                    </header>

                    {isExpanded && (
                      <div className="tcm2__unit-body">
                        <p className="tcm2__unit-description">
                          {unitItem.description?.trim() ||
                            'لا يوجد وصف للوحدة.'}
                        </p>
                        {unitLessons.length === 0 ? (
                          <p className="tcm2__empty-small">
                            لا توجد دروس داخل هذه الوحدة.
                          </p>
                        ) : (
                          <ul className="tcm2__lesson-list">
                            {unitLessons.map((lessonItem) => (
                              <li
                                key={lessonItem.id}
                                className="tcm2__lesson-row animate-fadeIn"
                              >
                                <div className="tcm2__lesson-main">
                                  <MdMenuBook aria-hidden />
                                  <div>
                                    <strong>{lessonItem.name}</strong>
                                    <p>
                                      {lessonItem.description?.trim() ||
                                        'لا يوجد وصف للدرس.'}
                                    </p>
                                    <small>
                                      عدد الحصص:{' '}
                                      {Number(
                                        lessonItem.number_of_periods ?? 1
                                      )}
                                    </small>
                                  </div>
                                </div>
                                <div className="tcm2__row-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditForLesson(lessonItem)
                                    }
                                  >
                                    <MdEdit aria-hidden />
                                    تعديل
                                  </button>
                                  <button
                                    type="button"
                                    className="tcm2__danger"
                                    onClick={() =>
                                      requestDeleteEntity(
                                        'lesson',
                                        lessonItem.id,
                                        'هذا الدرس'
                                      )
                                    }
                                    disabled={saving}
                                  >
                                    <MdDelete aria-hidden />
                                    حذف
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="tcm2__panel">
          <div className="tcm2__panel-head">
            <h2>
              <MdViewModule aria-hidden />
              إنشاء متكامل - اختياري
            </h2>
            <button
              type="button"
              onClick={() => setShowCreatorFlow((previous) => !previous)}
            >
              {showCreatorFlow ? 'إخفاء' : 'إظهار'}
            </button>
          </div>

          {showCreatorFlow ? (
            <form className="tcm2__form" onSubmit={handleCreatorSubmit}>
              <p className="tcm2__required-note">الحقول التي عليها * مطلوبة.</p>
              <div className="tcm2__step">
                <h3>1) الصف</h3>
                <div className="tcm2__mode-toggle">
                  <button
                    type="button"
                    className={
                      creatorClassMode === 'existing' ? 'tcm2__mode-active' : ''
                    }
                    onClick={() => setCreatorClassMode('existing')}
                  >
                    استخدام صف موجود
                  </button>
                  <button
                    type="button"
                    className={
                      creatorClassMode === 'new' ? 'tcm2__mode-active' : ''
                    }
                    onClick={() => setCreatorClassMode('new')}
                  >
                    إنشاء صف جديد
                  </button>
                </div>

                {creatorClassMode === 'existing' ? (
                  <div className="tcm2__field">
                    <label htmlFor="creator-existing-class">
                      الصف الحالي *
                    </label>
                    <select
                      id="creator-existing-class"
                      value={creatorExistingClassId}
                      onChange={(event) => {
                        const nextClassId = event.target.value
                          ? Number(event.target.value)
                          : '';
                        setCreatorExistingClassId(nextClassId);
                      }}
                    >
                      <option value="">اختر الصف</option>
                      {classes.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {formatClassSelectLabel(classItem)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="tcm2__inline-grid">
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-academic-year">
                        العام الدراسي *
                      </label>
                      <select
                        id="creator-new-class-academic-year"
                        value={creatorNewClassAcademicYear}
                        onChange={(event) =>
                          setCreatorNewClassAcademicYear(event.target.value)
                        }
                      >
                        {ACADEMIC_YEAR_OPTIONS.map((yearOption) => (
                          <option key={yearOption} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-semester">
                        الفصل الدراسي *
                      </label>
                      <select
                        id="creator-new-class-semester"
                        value={creatorNewClassSemester}
                        onChange={(event) =>
                          setCreatorNewClassSemester(event.target.value)
                        }
                      >
                        {SEMESTER_OPTIONS.map((semesterOption) => (
                          <option key={semesterOption} value={semesterOption}>
                            {semesterOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-grade-label">
                        الصف *
                      </label>
                      <select
                        id="creator-new-class-grade-label"
                        value={creatorNewClassGradeLabel}
                        onChange={(event) =>
                          setCreatorNewClassGradeLabel(event.target.value)
                        }
                      >
                        <option value="">اختر الصف</option>
                        {GRADE_OPTIONS.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-section-label">
                        الشعبة *
                      </label>
                      <input
                        id="creator-new-class-section-label"
                        type="text"
                        value={creatorNewClassSectionLabel}
                        onChange={(event) =>
                          setCreatorNewClassSectionLabel(event.target.value)
                        }
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-default-duration">
                        مدة الحصة الافتراضية (دقيقة) *
                      </label>
                      <select
                        id="creator-new-class-default-duration"
                        value={creatorNewClassDefaultDuration}
                        onChange={(event) =>
                          setCreatorNewClassDefaultDuration(
                            Number(event.target.value)
                          )
                        }
                      >
                        {LESSON_DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d} دقيقة
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="tcm2__step">
                <h3>2) المادة</h3>
                <SearchablePickerField
                  id="creator-subject-name"
                  label="اسم المادة *"
                  value={creatorSubjectName}
                  placeholder={
                    creatorClassMode === 'existing'
                      ? 'اكتب اسم المادة أو ابحث عن مادة محفوظة'
                      : 'اكتب اسم المادة الجديدة'
                  }
                  helperText={
                    creatorClassMode === 'existing'
                      ? creatorExistingClassId === ''
                        ? 'اختر الصف أولاً ليظهر التطابق داخل هذا الصف.'
                        : 'سيُعاد استخدام المادة المطابقة داخل الصف نفسه، وإلا ستُنشأ مادة جديدة.'
                      : 'ستُنشأ المادة داخل الصف الجديد إذا لم يوجد تطابق.'
                  }
                  statusText={
                    creatorSubjectName.trim().length === 0
                      ? ''
                      : creatorResolvedClassId === null
                        ? 'سيتم إنشاء مادة جديدة بعد حفظ الصف.'
                        : creatorSubjectMatch
                          ? 'مادة محفوظة ضمن الصف المختار.'
                          : 'مادة جديدة ستُنشأ ضمن الصف المختار.'
                  }
                  suggestions={creatorSubjectSuggestions}
                  onChange={setCreatorSubjectName}
                  onSelectSuggestion={(suggestion) => {
                    setCreatorSubjectName(suggestion.label);
                    setCreatorNewSubjectDescription(
                      suggestion.description ?? ''
                    );
                  }}
                  disabled={
                    creatorClassMode === 'existing' &&
                    creatorExistingClassId === ''
                  }
                />
                <div className="tcm2__field">
                  <label htmlFor="creator-new-subject-description">
                    وصف المادة
                  </label>
                  <input
                    id="creator-new-subject-description"
                    type="text"
                    value={creatorNewSubjectDescription}
                    onChange={(event) =>
                      setCreatorNewSubjectDescription(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="tcm2__step">
                <h3>3) الوحدة</h3>
                <SearchablePickerField
                  id="creator-unit-name"
                  label="اسم الوحدة *"
                  value={creatorUnitName}
                  placeholder="اكتب اسم الوحدة"
                  helperText={
                    normalizeLookupText(creatorSubjectName).length > 0
                      ? creatorSubjectMatch
                        ? 'سيُبحث داخل المادة المحددة فقط، والمطابق سيُعاد استخدامه.'
                        : 'ستُنشأ الوحدة بعد إنشاء المادة التي كتبتها.'
                      : 'ابدأ بكتابة اسم المادة أولاً.'
                  }
                  statusText={
                    creatorUnitName.trim().length === 0
                      ? ''
                      : creatorSubjectMatch === null
                        ? 'لن تُطابق الوحدة حتى تُحدد مادة.'
                        : creatorUnitMatch
                          ? 'وحدة محفوظة ضمن المادة المختارة.'
                          : 'وحدة جديدة ستُنشأ ضمن المادة المختارة.'
                  }
                  suggestions={creatorUnitSuggestions}
                  onChange={setCreatorUnitName}
                  onSelectSuggestion={(suggestion) => {
                    setCreatorUnitName(suggestion.label);
                    setCreatorNewUnitDescription(suggestion.description ?? '');
                  }}
                  disabled={
                    normalizeLookupText(creatorSubjectName).length === 0
                  }
                />
                <div className="tcm2__field">
                  <label htmlFor="creator-new-unit-description">
                    وصف الوحدة
                  </label>
                  <input
                    id="creator-new-unit-description"
                    type="text"
                    value={creatorNewUnitDescription}
                    onChange={(event) =>
                      setCreatorNewUnitDescription(event.target.value)
                    }
                    disabled={
                      normalizeLookupText(creatorSubjectName).length === 0
                    }
                  />
                </div>
              </div>

              <div className="tcm2__step">
                <h3>4) الدرس</h3>
                <div className="tcm2__field">
                  <label htmlFor="creator-lesson-mode">الدرس</label>
                  <select
                    id="creator-lesson-mode"
                    value={creatorLessonMode}
                    onChange={(event) =>
                      setCreatorLessonMode(event.target.value as LessonMode)
                    }
                    disabled={normalizeLookupText(creatorUnitName).length === 0}
                  >
                    <option value="skip">عدم إضافة درس</option>
                    <option value="new">إنشاء درس جديد</option>
                  </select>
                </div>

                {creatorLessonMode === 'new' && (
                  <>
                    <div className="tcm2__inline-grid">
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-name">اسم الدرس *</label>
                        <input
                          id="creator-lesson-name"
                          type="text"
                          value={creatorLessonName}
                          onChange={(event) =>
                            setCreatorLessonName(event.target.value)
                          }
                        />
                      </div>
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-description">
                          وصف الدرس
                        </label>
                        <input
                          id="creator-lesson-description"
                          type="text"
                          value={creatorLessonDescription}
                          onChange={(event) =>
                            setCreatorLessonDescription(event.target.value)
                          }
                        />
                      </div>
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-period-number">
                          الحصة *
                        </label>
                        <select
                          id="creator-lesson-period-number"
                          value={creatorLessonPeriodNumber}
                          onChange={(event) =>
                            setCreatorLessonPeriodNumber(
                              Number(event.target.value)
                            )
                          }
                        >
                          {PERIOD_OPTIONS.map((periodOption, index) => (
                            <option key={periodOption} value={index + 1}>
                              {periodOption}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-periods">
                          عدد الحصص *
                        </label>
                        <select
                          id="creator-lesson-periods"
                          value={creatorLessonNumberOfPeriods}
                          onChange={(event) =>
                            setCreatorLessonNumberOfPeriods(
                              Number(event.target.value)
                            )
                          }
                        >
                          {LESSON_PERIOD_COUNT_OPTIONS.map((periodCount) => (
                            <option key={periodCount} value={periodCount}>
                              {periodCount}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="tcm2__field">
                      <label htmlFor="creator-lesson-content-type">
                        نوع المحتوى *
                      </label>
                      <select
                        id="creator-lesson-content-type"
                        value={creatorLessonContentType}
                        onChange={(event) => {
                          setCreatorLessonContentType(
                            event.target.value as LessonContentType
                          );
                          setCreatorLessonFile(null);
                        }}
                      >
                        <option value="text">نص</option>
                        <option value="pdf">ملف PDF</option>
                        <option value="word">ملف وورد (DOCX)</option>
                      </select>
                    </div>

                    {creatorLessonContentType === 'text' ? (
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-text-content">
                          محتوى الدرس *
                        </label>
                        <textarea
                          id="creator-lesson-text-content"
                          rows={5}
                          value={creatorLessonTextContent}
                          onChange={(event) =>
                            setCreatorLessonTextContent(event.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-file">ملف الدرس *</label>
                        <input
                          id="creator-lesson-file"
                          type="file"
                          accept={
                            creatorLessonContentType === 'pdf'
                              ? '.pdf,application/pdf'
                              : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          }
                          onChange={(event) =>
                            setCreatorLessonFile(
                              event.target.files?.[0] ?? null
                            )
                          }
                        />
                        <small>الحد الأقصى لحجم الملف: 25 ميجابايت.</small>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="tcm2__form-actions">
                <button
                  type="button"
                  onClick={resetCreatorForm}
                  disabled={saving}
                >
                  مسح
                </button>
                <button
                  type="submit"
                  className="tcm2__primary"
                  disabled={saving || !isCreatorValid}
                >
                  {saving && <span className="ui-button-spinner" aria-hidden />}
                  {saving ? 'جارٍ الحفظ...' : 'تنفيذ المسار'}
                </button>
              </div>
            </form>
          ) : (
            <div className="tcm2__empty">
              هذا المسار ينفع إذا أردت إنشاء الصف ثم المادة ثم الوحدة ثم الدرس
              مرة واحدة.
            </div>
          )}
        </section>
      </div>

      <ConfirmActionModal
        isOpen={Boolean(deleteRequest)}
        title="تأكيد الحذف"
        message={
          deleteRequest
            ? `سيتم حذف ${deleteRequest.label} نهائيًا. لا يمكن التراجع بعد الحذف.`
            : ''
        }
        endpoint={deleteRequest?.endpoint ?? '/api'}
        payload={deleteRequest?.payload}
        isLoading={saving}
        onCancel={() => setDeleteRequest(null)}
        onConfirm={async () => {
          if (!deleteRequest) {
            return;
          }
          await deleteEntity(deleteRequest.kind, deleteRequest.id);
          setDeleteRequest(null);
        }}
      />

      {quickAddDraft && (
        <div
          className="tcm2__modal-backdrop"
          onClick={() => !saving && setQuickAddDraft(null)}
          role="presentation"
        >
          <div
            className="tcm2__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {quickAddDraft.kind === 'class' && 'إضافة صف'}
              {quickAddDraft.kind === 'subject' && 'إضافة مادة'}
              {quickAddDraft.kind === 'unit' && 'إضافة وحدة'}
              {quickAddDraft.kind === 'lesson' && 'إضافة درس'}
            </h3>
            <p className="tcm2__required-note">الحقول التي عليها * مطلوبة.</p>
            {quickAddDraft.kind === 'class' && (
              <p className="tcm2__helper-note">
                ملاحظة: اختر العام والفصل والصف ثم أكمل بيانات الشعبة.
              </p>
            )}

            {quickAddDraft.kind !== 'class' && (
              <>
                {quickAddDraft.kind === 'subject' ? (
                  <SearchablePickerField
                    id="quick-add-name"
                    label="اسم المادة *"
                    value={quickAddDraft.name}
                    placeholder="اكتب اسم المادة"
                    helperText="ابحث داخل هذا الصف أو اكتب اسمًا جديدًا."
                    statusText={
                      quickAddDraft.name.trim().length === 0
                        ? ''
                        : quickAddSubjectSuggestions.length > 0
                          ? 'هناك مواد محفوظة مطابقة للاسم المدخل.'
                          : 'لن تُستخدم مادة محفوظة لهذا الاسم.'
                    }
                    suggestions={quickAddSubjectSuggestions}
                    onChange={(value) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              name: value,
                            }
                          : previous
                      )
                    }
                    onSelectSuggestion={(suggestion) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              name: suggestion.label,
                              description: suggestion.description ?? '',
                            }
                          : previous
                      )
                    }
                  />
                ) : quickAddDraft.kind === 'unit' ? (
                  <SearchablePickerField
                    id="quick-add-name"
                    label="اسم الوحدة *"
                    value={quickAddDraft.name}
                    placeholder="اكتب اسم الوحدة"
                    helperText="ابحث داخل المادة المحددة أو اكتب اسمًا جديدًا."
                    statusText={
                      quickAddDraft.name.trim().length === 0
                        ? ''
                        : quickAddUnitSuggestions.length > 0
                          ? 'هناك وحدات محفوظة مطابقة للاسم المدخل.'
                          : 'لن تُستخدم وحدة محفوظة لهذا الاسم.'
                    }
                    suggestions={quickAddUnitSuggestions}
                    onChange={(value) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              name: value,
                            }
                          : previous
                      )
                    }
                    onSelectSuggestion={(suggestion) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              name: suggestion.label,
                              description: suggestion.description ?? '',
                            }
                          : previous
                      )
                    }
                  />
                ) : (
                  <div className="tcm2__field">
                    <label htmlFor="quick-add-name">الاسم *</label>
                    <input
                      id="quick-add-name"
                      type="text"
                      value={quickAddDraft.name}
                      onChange={(event) =>
                        setQuickAddDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                name: event.target.value,
                              }
                            : previous
                        )
                      }
                    />
                  </div>
                )}

                <div className="tcm2__field">
                  <label htmlFor="quick-add-description">الوصف</label>
                  <textarea
                    id="quick-add-description"
                    rows={3}
                    value={quickAddDraft.description}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              description: event.target.value,
                            }
                          : previous
                      )
                    }
                  />
                </div>
              </>
            )}

            {quickAddDraft.kind === 'class' && (
              <div className="tcm2__inline-grid">
                <div className="tcm2__field">
                  <label htmlFor="quick-add-class-year">العام الدراسي *</label>
                  <select
                    id="quick-add-class-year"
                    value={
                      quickAddDraft.academicYear ?? ACADEMIC_YEAR_OPTIONS[0]
                    }
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              academicYear: event.target.value,
                            }
                          : previous
                      )
                    }
                  >
                    {ACADEMIC_YEAR_OPTIONS.map((yearOption) => (
                      <option key={yearOption} value={yearOption}>
                        {yearOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-class-semester">
                    الفصل الدراسي *
                  </label>
                  <select
                    id="quick-add-class-semester"
                    value={quickAddDraft.semester ?? SEMESTER_OPTIONS[0]}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              semester: event.target.value,
                            }
                          : previous
                      )
                    }
                  >
                    {SEMESTER_OPTIONS.map((semesterOption) => (
                      <option key={semesterOption} value={semesterOption}>
                        {semesterOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-class-grade">الصف *</label>
                  <select
                    id="quick-add-class-grade"
                    value={quickAddDraft.gradeLabel ?? ''}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              gradeLabel: event.target.value,
                            }
                          : previous
                      )
                    }
                  >
                    <option value="">اختر الصف</option>
                    {GRADE_OPTIONS.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-class-section">الشعبة *</label>
                  <input
                    id="quick-add-class-section"
                    type="text"
                    value={quickAddDraft.sectionLabel ?? ''}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              sectionLabel: event.target.value,
                            }
                          : previous
                      )
                    }
                  />
                </div>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-class-duration">
                    مدة الحصة الافتراضية (دقيقة) *
                  </label>
                  <select
                    id="quick-add-class-duration"
                    value={quickAddDraft.defaultDurationMinutes ?? 45}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              defaultDurationMinutes: Number(
                                event.target.value
                              ),
                            }
                          : previous
                      )
                    }
                  >
                    {LESSON_DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} دقيقة
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {quickAddDraft.kind === 'lesson' && (
              <>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-lesson-period-number">
                    الحصة *
                  </label>
                  <select
                    id="quick-add-lesson-period-number"
                    value={quickAddDraft.periodNumber ?? 1}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              periodNumber: Number(event.target.value),
                            }
                          : previous
                      )
                    }
                  >
                    {PERIOD_OPTIONS.map((periodOption, index) => (
                      <option key={periodOption} value={index + 1}>
                        {periodOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tcm2__field">
                  <label htmlFor="quick-add-lesson-periods">عدد الحصص *</label>
                  <select
                    id="quick-add-lesson-periods"
                    value={quickAddDraft.numberOfPeriods ?? 1}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              numberOfPeriods: Number(event.target.value),
                            }
                          : previous
                      )
                    }
                  >
                    {LESSON_PERIOD_COUNT_OPTIONS.map((periodCount) => (
                      <option key={periodCount} value={periodCount}>
                        {periodCount}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tcm2__field">
                  <label htmlFor="quick-add-content-type">نوع المحتوى *</label>
                  <select
                    id="quick-add-content-type"
                    value={quickAddDraft.contentType ?? 'text'}
                    onChange={(event) =>
                      setQuickAddDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              contentType: event.target
                                .value as LessonContentType,
                              content: '',
                              file: null,
                            }
                          : previous
                      )
                    }
                  >
                    <option value="text">نص</option>
                    <option value="pdf">ملف PDF</option>
                    <option value="word">ملف وورد (DOCX)</option>
                  </select>
                </div>

                {(quickAddDraft.contentType ?? 'text') === 'text' ? (
                  <div className="tcm2__field">
                    <label htmlFor="quick-add-content">المحتوى *</label>
                    <textarea
                      id="quick-add-content"
                      rows={5}
                      value={quickAddDraft.content ?? ''}
                      onChange={(event) =>
                        setQuickAddDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                content: event.target.value,
                              }
                            : previous
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="tcm2__field">
                    <label htmlFor="quick-add-file">ملف الدرس *</label>
                    <input
                      id="quick-add-file"
                      type="file"
                      accept={
                        (quickAddDraft.contentType ?? 'text') === 'pdf'
                          ? '.pdf,application/pdf'
                          : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      }
                      onChange={(event) =>
                        setQuickAddDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                file: event.target.files?.[0] ?? null,
                              }
                            : previous
                        )
                      }
                    />
                    <small>الحد الأقصى 25 ميجابايت.</small>
                  </div>
                )}
              </>
            )}

            <div className="tcm2__form-actions">
              <button
                type="button"
                onClick={() => setQuickAddDraft(null)}
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="tcm2__primary"
                onClick={() => void handleQuickAddSubmit()}
                disabled={saving || !isQuickAddValid}
              >
                {saving && <span className="ui-button-spinner" aria-hidden />}
                {saving ? 'جارٍ الحفظ...' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editDraft && (
        <div
          className="tcm2__modal-backdrop"
          onClick={() => !saving && setEditDraft(null)}
          role="presentation"
        >
          <div
            className="tcm2__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {editDraft.kind === 'class' && 'تعديل الصف'}
              {editDraft.kind === 'subject' && 'تعديل المادة'}
              {editDraft.kind === 'unit' && 'تعديل الوحدة'}
              {editDraft.kind === 'lesson' && 'تعديل الدرس'}
            </h3>

            {editDraft.kind !== 'class' && (
              <>
                <div className="tcm2__field">
                  <label htmlFor="edit-name">الاسم</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editDraft.name}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              name: event.target.value,
                            }
                          : previous
                      )
                    }
                  />
                </div>

                <div className="tcm2__field">
                  <label htmlFor="edit-description">الوصف</label>
                  <textarea
                    id="edit-description"
                    rows={3}
                    value={editDraft.description}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              description: event.target.value,
                            }
                          : previous
                      )
                    }
                  />
                </div>
              </>
            )}

            {editDraft.kind === 'class' && (
              <>
                <div className="tcm2__inline-grid">
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-grade-label">الصف</label>
                    <select
                      id="edit-class-grade-label"
                      value={editDraft.gradeLabel ?? ''}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                gradeLabel: event.target.value,
                              }
                            : previous
                        )
                      }
                    >
                      <option value="">اختر الصف</option>
                      {GRADE_OPTIONS.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-section-label">الشعبة</label>
                    <input
                      id="edit-class-section-label"
                      type="text"
                      value={editDraft.sectionLabel ?? ''}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                sectionLabel: event.target.value,
                              }
                            : previous
                        )
                      }
                    />
                  </div>
                </div>

                <div className="tcm2__inline-grid">
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-academic-year">
                      العام الدراسي
                    </label>
                    <select
                      id="edit-class-academic-year"
                      value={
                        editDraft.academicYear
                          ? normalizeAcademicYearLabel(editDraft.academicYear)
                          : ACADEMIC_YEAR_OPTIONS[0]
                      }
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                academicYear: event.target.value,
                              }
                            : previous
                        )
                      }
                    >
                      {ACADEMIC_YEAR_OPTIONS.map((yearOption) => (
                        <option key={yearOption} value={yearOption}>
                          {yearOption}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-semester">الفصل الدراسي</label>
                    <select
                      id="edit-class-semester"
                      value={editDraft.semester ?? SEMESTER_OPTIONS[0]}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                semester: event.target.value,
                              }
                            : previous
                        )
                      }
                    >
                      {SEMESTER_OPTIONS.map((semesterOption) => (
                        <option key={semesterOption} value={semesterOption}>
                          {semesterOption}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-default-duration">
                      المدة الافتراضية (دقيقة)
                    </label>
                    <select
                      id="edit-class-default-duration"
                      value={editDraft.defaultDurationMinutes ?? 45}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                defaultDurationMinutes: Number(
                                  event.target.value
                                ),
                              }
                            : previous
                        )
                      }
                    >
                      {LESSON_DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d} دقيقة
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {editDraft.kind === 'lesson' && (
              <>
                <div className="tcm2__field">
                  <label htmlFor="edit-lesson-unit">الوحدة</label>
                  <select
                    id="edit-lesson-unit"
                    value={editDraft.unitId ?? ''}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              unitId: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            }
                          : previous
                      )
                    }
                  >
                    <option value="">اختر الوحدة</option>
                    {units.map((unitItem) => (
                      <option key={unitItem.id} value={unitItem.id}>
                        {unitItem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tcm2__field">
                  <label htmlFor="edit-lesson-content-type">
                    نوع المحتوى *
                  </label>
                  <select
                    id="edit-lesson-content-type"
                    value={editDraft.contentType ?? 'text'}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              contentType: event.target
                                .value as LessonContentType,
                              file: null,
                            }
                          : previous
                      )
                    }
                  >
                    <option value="text">نص</option>
                    <option value="pdf">ملف PDF</option>
                    <option value="word">ملف وورد (DOCX)</option>
                  </select>
                </div>

                {(editDraft.contentType ?? 'text') === 'text' ? (
                  <div className="tcm2__field">
                    <label htmlFor="edit-lesson-content">المحتوى *</label>
                    <textarea
                      id="edit-lesson-content"
                      rows={6}
                      value={editDraft.content ?? ''}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                content: event.target.value,
                              }
                            : previous
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="tcm2__field">
                    <label htmlFor="edit-lesson-file">ملف الدرس *</label>
                    <input
                      id="edit-lesson-file"
                      type="file"
                      accept={
                        (editDraft.contentType ?? 'text') === 'pdf'
                          ? '.pdf,application/pdf'
                          : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      }
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                file: event.target.files?.[0] ?? null,
                              }
                            : previous
                        )
                      }
                    />
                    <small>الحد الأقصى 25 ميجابايت.</small>
                  </div>
                )}

                <div className="tcm2__field">
                  <label htmlFor="edit-lesson-period-number">الحصة *</label>
                  <select
                    id="edit-lesson-period-number"
                    value={editDraft.periodNumber ?? 1}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              periodNumber: Number(event.target.value),
                            }
                          : previous
                      )
                    }
                  >
                    {PERIOD_OPTIONS.map((periodOption, index) => (
                      <option key={periodOption} value={index + 1}>
                        {periodOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tcm2__field">
                  <label htmlFor="edit-lesson-periods">عدد الحصص *</label>
                  <select
                    id="edit-lesson-periods"
                    value={editDraft.numberOfPeriods ?? 1}
                    onChange={(event) =>
                      setEditDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              numberOfPeriods: Number(event.target.value),
                            }
                          : previous
                      )
                    }
                  >
                    {LESSON_PERIOD_COUNT_OPTIONS.map((periodCount) => (
                      <option key={periodCount} value={periodCount}>
                        {periodCount}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="tcm2__form-actions">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="tcm2__primary"
                onClick={() => void handleSaveEdit()}
                disabled={saving}
              >
                {saving && <span className="ui-button-spinner" aria-hidden />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherCirriculumManager;
