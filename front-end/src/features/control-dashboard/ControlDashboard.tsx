import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  MdAssignment,
  MdInsights,
  MdMenuBook,
  MdPeople,
  MdQuiz,
  MdSchool,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { Class, Exam, LessonPlanRecord, Subject } from '../../types';
import {
  getScopedClasses,
  getScopedSubjects,
  getScopedLessons,
  listScopedAssignments,
  listScopedExams,
  listScopedPlans,
} from './control-dashboard.services';
import './control-dashboard.css';

interface DashboardStats {
  classes: number;
  subjects: number;
  lessons: number;
  plans: number;
  exams: number;
  assignments: number;
}

function formatDateAr(value: string): string {
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function buildStats(args: {
  classes: Class[];
  subjects: Subject[];
  lessons: { id: number }[];
  plans: LessonPlanRecord[];
  exams: Exam[];
  assignments: { id: string }[];
}): DashboardStats {
  return {
    classes: args.classes.length,
    subjects: args.subjects.length,
    lessons: args.lessons.length,
    plans: args.plans.length,
    exams: args.exams.length,
    assignments: args.assignments.length,
  };
}

export default function ControlDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<LessonPlanRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    classes: 0,
    subjects: 0,
    lessons: 0,
    plans: 0,
    exams: 0,
    assignments: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.userRole === 'admin';

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getScopedClasses(user.userRole),
      getScopedSubjects(user.userRole),
      getScopedLessons(user.userRole),
      listScopedPlans(),
      listScopedExams(),
      listScopedAssignments(),
    ])
      .then(
        ([classesResponse, subjectsResponse, lessonsResponse, plansResponse, examsResponse, assignmentsResponse]) => {
          if (cancelled) {
            return;
          }

          const nextClasses = classesResponse.classes ?? [];
          const nextSubjects = subjectsResponse.subjects ?? [];
          const nextLessons = lessonsResponse.lessons ?? [];
          const nextPlans = plansResponse.plans ?? [];
          const nextExams = examsResponse.exams ?? [];
          const nextAssignments = assignmentsResponse.assignments ?? [];

          setClasses(nextClasses);
          setSubjects(nextSubjects);
          setPlans(nextPlans);
          setExams(nextExams);
          setStats(
            buildStats({
              classes: nextClasses,
              subjects: nextSubjects,
              lessons: nextLessons,
              plans: nextPlans,
              exams: nextExams,
              assignments: nextAssignments,
            })
          );
        }
      )
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('تعذر تحميل بيانات لوحة التحكم.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.userRole]);

  const recentPlans = useMemo(() => {
    return [...plans]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 6);
  }, [plans]);

  const recentExams = useMemo(() => {
    return [...exams]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 6);
  }, [exams]);

  const subjectsMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  const classesMap = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  if (!user) {
    return null;
  }

  return (
    <div className="cd" dir="rtl">
      <header className="cd__header">
        <h1>
          {isAdmin ? 'لوحة تحكم النظام' : `مرحباً، ${user.username}`} 
        </h1>
        <p>
          {isAdmin
            ? 'نظرة شاملة على بيانات النظام مع صلاحيات إشراف كاملة.'
            : 'نظرة سريعة على أنشطتك التعليمية وخيارات الوصول السريع.'}
        </p>
      </header>

      <section className="cd__stats-grid" aria-label="إحصائيات رئيسية">
        <article className="cd__stat-card">
          <span>الصفوف</span>
          <strong>{stats.classes}</strong>
        </article>
        <article className="cd__stat-card">
          <span>المواد</span>
          <strong>{stats.subjects}</strong>
        </article>
        <article className="cd__stat-card">
          <span>الدروس</span>
          <strong>{stats.lessons}</strong>
        </article>
        <article className="cd__stat-card">
          <span>الخطط المولدة</span>
          <strong>{stats.plans}</strong>
        </article>
        <article className="cd__stat-card">
          <span>الاختبارات المولدة</span>
          <strong>{stats.exams}</strong>
        </article>
        <article className="cd__stat-card">
          <span>الواجبات المولدة</span>
          <strong>{stats.assignments}</strong>
        </article>
      </section>

      <section className="cd__quick-actions" aria-label="إجراءات سريعة">
        {isAdmin ? (
          <>
            <button type="button" onClick={() => navigate('/teachers')}>
              <MdPeople aria-hidden />
              إدارة المعلمين
            </button>
            <button type="button" onClick={() => navigate('/stats')}>
              <MdInsights aria-hidden />
              التقارير والإحصائيات
            </button>
            <button type="button" onClick={() => navigate('/plans')}>
              <MdMenuBook aria-hidden />
              إدارة الخطط المولدة
            </button>
            <button type="button" onClick={() => navigate('/curriculum')}>
              <MdSchool aria-hidden />
              استعراض المنهج
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => navigate('/lessons')}>
              <MdMenuBook aria-hidden />
              إنشاء خطة درس
            </button>
            <button type="button" onClick={() => navigate('/assignments')}>
              <MdAssignment aria-hidden />
              إدارة الواجبات
            </button>
            <button type="button" onClick={() => navigate('/quizzes')}>
              <MdQuiz aria-hidden />
              إنشاء/إدارة الاختبارات
            </button>
            <button type="button" onClick={() => navigate('/curriculum')}>
              <MdSchool aria-hidden />
              إدارة المنهج
            </button>
          </>
        )}
      </section>

      {loading ? <div className="cd__state">جاري التحميل...</div> : null}
      {error ? <div className="cd__state cd__state--error">{error}</div> : null}

      {!loading && !error ? (
        <section className="cd__tables">
          <article className="cd__table-card">
            <header>
              <h2>أحدث الخطط</h2>
              <button type="button" onClick={() => navigate('/plans')}>
                عرض الكل
              </button>
            </header>
            {recentPlans.length === 0 ? (
              <p className="cd__empty">لا توجد خطط بعد.</p>
            ) : (
              <div className="cd__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>المعرف</th>
                      <th>عنوان الدرس</th>
                      <th>المادة</th>
                      <th>النوع</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPlans.map((plan) => (
                      <tr key={plan.public_id}>
                        <td>{plan.public_id}</td>
                        <td>{plan.lesson_title}</td>
                        <td>{plan.subject}</td>
                        <td>
                          {plan.plan_type === 'traditional'
                            ? 'تقليدية'
                            : 'تعلم نشط'}
                        </td>
                        <td>{formatDateAr(plan.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="cd__table-card">
            <header>
              <h2>أحدث الاختبارات</h2>
              <button type="button" onClick={() => navigate('/quizzes')}>
                عرض الكل
              </button>
            </header>
            {recentExams.length === 0 ? (
              <p className="cd__empty">لا توجد اختبارات بعد.</p>
            ) : (
              <div className="cd__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>المادة</th>
                      <th>الصف</th>
                      <th>عدد الأسئلة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExams.map((exam) => {
                      const subject = subjectsMap.get(exam.subject_id);
                      const classItem = classesMap.get(exam.class_id);

                      return (
                        <tr key={exam.public_id}>
                          <td>{exam.title}</td>
                          <td>{subject?.name ?? exam.subject_id}</td>
                          <td>{classItem?.grade_label ?? classItem?.name ?? '—'}</td>
                          <td>{exam.total_questions}</td>
                          <td>{formatDateAr(exam.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      ) : null}
    </div>
  );
}
