import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

import type {
  Class,
  Lesson,
  Subject,
  TeacherManagementRow,
  Unit,
} from '../../types';
import TeacherCirriculumManager from '../teacher-curriculum-manager/TeacherCirriculumManager';
import {
  getScopedClasses,
  getScopedLessons,
  getScopedSubjects,
  getScopedUnits,
  listTeacherScopes,
} from '../control-dashboard/control-dashboard.services';
import {
  formatClassBaseSelectLabel,
  formatClassShortLabel,
  getClassBaseKey,
  getClassSectionLabel,
} from '../../utils/classDisplay';
import { formatUnitDisplayLabel } from '../../utils/unitDisplay';
import './control-curriculum.css';

type SelectValue = number | '';

export interface AdminCurriculumScope {
  role: 'admin';
  selectedTeacherId: number;
}

export default function ControlCurriculum() {
  const { user, isLoading } = useAuth();
  const [manageTeacherId, setManageTeacherId] = useState<SelectValue>('');

  // Wait for auth so we don't render admin explorer for a teacher (which would 403).
  if (isLoading || user == null) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  if (user.userRole === 'teacher') {
    return <TeacherCirriculumManager />;
  }

  if (user.userRole === 'admin' && manageTeacherId !== '') {
    return (
      <AdminCurriculumManagerView
        selectedTeacherId={manageTeacherId}
        onBack={() => setManageTeacherId('')}
      />
    );
  }

  return (
    <AdminCurriculumExplorer onSelectTeacherToManage={setManageTeacherId} />
  );
}

function AdminCurriculumManagerView({
  selectedTeacherId,
  onBack,
}: {
  selectedTeacherId: number;
  onBack: () => void;
}) {
  return (
    <div className="cc cc--admin-manage">
      <header className="cc__admin-manage-header">
        <button
          type="button"
          className="cc__back-link"
          onClick={onBack}
          aria-label="العودة إلى استعراض المنهج"
        >
          ← العودة إلى الاستعراض
        </button>
      </header>
      <TeacherCirriculumManager scope={{ role: 'admin', selectedTeacherId }} />
    </div>
  );
}

function AdminCurriculumExplorer({
  onSelectTeacherToManage,
}: {
  onSelectTeacherToManage: (teacherId: number | '') => void;
}) {
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [teacherFilter, setTeacherFilter] = useState<SelectValue>('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SelectValue>('');
  const [subjectFilter, setSubjectFilter] = useState<SelectValue>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    Promise.all([
      listTeacherScopes(),
      getScopedClasses('admin'),
      getScopedSubjects('admin'),
      getScopedUnits('admin'),
      getScopedLessons('admin'),
    ])
      .then(
        ([
          teachersResponse,
          classesResponse,
          subjectsResponse,
          unitsResponse,
          lessonsResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setTeachers(teachersResponse.teachers ?? []);
          setClasses(classesResponse.classes ?? []);
          setSubjects(subjectsResponse.subjects ?? []);
          setUnits(unitsResponse.units ?? []);
          setLessons(lessonsResponse.lessons ?? []);
        }
      )
      .catch(() => {
        if (!cancelled) {
          setError('تعذر تحميل بيانات المنهج على مستوى النظام.');
          toast.error('تعذر تحميل بيانات المنهج على مستوى النظام.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const classesMap = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const teacherNameMap = useMemo(() => {
    return new Map(
      teachers.map((teacher) => [
        teacher.id,
        teacher.display_name || teacher.username,
      ])
    );
  }, [teachers]);

  const visibleClasses = useMemo(() => {
    return classes.filter((classItem) => {
      if (teacherFilter !== '' && classItem.teacher_id !== teacherFilter) {
        return false;
      }
      return true;
    });
  }, [classes, teacherFilter]);

  const classGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { baseClass: Class; sections: Class[] }
    >();

    visibleClasses.forEach((classItem) => {
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
  }, [visibleClasses]);

  const sectionOptions = useMemo(() => {
    if (classFilter === '') {
      return [];
    }

    return visibleClasses
      .filter((classItem) => getClassBaseKey(classItem) === classFilter)
      .sort((left, right) =>
        getClassSectionLabel(left).localeCompare(
          getClassSectionLabel(right),
          'ar'
        )
      );
  }, [visibleClasses, classFilter]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subjectItem) => {
      if (teacherFilter !== '' && subjectItem.teacher_id !== teacherFilter) {
        return false;
      }
      const subjectClass = classesMap.get(subjectItem.class_id) ?? null;
      if (!subjectClass) {
        return false;
      }
      if (classFilter !== '' && getClassBaseKey(subjectClass) !== classFilter) {
        return false;
      }
      if (sectionFilter !== '' && subjectClass.id !== sectionFilter) {
        return false;
      }
      return true;
    });
  }, [subjects, teacherFilter, classFilter, sectionFilter, classesMap]);

  const filteredUnits = useMemo(() => {
    return units.filter((unitItem) => {
      if (teacherFilter !== '' && unitItem.teacher_id !== teacherFilter) {
        return false;
      }
      if (subjectFilter !== '' && unitItem.subject_id !== subjectFilter) {
        return false;
      }
      const unitSubject = subjects.find(
        (subjectItem) => subjectItem.id === unitItem.subject_id
      );
      if (!unitSubject) {
        return false;
      }

      const unitClass = classesMap.get(unitSubject.class_id) ?? null;
      if (!unitClass) {
        return false;
      }
      if (classFilter !== '' && getClassBaseKey(unitClass) !== classFilter) {
        return false;
      }
      if (sectionFilter !== '' && unitClass.id !== sectionFilter) {
        return false;
      }
      return true;
    });
  }, [
    units,
    teacherFilter,
    subjectFilter,
    classFilter,
    sectionFilter,
    subjects,
    classesMap,
  ]);

  const filteredLessons = useMemo(() => {
    const allowedUnitIds = new Set(
      filteredUnits.map((unitItem) => unitItem.id)
    );

    return lessons.filter((lessonItem) => {
      if (!allowedUnitIds.has(lessonItem.unit_id)) {
        return false;
      }
      if (teacherFilter !== '' && lessonItem.teacher_id !== teacherFilter) {
        return false;
      }
      return true;
    });
  }, [lessons, filteredUnits, teacherFilter]);

  const filteredClassRows = useMemo(() => {
    return visibleClasses.filter((classItem) => {
      if (classFilter !== '' && getClassBaseKey(classItem) !== classFilter) {
        return false;
      }
      if (sectionFilter !== '' && classItem.id !== sectionFilter) {
        return false;
      }
      return true;
    });
  }, [visibleClasses, classFilter, sectionFilter]);

  if (loading) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="cc ui-loaded">
      <header className="cc__header page-header">
        <h1>المنهج الدراسي (نطاق النظام)</h1>
        <p>استعراض هرم الصفوف والمواد والوحدات والدروس لجميع المعلمين.</p>
      </header>

      <section className="cc__manage-section">
        <h2 className="cc__manage-title">إدارة منهج معلم</h2>
        <p className="cc__manage-desc">
          اختر معلمًا من القائمة لإضافة أو تعديل منهجه (صفوف، مواد، وحدات،
          دروس).
        </p>
        <label className="cc__field" htmlFor="cc-manage-teacher">
          <span>المعلم</span>
          <select
            id="cc-manage-teacher"
            value=""
            onChange={(event) => {
              const value = event.target.value;
              onSelectTeacherToManage(value ? Number(value) : '');
            }}
          >
            <option value="">— اختر معلمًا لإدارة منهجه —</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.display_name || teacher.username}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="cc__filters">
        <label className="cc__field" htmlFor="cc-teacher-filter">
          <span>المعلم</span>
          <select
            id="cc-teacher-filter"
            value={teacherFilter}
            onChange={(event) => {
              const nextValue = event.target.value;
              setTeacherFilter(nextValue ? Number(nextValue) : '');
              setClassFilter('');
              setSectionFilter('');
              setSubjectFilter('');
            }}
          >
            <option value="">الكل</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.display_name || teacher.username}
              </option>
            ))}
          </select>
        </label>

        <label className="cc__field" htmlFor="cc-class-filter">
          <span>الصف</span>
          <select
            id="cc-class-filter"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setSectionFilter('');
              setSubjectFilter('');
            }}
          >
            <option value="">الكل</option>
            {classGroups.map((group) => (
              <option key={group.key} value={group.key}>
                {formatClassBaseSelectLabel(group.baseClass)}
              </option>
            ))}
          </select>
        </label>

        <label className="cc__field" htmlFor="cc-section-filter">
          <span>الشعبة</span>
          <select
            id="cc-section-filter"
            value={sectionFilter}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSectionFilter(nextValue ? Number(nextValue) : '');
              setSubjectFilter('');
            }}
            disabled={classFilter === ''}
          >
            <option value="">الكل</option>
            {sectionOptions.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {getClassSectionLabel(classItem)}
              </option>
            ))}
          </select>
        </label>

        <label className="cc__field" htmlFor="cc-subject-filter">
          <span>المادة</span>
          <select
            id="cc-subject-filter"
            value={subjectFilter}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSubjectFilter(nextValue ? Number(nextValue) : '');
            }}
          >
            <option value="">الكل</option>
            {filteredSubjects.map((subjectItem) => (
              <option key={subjectItem.id} value={subjectItem.id}>
                {subjectItem.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!error ? (
        <section className="cc__summary-grid">
          <article>
            <span>عدد الصفوف</span>
            <strong>{filteredClassRows.length}</strong>
          </article>
          <article>
            <span>عدد المواد</span>
            <strong>{filteredSubjects.length}</strong>
          </article>
          <article>
            <span>عدد الوحدات</span>
            <strong>{filteredUnits.length}</strong>
          </article>
          <article>
            <span>عدد الدروس</span>
            <strong>{filteredLessons.length}</strong>
          </article>
        </section>
      ) : null}

      {!error ? (
        <section className="cc__table-card">
          <h2>قائمة الدروس</h2>
          {filteredLessons.length === 0 ? (
            <p className="cc__state">لا توجد دروس ضمن الفلاتر الحالية.</p>
          ) : (
            <div className="cc__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الدرس</th>
                    <th>الوحدة</th>
                    <th>المادة</th>
                    <th>الصف</th>
                    <th>المعلم</th>
                    <th>عدد الحصص</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map((lessonItem) => {
                    const unit = filteredUnits.find(
                      (item) => item.id === lessonItem.unit_id
                    );
                    const subject = unit
                      ? subjects.find((item) => item.id === unit.subject_id)
                      : null;
                    const classItem = subject
                      ? (classesMap.get(subject.class_id) ?? null)
                      : null;

                    return (
                      <tr key={lessonItem.id}>
                        <td>{lessonItem.name}</td>
                        <td>{unit ? formatUnitDisplayLabel(unit.name) : '—'}</td>
                        <td>{subject?.name ?? '—'}</td>
                        <td>
                          {classItem
                            ? formatClassShortLabel(classItem)
                            : '—'}
                        </td>
                        <td>
                          {teacherNameMap.get(lessonItem.teacher_id) ||
                            `#${lessonItem.teacher_id}`}
                        </td>
                        <td>{lessonItem.number_of_periods}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
