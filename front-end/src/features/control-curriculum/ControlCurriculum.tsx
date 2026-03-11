import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Class, Lesson, Subject, TeacherManagementRow, Unit } from '../../types';
import TeacherCirriculumManager from '../teacher-curriculum-manager/TeacherCirriculumManager';
import {
  getScopedClasses,
  getScopedLessons,
  getScopedSubjects,
  getScopedUnits,
  listTeacherScopes,
} from '../control-dashboard/control-dashboard.services';
import './control-curriculum.css';

type SelectValue = number | '';

export default function ControlCurriculum() {
  const { user } = useAuth();

  if (user?.userRole === 'teacher') {
    return <TeacherCirriculumManager />;
  }

  return <AdminCurriculumExplorer />;
}

function AdminCurriculumExplorer() {
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [teacherFilter, setTeacherFilter] = useState<SelectValue>('');
  const [classFilter, setClassFilter] = useState<SelectValue>('');
  const [subjectFilter, setSubjectFilter] = useState<SelectValue>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listTeacherScopes(),
      getScopedClasses('admin'),
      getScopedSubjects('admin'),
      getScopedUnits('admin'),
      getScopedLessons('admin'),
    ])
      .then(([teachersResponse, classesResponse, subjectsResponse, unitsResponse, lessonsResponse]) => {
        if (cancelled) {
          return;
        }

        setTeachers(teachersResponse.teachers ?? []);
        setClasses(classesResponse.classes ?? []);
        setSubjects(subjectsResponse.subjects ?? []);
        setUnits(unitsResponse.units ?? []);
        setLessons(lessonsResponse.lessons ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError('تعذر تحميل بيانات المنهج على مستوى النظام.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const classesMap = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const teacherNameMap = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher.username]));
  }, [teachers]);

  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      if (teacherFilter !== '' && classItem.teacher_id !== teacherFilter) {
        return false;
      }
      return true;
    });
  }, [classes, teacherFilter]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subjectItem) => {
      if (teacherFilter !== '' && subjectItem.teacher_id !== teacherFilter) {
        return false;
      }
      if (classFilter !== '' && subjectItem.class_id !== classFilter) {
        return false;
      }
      return true;
    });
  }, [subjects, teacherFilter, classFilter]);

  const filteredUnits = useMemo(() => {
    return units.filter((unitItem) => {
      if (teacherFilter !== '' && unitItem.teacher_id !== teacherFilter) {
        return false;
      }
      if (subjectFilter !== '' && unitItem.subject_id !== subjectFilter) {
        return false;
      }
      if (classFilter === '') {
        return true;
      }

      const unitSubject = subjects.find((subjectItem) => subjectItem.id === unitItem.subject_id);
      return unitSubject?.class_id === classFilter;
    });
  }, [units, teacherFilter, subjectFilter, classFilter, subjects]);

  const filteredLessons = useMemo(() => {
    const allowedUnitIds = new Set(filteredUnits.map((unitItem) => unitItem.id));

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

  return (
    <div className="cc">
      <header className="cc__header page-header">
        <h1>المنهج الدراسي (نطاق النظام)</h1>
        <p>استعراض هرم الصفوف والمواد والوحدات والدروس لجميع المعلمين.</p>
      </header>

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
              setSubjectFilter('');
            }}
          >
            <option value="">الكل</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.username}
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
              const nextValue = event.target.value;
              setClassFilter(nextValue ? Number(nextValue) : '');
              setSubjectFilter('');
            }}
          >
            <option value="">الكل</option>
            {filteredClasses.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
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

      {loading ? <p className="cc__state">جاري تحميل البيانات...</p> : null}
      {error ? <p className="cc__state cc__state--error">{error}</p> : null}

      {!loading && !error ? (
        <section className="cc__summary-grid">
          <article>
            <span>عدد الصفوف</span>
            <strong>{filteredClasses.length}</strong>
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

      {!loading && !error ? (
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
                    const unit = filteredUnits.find((item) => item.id === lessonItem.unit_id);
                    const subject = unit
                      ? subjects.find((item) => item.id === unit.subject_id)
                      : null;
                    const classItem = subject
                      ? classesMap.get(subject.class_id) ?? null
                      : null;

                    return (
                      <tr key={lessonItem.id}>
                        <td>{lessonItem.name}</td>
                        <td>{unit?.name ?? '—'}</td>
                        <td>{subject?.name ?? '—'}</td>
                        <td>{classItem?.grade_label ?? classItem?.name ?? '—'}</td>
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
