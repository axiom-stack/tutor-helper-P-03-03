import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdMenuBook,
  MdSchool,
  MdSubject,
  MdVisibility,
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
} from './teacher-curriculum-manager.services';
import {
  formatClassBaseSelectLabel,
  formatClassSelectLabel,
  formatClassShortLabel,
  getClassBaseKey,
  getClassSectionLabel,
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

interface LessonLibraryRow {
  lesson: Lesson;
  unit: Unit | null;
  subject: Subject | null;
  classItem: Class | null;
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

function TeacherCirriculumManager(props: {
  scope?: TeacherCirriculumManagerScope;
}) {
  const { scope } = props;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [selectedClassBaseKey, setSelectedClassBaseKey] = useState('');
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

  const [activeTab, setActiveTab] = useState<'structure' | 'library'>(() =>
    searchParams.get('tab') === 'library' ? 'library' : 'structure'
  );
  const [libraryGradeFilter, setLibraryGradeFilter] = useState('');
  const [librarySubjectIdFilter, setLibrarySubjectIdFilter] =
    useState<SelectValue>('');
  const [librarySemesterFilter, setLibrarySemesterFilter] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [viewLessonDetail, setViewLessonDetail] = useState<Lesson | null>(null);

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

  const selectedClass =
    selectedClassId === ''
      ? null
      : (classes.find((classItem) => classItem.id === selectedClassId) ?? null);
  const selectedSubject =
    selectedSubjectId === ''
      ? null
      : (subjects.find((subjectItem) => subjectItem.id === selectedSubjectId) ??
        null);

  const classGroups = useMemo(() => {
    const grouped = new Map<string, { baseClass: Class; sections: Class[] }>();

    filteredExistingClasses.forEach((classItem) => {
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
  }, [filteredExistingClasses]);

  const selectedClassSections = useMemo(() => {
    if (selectedClassBaseKey === '') {
      return [];
    }

    return (
      classGroups.find((group) => group.key === selectedClassBaseKey)
        ?.sections ?? []
    );
  }, [classGroups, selectedClassBaseKey]);

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

  const visibleSubjects = useMemo<Subject[]>(() => {
    if (selectedClassId !== '') {
      return orderedSubjects.filter(
        (subjectItem) => subjectItem.class_id === selectedClassId
      );
    }

    if (selectedClassBaseKey === '') {
      return orderedSubjects;
    }

    return orderedSubjects.filter((subjectItem) => {
      const subjectClass = classByIdMap.get(subjectItem.class_id) ?? null;
      return (
        subjectClass != null &&
        getClassBaseKey(subjectClass) === selectedClassBaseKey
      );
    });
  }, [orderedSubjects, selectedClassBaseKey, selectedClassId, classByIdMap]);

  const lessonLibraryRows = useMemo<LessonLibraryRow[]>(() => {
    return lessons.map((lessonItem) => {
      const unitItem =
        units.find((unitRow) => unitRow.id === lessonItem.unit_id) ?? null;
      const subjectItem = unitItem
        ? (subjects.find((s) => s.id === unitItem.subject_id) ?? null)
        : null;
      const classItem = subjectItem
        ? (classes.find((c) => c.id === subjectItem.class_id) ?? null)
        : null;
      return {
        lesson: lessonItem,
        unit: unitItem,
        subject: subjectItem,
        classItem,
      };
    });
  }, [lessons, units, subjects, classes]);

  const librarySubjectOptions = useMemo(() => {
    const map = new Map<number, Subject>();
    lessonLibraryRows.forEach((row) => {
      if (row.subject) {
        map.set(row.subject.id, row.subject);
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'ar')
    );
  }, [lessonLibraryRows]);

  const libraryGradeOptions = useMemo(() => {
    const set = new Set<string>();
    lessonLibraryRows.forEach((row) => {
      const label = row.classItem?.grade_label?.trim();
      if (label) {
        set.add(label);
      }
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'ar', { numeric: true })
    );
  }, [lessonLibraryRows]);

  const librarySemesterOptions = useMemo(() => {
    const set = new Set<string>();
    lessonLibraryRows.forEach((row) => {
      if (row.classItem?.semester) {
        set.add(normalizeSemesterLabel(row.classItem.semester));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [lessonLibraryRows]);

  const filteredLessonLibraryRows = useMemo(() => {
    return lessonLibraryRows.filter((row) => {
      const { lesson: lessonItem, subject: subjectItem, classItem } = row;
      if (librarySearchQuery.trim()) {
        const q = normalizeLookupText(librarySearchQuery).toLowerCase();
        if (
          !normalizeLookupText(lessonItem.name).toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (
        libraryGradeFilter &&
        (classItem?.grade_label?.trim() ?? '') !== libraryGradeFilter
      ) {
        return false;
      }
      if (librarySemesterFilter && classItem) {
        if (
          normalizeSemesterLabel(classItem.semester) !== librarySemesterFilter
        ) {
          return false;
        }
      }
      if (
        librarySubjectIdFilter !== '' &&
        subjectItem?.id !== librarySubjectIdFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    lessonLibraryRows,
    librarySearchQuery,
    libraryGradeFilter,
    librarySemesterFilter,
    librarySubjectIdFilter,
  ]);

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
      setSelectedClassBaseKey('');
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
      const nextClass =
        classes.find((classItem) => classItem.id === classId) ?? null;
      setSelectedClassId(classId);
      setSelectedClassBaseKey(
        nextClass ? getClassBaseKey(nextClass) : selectedClassBaseKey
      );
      setSelectedSubjectId(subjectId);
      setExpandedUnitIds(
        new Set(
          nextUnits
            .filter((unitItem) => unitItem.subject_id === subjectId)
            .map((unitItem) => unitItem.id)
        )
      );
    },
    [classes, selectedClassBaseKey, units]
  );

  const goToLessonInStructure = useCallback(
    (lessonItem: Lesson) => {
      const unitItem =
        units.find((unitRow) => unitRow.id === lessonItem.unit_id) ?? null;
      if (!unitItem) {
        return;
      }
      const subjectItem =
        subjects.find((subjectRow) => subjectRow.id === unitItem.subject_id) ??
        null;
      if (!subjectItem) {
        return;
      }
      activateSubjectView(subjectItem.id, subjectItem.class_id);
      ensureUnitExpanded(unitItem.id);
      setActiveTab('structure');
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('tab');
          return next;
        },
        { replace: true }
      );
    },
    [units, subjects, activateSubjectView, ensureUnitExpanded, setSearchParams]
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'library' ? 'library' : 'structure');
  }, [searchParams]);

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

  const handleClassGroupChange = (nextValue: string) => {
    setError(null);
    setSuccess(null);
    setClassSelectionMode('existing');
    setSelectedClassBaseKey(nextValue);
    setSelectedClassId('');

    if (nextValue === '') {
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
      return;
    }

    setSelectedSubjectId('');
    setExpandedUnitIds(new Set());
  };

  const handleClassSectionChange = (nextValue: SelectValue) => {
    setError(null);
    setSuccess(null);
    setClassSelectionMode('existing');
    setSelectedClassId(nextValue);

    if (nextValue === '') {
      setSelectedSubjectId('');
      setExpandedUnitIds(new Set());
      return;
    }

    const nextClass =
      classes.find((classItem) => classItem.id === nextValue) ?? null;
    setSelectedClassBaseKey(
      nextClass ? getClassBaseKey(nextClass) : selectedClassBaseKey
    );
    setSelectedSubjectId('');
    setExpandedUnitIds(new Set());
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
      const nextClass =
        classes.find((classItem) => classItem.id === nextSubject.class_id) ??
        null;
      setSelectedClassBaseKey(
        nextClass ? getClassBaseKey(nextClass) : selectedClassBaseKey
      );
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
      setSelectedClassBaseKey(getClassBaseKey(response.class));
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
        setSelectedClassBaseKey(getClassBaseKey(response.class));
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
          setSelectedClassBaseKey(getClassBaseKey(targetClass));
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
          setSelectedClassBaseKey(getClassBaseKey(targetClass));
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
        if (selectedClassId === response.class.id) {
          setSelectedClassBaseKey(getClassBaseKey(response.class));
        }
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
          setSelectedClassBaseKey('');
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

      <div
        className="tcm2__tabs"
        role="tablist"
        aria-label="أقسام إدارة المنهج"
      >
        <button
          type="button"
          role="tab"
          id="tcm-tab-structure"
          aria-selected={activeTab === 'structure'}
          className={
            activeTab === 'structure'
              ? 'tcm2__tab tcm2__tab--active'
              : 'tcm2__tab'
          }
          onClick={() => {
            setActiveTab('structure');
            setSearchParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.delete('tab');
                return next;
              },
              { replace: true }
            );
          }}
        >
          هيكل المنهج
        </button>
        <button
          type="button"
          role="tab"
          id="tcm-tab-library"
          aria-selected={activeTab === 'library'}
          className={
            activeTab === 'library' ? 'tcm2__tab tcm2__tab--active' : 'tcm2__tab'
          }
          onClick={() => {
            setActiveTab('library');
            setSearchParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.set('tab', 'library');
                return next;
              },
              { replace: true }
            );
          }}
        >
          دروسي
        </button>
      </div>

      {activeTab === 'library' ? (
        <section
          className="tcm2__library"
          role="tabpanel"
          id="tcm-panel-library"
          aria-labelledby="tcm-tab-library"
        >
          <div className="tcm2__library-intro">
            <h2 className="tcm2__library-title">مكتبة الدروس</h2>
            <p className="tcm2__library-desc">
              جميع الدروس التي أدخلتها مع إمكانية البحث والفلترة بالصف أو المادة
              أو الفصل الدراسي، ثم المراجعة أو التعديل أو الحذف أو الانتقال إلى
              موضع الدرس في الهيكل.
            </p>
          </div>

          <div className="tcm2__library-filters" aria-label="فلترة الدروس">
            <div className="tcm2__field">
              <label htmlFor="tcm-lib-search">بحث باسم الدرس</label>
              <input
                id="tcm-lib-search"
                type="search"
                value={librarySearchQuery}
                onChange={(event) => setLibrarySearchQuery(event.target.value)}
                placeholder="اكتب جزءًا من اسم الدرس"
                autoComplete="off"
              />
            </div>
            <div className="tcm2__field">
              <label htmlFor="tcm-lib-grade">الصف</label>
              <select
                id="tcm-lib-grade"
                value={libraryGradeFilter}
                onChange={(event) => setLibraryGradeFilter(event.target.value)}
              >
                <option value="">الكل</option>
                {libraryGradeOptions.map((gradeOption) => (
                  <option key={gradeOption} value={gradeOption}>
                    {gradeOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="tcm2__field">
              <label htmlFor="tcm-lib-subject">المادة</label>
              <select
                id="tcm-lib-subject"
                value={
                  librarySubjectIdFilter === ''
                    ? ''
                    : String(librarySubjectIdFilter)
                }
                onChange={(event) =>
                  setLibrarySubjectIdFilter(
                    event.target.value ? Number(event.target.value) : ''
                  )
                }
              >
                <option value="">الكل</option>
                {librarySubjectOptions.map((subjectOption) => (
                  <option key={subjectOption.id} value={subjectOption.id}>
                    {formatSubjectSelectLabel(
                      subjectOption,
                      classByIdMap.get(subjectOption.class_id) ?? null
                    )}
                  </option>
                ))}
              </select>
            </div>
            <div className="tcm2__field">
              <label htmlFor="tcm-lib-semester">الفصل الدراسي</label>
              <select
                id="tcm-lib-semester"
                value={librarySemesterFilter}
                onChange={(event) =>
                  setLibrarySemesterFilter(event.target.value)
                }
              >
                <option value="">الكل</option>
                {librarySemesterOptions.map((semesterOption) => (
                  <option key={semesterOption} value={semesterOption}>
                    {semesterOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="tcm2__library-filter-actions">
              <button
                type="button"
                className="tcm2__primary-soft"
                onClick={() => {
                  setLibrarySearchQuery('');
                  setLibraryGradeFilter('');
                  setLibrarySubjectIdFilter('');
                  setLibrarySemesterFilter('');
                }}
                disabled={
                  !librarySearchQuery &&
                  !libraryGradeFilter &&
                  librarySubjectIdFilter === '' &&
                  !librarySemesterFilter
                }
              >
                مسح الفلاتر
              </button>
              <button
                type="button"
                onClick={() => void loadCurriculumData()}
                disabled={loading || saving}
              >
                تحديث القائمة
              </button>
            </div>
          </div>

          <div className="tcm2__library-list-head">
            <span>{filteredLessonLibraryRows.length} درس</span>
          </div>

          {filteredLessonLibraryRows.length === 0 ? (
            <p className="tcm2__empty tcm2__library-empty">
              لا توجد دروس مطابقة. جرّب تغيير الفلاتر أو إضافة دروس من تبويب هيكل
              المنهج.
            </p>
          ) : (
            <div className="tcm2__library-cards" role="list">
              {filteredLessonLibraryRows.map((row) => {
                const {
                  lesson: lessonItem,
                  unit: unitItem,
                  subject: subjectItem,
                  classItem: classRow,
                } = row;
                return (
                  <article
                    key={lessonItem.id}
                    className="tcm2__library-card animate-fadeIn"
                    role="listitem"
                  >
                    <div className="tcm2__library-card-main">
                      <h3 className="tcm2__library-card-title">
                        {lessonItem.name}
                      </h3>
                      <div
                        className="tcm2__library-card-meta"
                        aria-label="تفاصيل الدرس"
                      >
                        {classRow ? (
                          <span>{formatClassShortLabel(classRow)}</span>
                        ) : null}
                        {subjectItem ? (
                          <>
                            <span className="tcm2__meta-separator" aria-hidden>
                              |
                            </span>
                            <span>{subjectItem.name}</span>
                          </>
                        ) : null}
                        {unitItem ? (
                          <>
                            <span className="tcm2__meta-separator" aria-hidden>
                              |
                            </span>
                            <span>{unitItem.name}</span>
                          </>
                        ) : null}
                      </div>
                      {lessonItem.description?.trim() ? (
                        <p className="tcm2__library-card-desc">
                          {lessonItem.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="tcm2__library-card-actions">
                      <button
                        type="button"
                        onClick={() => setViewLessonDetail(lessonItem)}
                      >
                        <MdVisibility aria-hidden />
                        عرض
                      </button>
                      <button
                        type="button"
                        className="tcm2__primary-soft"
                        onClick={() => goToLessonInStructure(lessonItem)}
                      >
                        في الهيكل
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForLesson(lessonItem)}
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
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div
          className="tcm2__grid"
          role="tabpanel"
          id="tcm-panel-structure"
          aria-labelledby="tcm-tab-structure"
        >
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
                      value={selectedClassBaseKey}
                      onChange={(event) =>
                        handleClassGroupChange(event.target.value)
                      }
                    >
                      <option value="">اختر الصف</option>
                      {classGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {formatClassBaseSelectLabel(group.baseClass)}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="active-class-section">
                      الشعبة المحفوظة
                    </label>
                    <select
                      id="active-class-section"
                      value={selectedClassId}
                      onChange={(event) =>
                        handleClassSectionChange(
                          event.target.value ? Number(event.target.value) : ''
                        )
                      }
                      disabled={
                        selectedClassBaseKey === '' ||
                        selectedClassSections.length === 0
                      }
                    >
                      <option value="">
                        {selectedClassBaseKey === ''
                          ? 'يرجى اختيار الصف أولاً ثم الشعبة'
                          : 'اختر الشعبة'}
                      </option>
                      {selectedClassSections.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {getClassSectionLabel(classItem)}
                        </option>
                      ))}
                    </select>
                    <small className="tcm2__field-hint">
                      يتم تمكين الشعبة بعد البدء باختيار الصف المحفوظ أعلاه.
                    </small>
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
                {visibleSubjects.map((subjectItem) => (
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
      </div>
      )}

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

      {viewLessonDetail ? (
        <div
          className="tcm2__modal-backdrop"
          onClick={() => setViewLessonDetail(null)}
          role="presentation"
        >
          <div
            className="tcm2__modal tcm2__modal--view-lesson"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>مراجعة الدرس</h3>
            {(() => {
              const detailRow = lessonLibraryRows.find(
                (row) => row.lesson.id === viewLessonDetail.id
              );
              return (
                <>
                  <p className="tcm2__view-lesson-title">
                    <strong>{viewLessonDetail.name}</strong>
                  </p>
                  <ul className="tcm2__view-lesson-meta">
                    {detailRow?.classItem ? (
                      <li>
                        الصف: {formatClassShortLabel(detailRow.classItem)}
                      </li>
                    ) : null}
                    {detailRow?.subject ? (
                      <li>المادة: {detailRow.subject.name}</li>
                    ) : null}
                    {detailRow?.unit ? (
                      <li>الوحدة: {detailRow.unit.name}</li>
                    ) : null}
                    <li>
                      الحصة: {Number(viewLessonDetail.period_number ?? 1)} | عدد
                      الحصص: {Number(viewLessonDetail.number_of_periods ?? 1)}
                    </li>
                  </ul>
                  {viewLessonDetail.description?.trim() ? (
                    <div className="tcm2__field">
                      <span className="tcm2__view-label">الوصف</span>
                      <p className="tcm2__view-text">
                        {viewLessonDetail.description}
                      </p>
                    </div>
                  ) : null}
                  <div className="tcm2__field">
                    <span className="tcm2__view-label">المحتوى النصي</span>
                    <pre className="tcm2__view-content-pre" dir="auto">
                      {viewLessonDetail.content?.trim()
                        ? viewLessonDetail.content
                        : 'لا يوجد نص محفوظ للعرض (قد يكون الدرس مرفقًا كملف PDF أو Word).'}
                    </pre>
                  </div>
                </>
              );
            })()}
            <div className="tcm2__form-actions">
              <button
                type="button"
                onClick={() => setViewLessonDetail(null)}
              >
                إغلاق
              </button>
              <button
                type="button"
                className="tcm2__primary"
                onClick={() => {
                  openEditForLesson(viewLessonDetail);
                  setViewLessonDetail(null);
                }}
              >
                تعديل
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <div className="tcm2__field">
                    <label htmlFor="quick-add-name">اسم الوحدة *</label>
                    <select
                      id="quick-add-name"
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
                    >
                      <option value="">اختر الوحدة</option>
                      {Array.from({ length: 20 }, (_, index) => index + 1).map(
                        (unitNumber) => (
                          <option key={unitNumber} value={String(unitNumber)}>
                            {unitNumber}
                          </option>
                        )
                      )}
                    </select>
                  </div>
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
