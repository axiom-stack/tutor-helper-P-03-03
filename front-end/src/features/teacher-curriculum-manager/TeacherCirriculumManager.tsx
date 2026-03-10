import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
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
import type {
  Class,
  Lesson,
  LessonContentType,
  Subject,
  Unit,
} from '../../types';
import {
  createClass,
  createLesson,
  createSubject,
  createUnit,
  deleteClass,
  deleteLesson,
  deleteSubject,
  deleteUnit,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  updateClass,
  updateLesson,
  updateSubject,
  updateUnit,
  type CreateLessonResponse,
} from './teacher-curriculum-manager.services';
import './teacher-cirriculum-manager.css';

type SelectValue = number | '';
type ClassMode = 'existing' | 'new';
type LevelMode = 'skip' | 'existing' | 'new';
type LessonMode = 'skip' | 'new';
type EntityKind = 'class' | 'subject' | 'unit' | 'lesson';

interface ApiErrorShape {
  response?: {
    data?: {
      error?: string;
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
  sectionLabel?: string;
  academicYear?: string;
  defaultDurationMinutes?: number;
  content?: string;
  unitId?: number;
  numberOfPeriods?: number;
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
    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
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

function getLessonCreationMessage(result: CreateLessonResponse): string {
  if (result.message) {
    return result.message;
  }
  if (result.content_type === 'text') {
    return 'تم إنشاء الدرس النصي بنجاح.';
  }
  return 'تم إنشاء الدرس بنجاح.';
}

function TeacherCirriculumManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const creatorSectionRef = useRef<HTMLDivElement | null>(null);
  const hierarchyRequestIdRef = useRef(0);
  const creatorUnitsRequestIdRef = useRef(0);

  const teacherId = user?.id ?? 0;

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessonsByUnit, setLessonsByUnit] = useState<Record<number, Lesson[]>>(
    {}
  );
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(new Set());

  const [selectedClassId, setSelectedClassId] = useState<SelectValue>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SelectValue>('');

  const [loading, setLoading] = useState(true);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const [creatorClassMode, setCreatorClassMode] = useState<ClassMode>('existing');
  const [creatorExistingClassId, setCreatorExistingClassId] =
    useState<SelectValue>('');
  const [creatorNewClassName, setCreatorNewClassName] = useState('');
  const [creatorNewClassDescription, setCreatorNewClassDescription] = useState('');
  const [creatorNewClassGradeLabel, setCreatorNewClassGradeLabel] = useState('');
  const [creatorNewClassSectionLabel, setCreatorNewClassSectionLabel] = useState('');
  const [creatorNewClassAcademicYear, setCreatorNewClassAcademicYear] = useState('');
  const [creatorNewClassDefaultDuration, setCreatorNewClassDefaultDuration] =
    useState<number>(45);

  const [creatorSubjectMode, setCreatorSubjectMode] = useState<LevelMode>('skip');
  const [creatorExistingSubjectId, setCreatorExistingSubjectId] =
    useState<SelectValue>('');
  const [creatorNewSubjectName, setCreatorNewSubjectName] = useState('');
  const [creatorNewSubjectDescription, setCreatorNewSubjectDescription] =
    useState('');

  const [creatorUnitMode, setCreatorUnitMode] = useState<LevelMode>('skip');
  const [creatorExistingUnitId, setCreatorExistingUnitId] = useState<SelectValue>('');
  const [creatorNewUnitName, setCreatorNewUnitName] = useState('');
  const [creatorNewUnitDescription, setCreatorNewUnitDescription] = useState('');
  const [creatorSubjectUnits, setCreatorSubjectUnits] = useState<Unit[]>([]);

  const [creatorLessonMode, setCreatorLessonMode] = useState<LessonMode>('skip');
  const [creatorLessonName, setCreatorLessonName] = useState('');
  const [creatorLessonDescription, setCreatorLessonDescription] = useState('');
  const [creatorLessonContentType, setCreatorLessonContentType] =
    useState<LessonContentType>('text');
  const [creatorLessonNumberOfPeriods, setCreatorLessonNumberOfPeriods] =
    useState<number>(1);
  const [creatorLessonTextContent, setCreatorLessonTextContent] = useState('');
  const [creatorLessonFile, setCreatorLessonFile] = useState<File | null>(null);

  const selectedClass =
    selectedClassId === ''
      ? null
      : classes.find((classItem) => classItem.id === selectedClassId) ?? null;
  const selectedSubject =
    selectedSubjectId === ''
      ? null
      : subjects.find((subjectItem) => subjectItem.id === selectedSubjectId) ??
        null;

  const subjectsForSelectedClass =
    selectedClassId === ''
      ? []
      : subjects.filter((subjectItem) => subjectItem.class_id === selectedClassId);

  const creatorSubjectsForClass =
    creatorClassMode === 'existing' && creatorExistingClassId !== ''
      ? subjects.filter(
          (subjectItem) => subjectItem.class_id === creatorExistingClassId
        )
      : [];

  const totalLessons = units.reduce(
    (sum, unitItem) => sum + (lessonsByUnit[unitItem.id]?.length ?? 0),
    0
  );

  const clearHierarchy = useCallback(() => {
    hierarchyRequestIdRef.current += 1;
    setUnits([]);
    setLessonsByUnit({});
    setExpandedUnitIds(new Set());
    setHierarchyLoading(false);
  }, []);

  const refreshBaseData = useCallback(async () => {
    const [classesResponse, subjectsResponse] = await Promise.all([
      getMyClasses(),
      getMySubjects(),
    ]);
    setClasses(classesResponse.classes ?? []);
    setSubjects(subjectsResponse.subjects ?? []);
  }, []);

  const loadHierarchyForSubject = useCallback(async (subjectId: number) => {
    const requestId = ++hierarchyRequestIdRef.current;
    setHierarchyLoading(true);

    try {
      const unitsResponse = await getUnitsBySubject(subjectId);
      if (requestId !== hierarchyRequestIdRef.current) {
        return;
      }

      const fetchedUnits = unitsResponse.units ?? [];
      setUnits(fetchedUnits);
      setExpandedUnitIds(new Set(fetchedUnits.map((unitItem) => unitItem.id)));

      const lessonResponses = await Promise.all(
        fetchedUnits.map(async (unitItem) => {
          const response = await getLessonsByUnit(unitItem.id);
          return {
            unitId: unitItem.id,
            lessons: response.lessons ?? [],
          };
        })
      );

      if (requestId !== hierarchyRequestIdRef.current) {
        return;
      }

      const nextLessonMap: Record<number, Lesson[]> = {};
      lessonResponses.forEach((item) => {
        nextLessonMap[item.unitId] = item.lessons;
      });

      setLessonsByUnit(nextLessonMap);
    } catch (loadError: unknown) {
      if (requestId === hierarchyRequestIdRef.current) {
        setError(getErrorMessage(loadError, 'فشل تحميل هيكل المنهج.'));
      }
    } finally {
      if (requestId === hierarchyRequestIdRef.current) {
        setHierarchyLoading(false);
      }
    }
  }, []);

  const resetCreatorForm = () => {
    setCreatorClassMode('existing');
    setCreatorExistingClassId('');
    setCreatorNewClassName('');
    setCreatorNewClassDescription('');
    setCreatorNewClassGradeLabel('');
    setCreatorNewClassSectionLabel('');
    setCreatorNewClassAcademicYear('');
    setCreatorNewClassDefaultDuration(45);
    setCreatorSubjectMode('skip');
    setCreatorExistingSubjectId('');
    setCreatorNewSubjectName('');
    setCreatorNewSubjectDescription('');
    setCreatorUnitMode('skip');
    setCreatorExistingUnitId('');
    setCreatorNewUnitName('');
    setCreatorNewUnitDescription('');
    setCreatorSubjectUnits([]);
    setCreatorLessonMode('skip');
    setCreatorLessonName('');
    setCreatorLessonDescription('');
    setCreatorLessonContentType('text');
    setCreatorLessonNumberOfPeriods(1);
    setCreatorLessonTextContent('');
    setCreatorLessonFile(null);
  };

  useEffect(() => {
    if (!user) {
      navigate('/authentication');
      return;
    }
    if (user.userRole === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.userRole !== 'teacher') {
      return;
    }

    let cancelled = false;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);

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
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, 'فشل تحميل بيانات المنهج.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
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
      hierarchyRequestIdRef.current += 1;
      setUnits([]);
      setLessonsByUnit({});
      setExpandedUnitIds(new Set());
      setHierarchyLoading(false);
      return;
    }

    void loadHierarchyForSubject(selectedSubjectId);
  }, [selectedSubjectId, loadHierarchyForSubject]);

  useEffect(() => {
    if (creatorSubjectMode !== 'existing' || creatorExistingSubjectId === '') {
      creatorUnitsRequestIdRef.current += 1;
      setCreatorSubjectUnits([]);
      setCreatorExistingUnitId('');
      return;
    }

    const requestId = ++creatorUnitsRequestIdRef.current;
    getUnitsBySubject(creatorExistingSubjectId)
      .then((response) => {
        if (requestId !== creatorUnitsRequestIdRef.current) {
          return;
        }
        setCreatorSubjectUnits(response.units ?? []);
      })
      .catch((loadError: unknown) => {
        if (requestId !== creatorUnitsRequestIdRef.current) {
          return;
        }
        setError(getErrorMessage(loadError, 'فشل تحميل وحدات المادة المختارة.'));
      });
  }, [creatorSubjectMode, creatorExistingSubjectId]);

  if (user?.userRole !== 'teacher') {
    return null;
  }

  const handleClassChange = (nextValue: SelectValue) => {
    setError(null);
    setSuccess(null);
    setSelectedClassId(nextValue);
    setSelectedSubjectId('');
    clearHierarchy();
  };

  const handleSubjectChange = (nextValue: SelectValue) => {
    setError(null);
    setSuccess(null);
    setSelectedSubjectId(nextValue);
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

  const openEditForSelectedClass = () => {
    if (!selectedClass) {
      return;
    }
    setEditDraft({
      kind: 'class',
      id: selectedClass.id,
      name: selectedClass.name,
      description: selectedClass.description,
      gradeLabel: selectedClass.grade_label,
      sectionLabel: selectedClass.section_label,
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
      description: selectedSubject.description,
    });
  };

  const openEditForUnit = (unitItem: Unit) => {
    setEditDraft({
      kind: 'unit',
      id: unitItem.id,
      name: unitItem.name,
      description: unitItem.description,
    });
  };

  const openEditForLesson = (lessonItem: Lesson) => {
    setEditDraft({
      kind: 'lesson',
      id: lessonItem.id,
      name: lessonItem.name,
      description: lessonItem.description,
      content: lessonItem.content,
      unitId: lessonItem.unit_id,
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
      if (!editDraft.name.trim()) {
        throw new Error('الاسم مطلوب.');
      }
      if (!editDraft.description.trim()) {
        throw new Error('الوصف مطلوب.');
      }

      if (editDraft.kind === 'class') {
        if (!editDraft.gradeLabel?.trim()) {
          throw new Error('المرحلة/الصف مطلوب.');
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
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
          grade_label: editDraft.gradeLabel?.trim() ?? '',
          section_label: editDraft.sectionLabel?.trim() ?? '',
          academic_year: editDraft.academicYear?.trim() ?? '',
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
        await updateUnit(editDraft.id, {
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
          subject_id: selectedSubjectId,
        });
        await loadHierarchyForSubject(selectedSubjectId);
      }

      if (editDraft.kind === 'lesson') {
        if (!editDraft.content || !editDraft.content.trim()) {
          throw new Error('محتوى الدرس مطلوب.');
        }
        if (!editDraft.unitId) {
          throw new Error('اختر وحدة للدرس.');
        }
        if (
          !Number.isInteger(editDraft.numberOfPeriods) ||
          Number(editDraft.numberOfPeriods) <= 0
        ) {
          throw new Error('عدد الحصص يجب أن يكون رقمًا صحيحًا موجبًا.');
        }
        await updateLesson(editDraft.id, {
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
          content: editDraft.content,
          unit_id: editDraft.unitId,
          number_of_periods: Number(editDraft.numberOfPeriods),
        });
        if (selectedSubjectId !== '') {
          await loadHierarchyForSubject(selectedSubjectId);
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

  const deleteEntity = async (kind: EntityKind, id: number, label: string) => {
    const accepted = window.confirm(`هل أنت متأكد من حذف ${label}؟`);
    if (!accepted) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (kind === 'class') {
        await deleteClass(id);
        setClasses((previous) => previous.filter((item) => item.id !== id));
        setSubjects((previous) => previous.filter((item) => item.class_id !== id));
        if (selectedClassId === id) {
          setSelectedClassId('');
          setSelectedSubjectId('');
          clearHierarchy();
        }
      }

      if (kind === 'subject') {
        await deleteSubject(id);
        setSubjects((previous) => previous.filter((item) => item.id !== id));
        if (selectedSubjectId === id) {
          setSelectedSubjectId('');
          clearHierarchy();
        }
      }

      if (kind === 'unit') {
        await deleteUnit(id);
        if (selectedSubjectId !== '') {
          await loadHierarchyForSubject(selectedSubjectId);
        }
      }

      if (kind === 'lesson') {
        await deleteLesson(id);
        if (selectedSubjectId !== '') {
          await loadHierarchyForSubject(selectedSubjectId);
        }
      }

      setSuccess('تم الحذف بنجاح.');
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, 'فشل تنفيذ عملية الحذف.'));
    } finally {
      setSaving(false);
    }
  };

  const prefillCreatorForUnit = () => {
    if (selectedClassId === '' || selectedSubjectId === '') {
      return;
    }

    setCreatorClassMode('existing');
    setCreatorExistingClassId(selectedClassId);
    setCreatorSubjectMode('existing');
    setCreatorExistingSubjectId(selectedSubjectId);
    setCreatorUnitMode('new');
    setCreatorLessonMode('skip');
    setCreatorExistingUnitId('');
    setCreatorLessonName('');
    setCreatorLessonDescription('');
    setCreatorLessonNumberOfPeriods(1);
    setCreatorLessonTextContent('');
    setCreatorLessonFile(null);

    creatorSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const prefillCreatorForLesson = () => {
    if (selectedClassId === '' || selectedSubjectId === '' || units.length === 0) {
      return;
    }

    setCreatorClassMode('existing');
    setCreatorExistingClassId(selectedClassId);
    setCreatorSubjectMode('existing');
    setCreatorExistingSubjectId(selectedSubjectId);
    setCreatorUnitMode('existing');
    setCreatorExistingUnitId(units[0]?.id ?? '');
    setCreatorLessonMode('new');
    setCreatorLessonContentType('text');
    setCreatorLessonNumberOfPeriods(1);
    setCreatorLessonTextContent('');
    setCreatorLessonFile(null);

    creatorSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
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
      let resolvedSubjectId: number | null = null;
      let resolvedUnitId: number | null = null;
      let lessonCreationResult: CreateLessonResponse | null = null;

      if (creatorClassMode === 'existing') {
        if (creatorExistingClassId === '') {
          throw new Error('اختر صفاً موجوداً أو أنشئ صفاً جديداً.');
        }
        resolvedClassId = creatorExistingClassId;
      } else {
        if (!creatorNewClassName.trim() || !creatorNewClassDescription.trim()) {
          throw new Error('يرجى إدخال اسم الصف ووصفه.');
        }
        if (!creatorNewClassGradeLabel.trim()) {
          throw new Error('يرجى إدخال المرحلة/الصف.');
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
          name: creatorNewClassName.trim(),
          description: creatorNewClassDescription.trim(),
          grade_label: creatorNewClassGradeLabel.trim(),
          section_label: creatorNewClassSectionLabel.trim(),
          academic_year: creatorNewClassAcademicYear.trim(),
          default_duration_minutes: creatorNewClassDefaultDuration,
          teacher_id: teacherId,
        });
        resolvedClassId = classResponse.class.id;
      }

      if (creatorSubjectMode === 'skip') {
        if (creatorUnitMode !== 'skip' || creatorLessonMode !== 'skip') {
          throw new Error('لا يمكن إضافة وحدة أو درس بدون تحديد مادة.');
        }
      } else if (creatorSubjectMode === 'existing') {
        if (creatorExistingSubjectId === '') {
          throw new Error('اختر مادة موجودة.');
        }

        const selectedCreatorSubject = subjects.find(
          (subjectItem) => subjectItem.id === creatorExistingSubjectId
        );
        if (!selectedCreatorSubject) {
          throw new Error('المادة المختارة غير موجودة.');
        }
        if (selectedCreatorSubject.class_id !== resolvedClassId) {
          throw new Error('المادة المختارة لا تتبع الصف المختار.');
        }

        resolvedSubjectId = creatorExistingSubjectId;
      } else {
        if (!creatorNewSubjectName.trim() || !creatorNewSubjectDescription.trim()) {
          throw new Error('يرجى إدخال اسم المادة ووصفها.');
        }

        const subjectResponse = await createSubject({
          class_id: resolvedClassId,
          teacher_id: teacherId,
          name: creatorNewSubjectName.trim(),
          description: creatorNewSubjectDescription.trim(),
        });
        resolvedSubjectId = subjectResponse.subject.id;
      }

      if (creatorUnitMode === 'skip') {
        if (creatorLessonMode !== 'skip') {
          throw new Error('لا يمكن إضافة درس بدون تحديد وحدة.');
        }
      } else if (creatorUnitMode === 'existing') {
        if (creatorExistingUnitId === '') {
          throw new Error('اختر وحدة موجودة.');
        }

        const selectedCreatorUnit = creatorSubjectUnits.find(
          (unitItem) => unitItem.id === creatorExistingUnitId
        );
        if (!selectedCreatorUnit) {
          throw new Error('الوحدة المختارة غير موجودة ضمن المادة المختارة.');
        }

        resolvedUnitId = creatorExistingUnitId;
      } else {
        if (!resolvedSubjectId) {
          throw new Error('لا يمكن إنشاء وحدة بدون مادة.');
        }
        if (!creatorNewUnitName.trim() || !creatorNewUnitDescription.trim()) {
          throw new Error('يرجى إدخال اسم الوحدة ووصفها.');
        }

        const unitResponse = await createUnit({
          subject_id: resolvedSubjectId,
          teacher_id: teacherId,
          name: creatorNewUnitName.trim(),
          description: creatorNewUnitDescription.trim(),
        });
        resolvedUnitId = unitResponse.unit.id;
      }

      if (creatorLessonMode === 'new') {
        if (!resolvedUnitId) {
          throw new Error('لا يمكن إنشاء درس بدون وحدة.');
        }
        if (!creatorLessonName.trim() || !creatorLessonDescription.trim()) {
          throw new Error('يرجى إدخال اسم الدرس ووصفه.');
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
            number_of_periods: creatorLessonNumberOfPeriods,
            teacher_id: teacherId,
            unit_id: resolvedUnitId,
          });
        } else {
          if (!creatorLessonFile) {
            throw new Error('يرجى اختيار ملف للدرس.');
          }
          if (creatorLessonFile.size > MAX_UPLOAD_SIZE_BYTES) {
            throw new Error('حجم الملف يتجاوز 25 ميجابايت.');
          }
          if (
            creatorLessonContentType === 'pdf' &&
            !isPdfFile(creatorLessonFile)
          ) {
            throw new Error('نوع الملف لا يطابق المحتوى المختار. المطلوب PDF.');
          }
          if (
            creatorLessonContentType === 'word' &&
            !isDocxFile(creatorLessonFile)
          ) {
            throw new Error('نوع الملف لا يطابق المحتوى المختار. المطلوب DOCX.');
          }

          lessonCreationResult = await createLesson({
            content_type: creatorLessonContentType,
            description: creatorLessonDescription.trim(),
            file: creatorLessonFile,
            name: creatorLessonName.trim(),
            number_of_periods: creatorLessonNumberOfPeriods,
            teacher_id: teacherId,
            unit_id: resolvedUnitId,
          });
        }
      }

      await refreshBaseData();
      setSelectedClassId(resolvedClassId);

      if (resolvedSubjectId) {
        setSelectedSubjectId(resolvedSubjectId);
        await loadHierarchyForSubject(resolvedSubjectId);
      } else {
        setSelectedSubjectId('');
        clearHierarchy();
      }

      resetCreatorForm();
      setCreatorClassMode('existing');
      setCreatorExistingClassId(resolvedClassId);
      if (resolvedSubjectId) {
        setCreatorSubjectMode('existing');
        setCreatorExistingSubjectId(resolvedSubjectId);
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
    <div className="tcm2" dir="rtl">
      <nav aria-label="breadcrumb">
        <ol className="tcm2__breadcrumb">
          <li>
            <Link to="/teacher">الرئيسية</Link>
          </li>
          <li className="tcm2__breadcrumb-current">المنهج الدراسي</li>
        </ol>
      </nav>

      <header className="tcm2__header">
        <h1>إدارة المنهج الدراسي</h1>
        <p>صفحة واحدة لإدارة الصفوف والمواد والوحدات والدروس بشكل مباشر.</p>
      </header>

      {error && (
        <div className="tcm2__alert tcm2__alert--error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="tcm2__alert tcm2__alert--success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <div className="tcm2__loading">جاري تحميل بيانات المنهج...</div>
      ) : (
        <div className="tcm2__grid">
          <section className="tcm2__panel">
            <div className="tcm2__panel-head">
              <h2>
                <MdSchool aria-hidden />
                هيكل المنهج
              </h2>
              <span>
                {units.length} وحدة / {totalLessons} درس
              </span>
            </div>

            <div className="tcm2__selectors">
              <div className="tcm2__field">
                <label htmlFor="active-class">الصف</label>
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
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tcm2__field">
                <label htmlFor="active-subject">المادة</label>
                <select
                  id="active-subject"
                  value={selectedSubjectId}
                  onChange={(event) =>
                    handleSubjectChange(
                      event.target.value ? Number(event.target.value) : ''
                    )
                  }
                  disabled={selectedClassId === ''}
                >
                  <option value="">اختر المادة</option>
                  {subjectsForSelectedClass.map((subjectItem) => (
                    <option key={subjectItem.id} value={subjectItem.id}>
                      {subjectItem.name}
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
                    {selectedClass.name}
                  </h3>
                  <p>{selectedClass.description}</p>
                  <p>
                    الصف/المرحلة: {selectedClass.grade_label} | الشعبة:{' '}
                    {selectedClass.section_label}
                  </p>
                  <p>
                    العام الدراسي: {selectedClass.academic_year} | المدة الافتراضية:{' '}
                    {selectedClass.default_duration_minutes} دقيقة
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
                      void deleteEntity('class', selectedClass.id, 'هذا الصف')
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
                  <p>{selectedSubject.description}</p>
                </div>
                <div className="tcm2__meta-actions">
                  <button type="button" onClick={openEditForSelectedSubject}>
                    <MdEdit aria-hidden />
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="tcm2__danger"
                    onClick={() =>
                      void deleteEntity('subject', selectedSubject.id, 'هذه المادة')
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
                onClick={prefillCreatorForUnit}
                disabled={!selectedSubject}
              >
                <MdAdd aria-hidden />
                إضافة وحدة للمادة الحالية
              </button>
              <button
                type="button"
                onClick={prefillCreatorForLesson}
                disabled={!selectedSubject || units.length === 0}
              >
                <MdAdd aria-hidden />
                إضافة درس للمادة الحالية
              </button>
            </div>

            {!selectedSubject ? (
              <div className="tcm2__empty">
                اختر الصف والمادة لعرض الهيكل. التحميل يتم تلقائياً عند تغيير
                الاختيار.
              </div>
            ) : hierarchyLoading ? (
              <div className="tcm2__loading">جاري تحميل الوحدات والدروس...</div>
            ) : units.length === 0 ? (
              <div className="tcm2__empty">لا توجد وحدات بعد لهذه المادة.</div>
            ) : (
              <div className="tcm2__hierarchy">
                {units.map((unitItem) => {
                  const unitLessons = lessonsByUnit[unitItem.id] ?? [];
                  const isExpanded = expandedUnitIds.has(unitItem.id);

                  return (
                    <article key={unitItem.id} className="tcm2__unit">
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
                            onClick={() => openEditForUnit(unitItem)}
                          >
                            <MdEdit aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="tcm2__danger"
                            onClick={() =>
                              void deleteEntity('unit', unitItem.id, 'هذه الوحدة')
                            }
                            disabled={saving}
                          >
                            <MdDelete aria-hidden />
                          </button>
                        </div>
                      </header>

                      {isExpanded && (
                        <div className="tcm2__unit-body">
                          <p className="tcm2__unit-description">
                            {unitItem.description}
                          </p>
                          {unitLessons.length === 0 ? (
                            <p className="tcm2__empty-small">
                              لا توجد دروس داخل هذه الوحدة.
                            </p>
                          ) : (
                            <ul className="tcm2__lesson-list">
                              {unitLessons.map((lessonItem) => (
                                <li key={lessonItem.id} className="tcm2__lesson-row">
                                  <div className="tcm2__lesson-main">
                                    <MdMenuBook aria-hidden />
                                    <div>
                                      <strong>{lessonItem.name}</strong>
                                      <p>{lessonItem.description}</p>
                                      <small>
                                        عدد الحصص: {Number(lessonItem.number_of_periods ?? 1)}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="tcm2__row-actions">
                                    <button
                                      type="button"
                                      onClick={() => openEditForLesson(lessonItem)}
                                    >
                                      <MdEdit aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="tcm2__danger"
                                      onClick={() =>
                                        void deleteEntity(
                                          'lesson',
                                          lessonItem.id,
                                          'هذا الدرس'
                                        )
                                      }
                                      disabled={saving}
                                    >
                                      <MdDelete aria-hidden />
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

          <section className="tcm2__panel" ref={creatorSectionRef}>
            <div className="tcm2__panel-head">
              <h2>
                <MdViewModule aria-hidden />
                مسار إنشاء متكامل
              </h2>
              <span>Class → Subject → Unit → Lesson</span>
            </div>

            <form className="tcm2__form" onSubmit={handleCreatorSubmit}>
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
                    className={creatorClassMode === 'new' ? 'tcm2__mode-active' : ''}
                    onClick={() => setCreatorClassMode('new')}
                  >
                    إنشاء صف جديد
                  </button>
                </div>

                {creatorClassMode === 'existing' ? (
                  <div className="tcm2__field">
                    <label htmlFor="creator-existing-class">الصف الموجود</label>
                    <select
                      id="creator-existing-class"
                      value={creatorExistingClassId}
                      onChange={(event) => {
                        const nextClassId = event.target.value
                          ? Number(event.target.value)
                          : '';
                        setCreatorExistingClassId(nextClassId);
                        if (
                          creatorExistingSubjectId !== '' &&
                          !subjects.some(
                            (subjectItem) =>
                              subjectItem.id === creatorExistingSubjectId &&
                              subjectItem.class_id === nextClassId
                          )
                        ) {
                          setCreatorExistingSubjectId('');
                        }
                      }}
                    >
                      <option value="">اختر الصف</option>
                      {classes.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="tcm2__inline-grid">
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-name">اسم الصف</label>
                      <input
                        id="creator-new-class-name"
                        type="text"
                        value={creatorNewClassName}
                        onChange={(event) =>
                          setCreatorNewClassName(event.target.value)
                        }
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-description">وصف الصف</label>
                      <input
                        id="creator-new-class-description"
                        type="text"
                        value={creatorNewClassDescription}
                        onChange={(event) =>
                          setCreatorNewClassDescription(event.target.value)
                        }
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-grade-label">
                        المرحلة / الصف
                      </label>
                      <input
                        id="creator-new-class-grade-label"
                        type="text"
                        value={creatorNewClassGradeLabel}
                        onChange={(event) =>
                          setCreatorNewClassGradeLabel(event.target.value)
                        }
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-section-label">الشعبة</label>
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
                      <label htmlFor="creator-new-class-academic-year">
                        العام الدراسي
                      </label>
                      <input
                        id="creator-new-class-academic-year"
                        type="text"
                        value={creatorNewClassAcademicYear}
                        onChange={(event) =>
                          setCreatorNewClassAcademicYear(event.target.value)
                        }
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-class-default-duration">
                        المدة الافتراضية (دقيقة)
                      </label>
                      <input
                        id="creator-new-class-default-duration"
                        type="number"
                        min={1}
                        value={creatorNewClassDefaultDuration}
                        onChange={(event) =>
                          setCreatorNewClassDefaultDuration(Number(event.target.value))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="tcm2__step">
                <h3>2) المادة</h3>
                <div className="tcm2__field">
                  <label htmlFor="creator-subject-mode">المادة</label>
                  <select
                    id="creator-subject-mode"
                    value={creatorSubjectMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as LevelMode;
                      setCreatorSubjectMode(nextMode);
                      if (nextMode === 'skip') {
                        setCreatorUnitMode('skip');
                        setCreatorLessonMode('skip');
                      }
                      if (nextMode !== 'existing') {
                        setCreatorExistingSubjectId('');
                      }
                    }}
                  >
                    <option value="skip">عدم إضافة مادة</option>
                    <option value="existing" disabled={creatorClassMode === 'new'}>
                      استخدام مادة موجودة
                    </option>
                    <option value="new">إنشاء مادة جديدة</option>
                  </select>
                </div>

                {creatorSubjectMode === 'existing' && (
                  <div className="tcm2__field">
                    <label htmlFor="creator-existing-subject">المادة الموجودة</label>
                    <select
                      id="creator-existing-subject"
                      value={creatorExistingSubjectId}
                      onChange={(event) =>
                        setCreatorExistingSubjectId(
                          event.target.value ? Number(event.target.value) : ''
                        )
                      }
                      disabled={creatorExistingClassId === ''}
                    >
                      <option value="">اختر المادة</option>
                      {creatorSubjectsForClass.map((subjectItem) => (
                        <option key={subjectItem.id} value={subjectItem.id}>
                          {subjectItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {creatorSubjectMode === 'new' && (
                  <div className="tcm2__inline-grid">
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-subject-name">اسم المادة</label>
                      <input
                        id="creator-new-subject-name"
                        type="text"
                        value={creatorNewSubjectName}
                        onChange={(event) =>
                          setCreatorNewSubjectName(event.target.value)
                        }
                      />
                    </div>
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
                )}
              </div>

              <div className="tcm2__step">
                <h3>3) الوحدة</h3>
                <div className="tcm2__field">
                  <label htmlFor="creator-unit-mode">الوحدة</label>
                  <select
                    id="creator-unit-mode"
                    value={creatorUnitMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as LevelMode;
                      setCreatorUnitMode(nextMode);
                      if (nextMode === 'skip') {
                        setCreatorLessonMode('skip');
                      }
                      if (nextMode !== 'existing') {
                        setCreatorExistingUnitId('');
                      }
                    }}
                  >
                    <option value="skip">عدم إضافة وحدة</option>
                    <option value="existing" disabled={creatorSubjectMode !== 'existing'}>
                      استخدام وحدة موجودة
                    </option>
                    <option value="new" disabled={creatorSubjectMode === 'skip'}>
                      إنشاء وحدة جديدة
                    </option>
                  </select>
                </div>

                {creatorUnitMode === 'existing' && (
                  <div className="tcm2__field">
                    <label htmlFor="creator-existing-unit">الوحدة الموجودة</label>
                    <select
                      id="creator-existing-unit"
                      value={creatorExistingUnitId}
                      onChange={(event) =>
                        setCreatorExistingUnitId(
                          event.target.value ? Number(event.target.value) : ''
                        )
                      }
                      disabled={creatorExistingSubjectId === ''}
                    >
                      <option value="">اختر الوحدة</option>
                      {creatorSubjectUnits.map((unitItem) => (
                        <option key={unitItem.id} value={unitItem.id}>
                          {unitItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {creatorUnitMode === 'new' && (
                  <div className="tcm2__inline-grid">
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-unit-name">اسم الوحدة</label>
                      <input
                        id="creator-new-unit-name"
                        type="text"
                        value={creatorNewUnitName}
                        onChange={(event) => setCreatorNewUnitName(event.target.value)}
                      />
                    </div>
                    <div className="tcm2__field">
                      <label htmlFor="creator-new-unit-description">وصف الوحدة</label>
                      <input
                        id="creator-new-unit-description"
                        type="text"
                        value={creatorNewUnitDescription}
                        onChange={(event) =>
                          setCreatorNewUnitDescription(event.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
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
                    disabled={creatorUnitMode === 'skip'}
                  >
                    <option value="skip">عدم إضافة درس</option>
                    <option value="new">إنشاء درس جديد</option>
                  </select>
                </div>

                {creatorLessonMode === 'new' && (
                  <>
                    <div className="tcm2__inline-grid">
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-name">اسم الدرس</label>
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
                        <label htmlFor="creator-lesson-description">وصف الدرس</label>
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
                        <label htmlFor="creator-lesson-periods">عدد الحصص</label>
                        <input
                          id="creator-lesson-periods"
                          type="number"
                          min={1}
                          value={creatorLessonNumberOfPeriods}
                          onChange={(event) =>
                            setCreatorLessonNumberOfPeriods(Number(event.target.value))
                          }
                        />
                      </div>
                    </div>

                    <div className="tcm2__field">
                      <label htmlFor="creator-lesson-content-type">نوع المحتوى</label>
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
                        <option value="text">Text</option>
                        <option value="pdf">PDF</option>
                        <option value="word">Word (DOCX)</option>
                      </select>
                    </div>

                    {creatorLessonContentType === 'text' ? (
                      <div className="tcm2__field">
                        <label htmlFor="creator-lesson-text-content">محتوى الدرس</label>
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
                        <label htmlFor="creator-lesson-file">ملف الدرس</label>
                        <input
                          id="creator-lesson-file"
                          type="file"
                          accept={
                            creatorLessonContentType === 'pdf'
                              ? '.pdf,application/pdf'
                              : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          }
                          onChange={(event) =>
                            setCreatorLessonFile(event.target.files?.[0] ?? null)
                          }
                        />
                        <small>الحد الأقصى لحجم الملف: 25 ميجابايت.</small>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="tcm2__form-actions">
                <button type="button" onClick={resetCreatorForm} disabled={saving}>
                  إعادة تعيين
                </button>
                <button type="submit" className="tcm2__primary" disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : 'تنفيذ المسار'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editDraft && (
        <div
          className="tcm2__modal-backdrop"
          onClick={() => !saving && setEditDraft(null)}
          role="presentation"
        >
          <div className="tcm2__modal" onClick={(event) => event.stopPropagation()}>
            <h3>
              {editDraft.kind === 'class' && 'تعديل الصف'}
              {editDraft.kind === 'subject' && 'تعديل المادة'}
              {editDraft.kind === 'unit' && 'تعديل الوحدة'}
              {editDraft.kind === 'lesson' && 'تعديل الدرس'}
            </h3>

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

            {editDraft.kind === 'class' && (
              <>
                <div className="tcm2__inline-grid">
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-grade-label">المرحلة / الصف</label>
                    <input
                      id="edit-class-grade-label"
                      type="text"
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
                    />
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
                    <label htmlFor="edit-class-academic-year">العام الدراسي</label>
                    <input
                      id="edit-class-academic-year"
                      type="text"
                      value={editDraft.academicYear ?? ''}
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
                    />
                  </div>
                  <div className="tcm2__field">
                    <label htmlFor="edit-class-default-duration">
                      المدة الافتراضية (دقيقة)
                    </label>
                    <input
                      id="edit-class-default-duration"
                      type="number"
                      min={1}
                      value={editDraft.defaultDurationMinutes ?? 45}
                      onChange={(event) =>
                        setEditDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                defaultDurationMinutes: Number(event.target.value),
                              }
                            : previous
                        )
                      }
                    />
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
                  <label htmlFor="edit-lesson-content">المحتوى</label>
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

                <div className="tcm2__field">
                  <label htmlFor="edit-lesson-periods">عدد الحصص</label>
                  <input
                    id="edit-lesson-periods"
                    type="number"
                    min={1}
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
                  />
                </div>
              </>
            )}

            <div className="tcm2__form-actions">
              <button type="button" onClick={() => setEditDraft(null)} disabled={saving}>
                إلغاء
              </button>
              <button
                type="button"
                className="tcm2__primary"
                onClick={() => void handleSaveEdit()}
                disabled={saving}
              >
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
