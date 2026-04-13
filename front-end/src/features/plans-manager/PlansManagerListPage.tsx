import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { MdRefresh } from 'react-icons/md';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import ExportFormatModal from '../../components/common/ExportFormatModal';
import { SyncStatusBadge } from '../../components/common/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';
import type {
  Class,
  Lesson,
  Subject,
  TeacherManagementRow,
  Unit,
} from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { useOffline } from '../../offline/useOffline';
import { isLocalOnlyId } from '../../offline/utils';
import type { OfflineLessonPlanRecord } from '../../offline/types';
import {
  asRecord,
  toDisplayText,
  toPlanTypeLabel,
} from '../lesson-plans/planDisplay';
import {
  getAllClasses,
  getAllSubjects,
  getLessonsByUnit,
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
} from '../lesson-creator/lesson-creator.services';
import { listTeachers } from '../users/users.services';
import {
  deletePlanById,
  exportPlan,
  listPlans,
} from './plans-manager.services';
import './plans-manager.css';

type PlanTypeFilter = '' | 'traditional' | 'active_learning';

function toOptionalText(value: unknown): string | null {
  const text = toDisplayText(value);
  return text === '—' ? null : text;
}

function getPlanHeader(plan: OfflineLessonPlanRecord): Record<string, unknown> {
  return asRecord(plan.plan_json?.header) ?? {};
}

function getPlanSemester(plan: OfflineLessonPlanRecord): string | null {
  const header = getPlanHeader(plan);
  return toOptionalText(header.semester) ?? toOptionalText(header.term) ?? null;
}

function getPlanAcademicYear(plan: OfflineLessonPlanRecord): string | null {
  const header = getPlanHeader(plan);
  return (
    toOptionalText(header.academic_year) ??
    toOptionalText(header.academicYear) ??
    null
  );
}

function getPlanPeriod(plan: OfflineLessonPlanRecord): string | null {
  const header = getPlanHeader(plan);
  const timeValue = toOptionalText(header.time);

  // Check if it's one of the period options (الأولى, الثانية, etc.)
  if (
    timeValue &&
    /^ال(أولى|ثانية|ثالثة|رابعة|خامسة|سادسة|سابعة)$/.test(timeValue)
  ) {
    return `حصة ${timeValue}`;
  }

  return null;
}

function getClassSemesterLabel(
  classItem: Class | null | undefined
): string | null {
  if (!classItem) {
    return null;
  }

  return toOptionalText(classItem.semester);
}

function getClassAcademicYearLabel(
  classItem: Class | null | undefined
): string | null {
  if (!classItem) {
    return null;
  }

  return toOptionalText(classItem.academic_year);
}

function buildPlanMeta(plan: OfflineLessonPlanRecord): string[] {
  const header = getPlanHeader(plan);
  const parts = [
    toOptionalText(plan.unit),
    toOptionalText(plan.subject),
    toOptionalText(plan.grade),
    toOptionalText(header.section),
    getPlanPeriod(plan),
    getPlanSemester(plan),
    getPlanAcademicYear(plan),
  ];

  return parts.filter((value): value is string => Boolean(value));
}

export default function PlansManagerListPage() {
  const { user } = useAuth();
  const { lastSyncAt } = useOffline();
  const isAdmin = user?.userRole === 'admin';

  const [allPlans, setAllPlans] = useState<OfflineLessonPlanRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);

  const [planType, setPlanType] = useState<PlanTypeFilter>('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormatOpen, setExportFormatOpen] = useState(false);
  const [exportTargetPlan, setExportTargetPlan] =
    useState<OfflineLessonPlanRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetPlan, setDeleteTargetPlan] =
    useState<OfflineLessonPlanRecord | null>(null);
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  const plansRequestIdRef = useRef(0);

  const teacherNameMap = useMemo(() => {
    return new Map(
      teachers.map((teacher) => [
        teacher.id,
        teacher.display_name || teacher.username,
      ])
    );
  }, [teachers]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    allPlans.forEach((plan) => {
      if (plan.subject?.trim()) {
        set.add(plan.subject.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPlans]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    allPlans.forEach((plan) => {
      if (plan.grade?.trim()) {
        set.add(plan.grade.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPlans]);

  const lessonById = useMemo(() => {
    return new Map(lessons.map((lesson) => [lesson.id, lesson]));
  }, [lessons]);

  const unitById = useMemo(() => {
    return new Map(units.map((unit) => [unit.id, unit]));
  }, [units]);

  const subjectById = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  const classById = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const semesterOptions = useMemo(() => {
    const set = new Set<string>();
    const addValue = (value: string | null) => {
      if (value) {
        set.add(value);
      }
    };

    allPlans.forEach((plan) => {
      const lesson =
        plan.lesson_id != null ? lessonById.get(plan.lesson_id) : null;
      const unit = lesson ? unitById.get(lesson.unit_id) : null;
      const subject = unit ? subjectById.get(unit.subject_id) : null;
      const classItem = subject ? classById.get(subject.class_id) : null;
      addValue(getClassSemesterLabel(classItem));
      addValue(getPlanSemester(plan));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPlans, classById, lessonById, subjectById, unitById]);

  const academicYearOptions = useMemo(() => {
    const set = new Set<string>();
    const addValue = (value: string | null) => {
      if (value) {
        set.add(value);
      }
    };

    allPlans.forEach((plan) => {
      const lesson =
        plan.lesson_id != null ? lessonById.get(plan.lesson_id) : null;
      const unit = lesson ? unitById.get(lesson.unit_id) : null;
      const subject = unit ? subjectById.get(unit.subject_id) : null;
      const classItem = subject ? classById.get(subject.class_id) : null;
      addValue(getClassAcademicYearLabel(classItem));
      addValue(getPlanAcademicYear(plan));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPlans, classById, lessonById, subjectById, unitById]);

  const plans = useMemo(() => {
    return allPlans.filter((plan) => {
      if (planType && plan.plan_type !== planType) {
        return false;
      }
      if (subject && plan.subject !== subject) {
        return false;
      }
      if (grade && plan.grade !== grade) {
        return false;
      }
      const lesson =
        plan.lesson_id != null ? lessonById.get(plan.lesson_id) : null;
      const unit = lesson ? unitById.get(lesson.unit_id) : null;
      const subjectRecord = unit ? subjectById.get(unit.subject_id) : null;
      const classItem = subjectRecord
        ? classById.get(subjectRecord.class_id)
        : null;
      const planSemester =
        getClassSemesterLabel(classItem) ?? getPlanSemester(plan);
      const planAcademicYear =
        getClassAcademicYearLabel(classItem) ?? getPlanAcademicYear(plan);

      if (semester && planSemester !== semester) {
        return false;
      }
      if (academicYear && planAcademicYear !== academicYear) {
        return false;
      }
      return true;
    });
  }, [
    academicYear,
    allPlans,
    classById,
    grade,
    lessonById,
    planType,
    semester,
    subject,
    subjectById,
    unitById,
  ]);

  const loadPlans = async () => {
    const requestId = ++plansRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listPlans({});

      if (requestId !== plansRequestIdRef.current) {
        return;
      }

      setAllPlans((response.plans ?? []) as OfflineLessonPlanRecord[]);
    } catch (loadError: unknown) {
      if (requestId !== plansRequestIdRef.current) {
        return;
      }

      const message = normalizeApiError(loadError, 'فشل تحميل الخطط.').message;
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === plansRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastSyncAt) {
      return;
    }

    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let cancelled = false;
    listTeachers()
      .then((response) => {
        if (!cancelled) {
          setTeachers(response.teachers ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeachers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    let cancelled = false;

    const loadRelationData = async () => {
      try {
        const [classesResponse, subjectsResponse] = await Promise.all([
          user.userRole === 'admin' ? getAllClasses() : getMyClasses(),
          user.userRole === 'admin' ? getAllSubjects() : getMySubjects(),
        ]);

        if (cancelled) {
          return;
        }

        const nextClasses = classesResponse.classes ?? [];
        const nextSubjects = subjectsResponse.subjects ?? [];

        setClasses(nextClasses);
        setSubjects(nextSubjects);

        const unitsResponses = await Promise.all(
          nextSubjects.map((subjectItem) => getUnitsBySubject(subjectItem.id))
        );
        if (cancelled) {
          return;
        }

        const nextUnits = unitsResponses.flatMap(
          (response) => response.units ?? []
        );
        setUnits(nextUnits);

        const lessonsResponses = await Promise.all(
          nextUnits.map((unitItem) => getLessonsByUnit(unitItem.id))
        );
        if (cancelled) {
          return;
        }

        setLessons(
          lessonsResponses.flatMap((response) => response.lessons ?? [])
        );
      } catch {
        if (!cancelled) {
          setClasses([]);
          setSubjects([]);
          setUnits([]);
          setLessons([]);
        }
      }
    };

    void loadRelationData();

    return () => {
      cancelled = true;
    };
  }, [user?.userRole]);

  const clearFilters = () => {
    setPlanType('');
    setSubject('');
    setGrade('');
    setSemester('');
    setAcademicYear('');
  };

  const openExportDialog = (plan: OfflineLessonPlanRecord) => {
    setExportTargetPlan(plan);
    setExportFormatOpen(true);
  };

  const openDeleteDialog = (plan: OfflineLessonPlanRecord) => {
    setDeleteTargetPlan(plan);
    setDeleteConfirmOpen(true);
  };

  const handleExportSelectedPlan = async (format: 'pdf' | 'docx') => {
    if (!exportTargetPlan?.public_id) {
      return;
    }

    try {
      setIsExportingPlan(true);
      await exportPlan(exportTargetPlan.public_id, format);
      toast.success('تم تصدير الخطة بنجاح.');
      setExportFormatOpen(false);
    } catch (exportError: unknown) {
      toast.error(normalizeApiError(exportError, 'فشل تصدير الخطة.').message);
    } finally {
      setIsExportingPlan(false);
      setExportTargetPlan(null);
    }
  };

  const handleDeleteSelectedPlan = async () => {
    if (!deleteTargetPlan?.public_id) {
      return;
    }

    try {
      setIsDeletingPlan(true);
      await deletePlanById(deleteTargetPlan.public_id);
      toast.success('تم حذف الخطة بنجاح.');
      await loadPlans();
    } catch (deleteError: unknown) {
      toast.error(normalizeApiError(deleteError, 'فشل حذف الخطة.').message);
    } finally {
      setIsDeletingPlan(false);
      setDeleteConfirmOpen(false);
      setDeleteTargetPlan(null);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="pm ui-loaded">
      <header className="pm__header page-header">
        <div>
          <h1>مكتبة الخطط</h1>
          <p>
            استعرض الخطط المولدة بسرعة، مع فلترة بالمادة أو الصف أو النوع أو
            الفصل الدراسي أو العام الدراسي، ثم افتح أي خطة في صفحة مستقلة بنفس
            قالب العرض الحالي.
          </p>
        </div>
      </header>

      {error ? (
        <p className="ui-inline-notice ui-inline-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="pm__filters" aria-label="فلاتر الخطط">
        <div className="pm__field">
          <label htmlFor="pm-plan-type">فلترة بالنوع</label>
          <select
            id="pm-plan-type"
            value={planType}
            onChange={(event) =>
              setPlanType(event.target.value as PlanTypeFilter)
            }
            disabled={loading}
          >
            <option value="">الكل</option>
            <option value="traditional">تقليدية</option>
            <option value="active_learning">تعلم نشط</option>
          </select>
        </div>

        <div className="pm__field">
          <label htmlFor="pm-subject">فلترة بالمادة</label>
          <select
            id="pm-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={loading}
          >
            <option value="">الكل</option>
            {subjectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="pm__field">
          <label htmlFor="pm-grade">فلترة بالصف</label>
          <select
            id="pm-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            disabled={loading}
          >
            <option value="">الكل</option>
            {gradeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="pm__field">
          <label htmlFor="pm-semester">فلترة بالفصل الدراسي</label>
          <select
            id="pm-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            disabled={loading}
          >
            <option value="">الكل</option>
            {semesterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="pm__field">
          <label htmlFor="pm-academic-year">فلترة بالعام الدراسي</label>
          <select
            id="pm-academic-year"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            disabled={loading}
          >
            <option value="">الكل</option>
            {academicYearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="pm__filter-actions">
          <button
            type="button"
            className="pm__btn pm__btn--ghost"
            onClick={clearFilters}
            disabled={
              loading ||
              (!planType && !subject && !grade && !semester && !academicYear)
            }
          >
            مسح الكل
          </button>
          <button
            type="button"
            className="pm__btn pm__btn--subtle"
            onClick={() => void loadPlans()}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <span className="ui-button-spinner" aria-hidden />}
            {!loading && <MdRefresh aria-hidden />}
            {loading ? 'جارٍ التحديث...' : 'تحديث'}
          </button>
        </div>
      </section>

      <section className="pm__list-shell" aria-busy={loading}>
        <header className="pm__list-head">
          <div>
            <h2>الخطط المحفوظة</h2>
            <p>اضغط على عرض لفتح الخطة في صفحة مستقلة.</p>
          </div>
          <span className="pm__count">{plans.length} خطة</span>
        </header>

        {loading && plans.length === 0 ? (
          <p className="pm__state">جاري تحميل الخطط...</p>
        ) : plans.length === 0 ? (
          <p className="pm__state">لا توجد خطط مطابقة للفلاتر الحالية.</p>
        ) : (
          <div className="pm__cards" role="list">
            {plans.map((plan) => {
              const metaParts = buildPlanMeta(plan);
              const teacherLabel = isAdmin
                ? teacherNameMap.get(plan.teacher_id) || `#${plan.teacher_id}`
                : null;

              return (
                <article
                  key={plan.local_id}
                  className="pm__card animate-fadeIn"
                  role="listitem"
                >
                  <div className="pm__card-topline">
                    <div className="pm__card-heading">
                      <h3 className="pm__card-title">
                        <Link
                          className="pm__card-title-link"
                          to={`/plans/${plan.public_id}`}
                        >
                          {plan.lesson_title || 'خطة بدون عنوان'}
                        </Link>
                      </h3>

                      <div
                        className="pm__card-meta-line"
                        aria-label="تفاصيل الخطة"
                      >
                        {metaParts.map((part, index) => (
                          <Fragment key={`${plan.public_id}-${part}-${index}`}>
                            {index > 0 ? (
                              <span className="pm__meta-separator" aria-hidden>
                                |
                              </span>
                            ) : null}
                            <span className="pm__meta-item">{part}</span>
                          </Fragment>
                        ))}
                      </div>
                    </div>

                    <span className="pm__card-type">
                      {toPlanTypeLabel(plan.plan_type)}
                    </span>
                  </div>

                  <div className="pm__card-footer">
                    <div className="pm__card-status">
                      <SyncStatusBadge status={plan.sync_status} />
                      {teacherLabel ? (
                        <span className="pm__card-teacher">
                          المعلم: {teacherLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="pm__card-actions">
                      <Link
                        className="pm__card-action-link"
                        to={`/plans/${plan.public_id}`}
                      >
                        عرض
                      </Link>
                      <button
                        type="button"
                        className="pm__card-action-button pm__card-action-button--danger"
                        onClick={() => openDeleteDialog(plan)}
                      >
                        حذف
                      </button>
                      <button
                        type="button"
                        className="pm__card-action-button"
                        onClick={() => openExportDialog(plan)}
                        disabled={
                          !plan.public_id || isLocalOnlyId(plan.public_id)
                        }
                      >
                        تصدير
                      </button>
                    </div>
                  </div>

                  {plan.last_sync_error ? (
                    <p className="pm__card-error">{plan.last_sync_error}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ExportFormatModal
        isOpen={exportFormatOpen}
        title="تصدير الخطة"
        onClose={() => {
          setExportFormatOpen(false);
          setExportTargetPlan(null);
        }}
        isSubmitting={isExportingPlan}
        onConfirm={({ format }) => void handleExportSelectedPlan(format)}
      />

      <ConfirmActionModal
        isOpen={deleteConfirmOpen}
        title="تأكيد حذف الخطة"
        message="سيتم حذف الخطة نهائيًا من المكتبة. لا يمكن التراجع بعد الحذف."
        endpoint={
          deleteTargetPlan?.public_id
            ? `/api/plans/${deleteTargetPlan.public_id}`
            : '/api/plans'
        }
        payload={
          deleteTargetPlan?.public_id
            ? { planId: deleteTargetPlan.public_id }
            : undefined
        }
        isLoading={isDeletingPlan}
        confirmLabel="حذف الخطة"
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetPlan(null);
        }}
        onConfirm={async () => {
          await handleDeleteSelectedPlan();
        }}
      />
    </div>
  );
}
