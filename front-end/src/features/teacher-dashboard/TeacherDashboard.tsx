import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MdMenuBook, MdAssignment, MdQuiz } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import {
  getMyLessons,
  getMyClasses,
  getMySubjects,
  getMyUnits,
} from './teacher-dashboard.services';
import type { Class, Lesson, Subject, Unit } from '../../types';
import './teacher-dashboard.css';

const RECENT_LESSONS_LIMIT = 10;

function formatDateAr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type EnrichedLesson = Lesson & {
  subjectName: string;
  className: string;
};

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/authentication');
      return;
    }
    if (user.userRole === 'admin') {
      navigate('/admin');
      return;
    }
    if (user.userRole !== 'teacher') {
      navigate('/error');
      return;
    }

    let cancelled = false;

    Promise.all([getMyLessons(), getMyUnits(), getMySubjects(), getMyClasses()])
      .then(([lessonsRes, unitsRes, subjectsRes, classesRes]) => {
        if (cancelled) return;
        setLessons(lessonsRes.lessons ?? []);
        setUnits(unitsRes.units ?? []);
        setSubjects(subjectsRes.subjects ?? []);
        setClasses(classesRes.classes ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error ?? 'حدث خطأ أثناء تحميل البيانات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, user]);

  const enrichedLessons = useMemo((): EnrichedLesson[] => {
    const unitsById = new Map(units.map((u) => [u.id, u]));
    const subjectsById = new Map(subjects.map((s) => [s.id, s]));
    const classesById = new Map(classes.map((c) => [c.id, c]));
    return lessons
      .map((lesson) => {
        const unit = unitsById.get(lesson.unit_id);
        const subject = unit ? subjectsById.get(unit.subject_id) : undefined;
        const cls = subject ? classesById.get(subject.class_id) : undefined;
        return {
          ...lesson,
          subjectName: subject?.name ?? '—',
          className: cls?.name ?? '—',
        };
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, RECENT_LESSONS_LIMIT);
  }, [lessons, units, subjects, classes]);

  if (user?.userRole !== 'teacher') {
    return null;
  }

  const displayName = user?.username ?? 'المعلم';

  return (
    <div className="td">
      <header className="td__header page-header">
        <h1 className="td__title">مرحباً، {displayName} 👋</h1>
        <p className="td__subtitle">ماذا تريد أن تفعل اليوم؟</p>
      </header>

      <section className="td__quick" aria-labelledby="quick-access-heading">
        <h2 id="quick-access-heading" className="td__section-title">
          إجراءات سريعة
        </h2>
        <div className="td__quick-grid">
          <button
            type="button"
            className="td__quick-card"
            onClick={() => navigate('/lessons')}
          >
            <div className="td__quick-card-icon">
              <MdMenuBook aria-hidden />
            </div>
            <div>
              <h3 className="td__quick-card-title">إنشاء خطة درس</h3>
              <p className="td__quick-card-desc">
                أنشئ خطة درس جديدة بمساعدة الذكاء الاصطناعي
              </p>
            </div>
          </button>
          <button
            type="button"
            className="td__quick-card"
            onClick={() => navigate('/assignments')}
          >
            <div className="td__quick-card-icon">
              <MdAssignment aria-hidden />
            </div>
            <div>
              <h3 className="td__quick-card-title">إنشاء واجب</h3>
              <p className="td__quick-card-desc">
                أنشئ واجباً منزلياً مرتبطاً بدرس محدد
              </p>
            </div>
          </button>
          <button
            type="button"
            className="td__quick-card"
            onClick={() => navigate('/quizzes')}
          >
            <div className="td__quick-card-icon">
              <MdQuiz aria-hidden />
            </div>
            <div>
              <h3 className="td__quick-card-title">إنشاء اختبار</h3>
              <p className="td__quick-card-desc">
                أنشئ اختباراً من دروس متعددة بأسئلة متنوعة
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="td__section" aria-labelledby="recent-lessons-heading">
        <div className="td__section-head">
          <h2 id="recent-lessons-heading" className="td__section-title">
            آخر خطط الدروس
          </h2>
          <button
            type="button"
            className="td__section-link"
            onClick={() => navigate('/lessons')}
          >
            عرض الكل
          </button>
        </div>
        <div className="td__table-wrap">
          {loading ? (
            <div className="td__loading">جاري التحميل...</div>
          ) : error ? (
            <div className="td__error">{error}</div>
          ) : enrichedLessons.length === 0 ? (
            <div className="td__empty">لا توجد خطط دروس بعد.</div>
          ) : (
            <div className="td__table-scroll">
              <table className="td__table">
                <thead>
                  <tr>
                    <th>الدرس</th>
                    <th>المادة</th>
                    <th>الصف</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedLessons.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td className="td__table-cell--muted">
                        {row.subjectName}
                      </td>
                      <td className="td__table-cell--muted">{row.className}</td>
                      <td className="td__table-cell--muted">
                        {formatDateAr(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="td__section" aria-labelledby="recent-tests-heading">
        <div className="td__section-head">
          <h2 id="recent-tests-heading" className="td__section-title">
            آخر الاختبارات
          </h2>
          <button
            type="button"
            className="td__section-link"
            onClick={() => navigate('/quizzes')}
          >
            عرض الكل
          </button>
        </div>
        <div className="td__table-wrap">
          <div className="td__tests-placeholder">
            لا توجد اختبارات بعد. ستظهر هنا عند إنشاء اختبارات.
          </div>
        </div>
      </section>
    </div>
  );
}

export default TeacherDashboard;
