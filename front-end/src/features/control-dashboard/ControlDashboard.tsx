import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import {
  MdAssignment,
  MdInsights,
  MdPeople,
  MdQuiz,
  MdSchool,
  MdMenuBook,
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

const TEACHER_QUICK_ACTIONS: Array<{
  path: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}> = [
  {
    path: '/lessons',
    icon: MdMenuBook,
    title: 'إنشاء خطة درس',
    description: 'أنشئ خطة درس جديدة بمساعدة الذكاء الاصطناعي',
  },
  {
    path: '/assignments',
    icon: MdAssignment,
    title: 'إدارة الواجبات',
    description: 'أنشئ واجباً منزلياً مرتبطاً بدرس محدد',
  },
  {
    path: '/quizzes',
    icon: MdQuiz,
    title: 'إنشاء/إدارة الاختبارات',
    description: 'أنشئ اختباراً من دروس متعددة بأسئلة متنوعة',
  },
  {
    path: '/curriculum',
    icon: MdSchool,
    title: 'إدارة المنهج',
    description: 'استعرض وحرّر وحداتك ودروسك',
  },
];

const ADMIN_QUICK_ACTIONS: Array<{
  path: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}> = [
  {
    path: '/teachers',
    icon: MdPeople,
    title: 'إدارة المعلمين',
    description: 'إضافة ومعاينة وإدارة حسابات المعلمين',
  },
  {
    path: '/stats',
    icon: MdInsights,
    title: 'التقارير والإحصائيات',
    description: 'نظرة شاملة على أداء النظام وجودة المخرجات',
  },
  {
    path: '/plans',
    icon: MdMenuBook,
    title: 'إدارة الخطط المولدة',
    description: 'استعراض وتصدير كل الخطط في النظام',
  },
  {
    path: '/curriculum',
    icon: MdSchool,
    title: 'استعراض المنهج',
    description: 'استعراض المنهج الدراسي والصفوف والمواد',
  },
];

export default function ControlDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<LessonPlanRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.userRole === 'admin';

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    let cancelled = false;

    Promise.all([
      getScopedClasses(user.userRole),
      getScopedSubjects(user.userRole),
      getScopedLessons(user.userRole),
      listScopedPlans(),
      listScopedExams(),
      listScopedAssignments(),
    ])
      .then(
        ([classesResponse, subjectsResponse, , plansResponse, examsResponse]) => {
          if (cancelled) {
            return;
          }

          const nextClasses = classesResponse.classes ?? [];
          const nextSubjects = subjectsResponse.subjects ?? [];
          const nextPlans = plansResponse.plans ?? [];
          const nextExams = examsResponse.exams ?? [];

          setClasses(nextClasses);
          setSubjects(nextSubjects);
          setPlans(nextPlans);
          setExams(nextExams);
        }
      )
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('تعذر تحميل بيانات لوحة التحكم.');
        toast.error('تعذر تحميل بيانات لوحة التحكم.');
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

  const quickActions = isAdmin ? ADMIN_QUICK_ACTIONS : TEACHER_QUICK_ACTIONS;

  if (!user) {
    return null;
  }

  return (
    <div className={`cd ui-loaded ${loading ? 'cd--loading' : ''}`}>
      {/* Hero / Welcome */}
      <header className="cd__hero" aria-label="ترحيب">
        <div className="cd__hero-inner">
          <h1>
            {loading ? (
              <span aria-hidden />
            ) : isAdmin ? (
              'لوحة تحكم النظام'
            ) : (
              `مرحباً، ${user.display_name || user.username}`
            )}
          </h1>
          <p>
            {loading ? (
              <span aria-hidden />
            ) : isAdmin ? (
              'نظرة شاملة على بيانات النظام مع صلاحيات إشراف كاملة.'
            ) : (
              'نظرة سريعة على أنشطتك التعليمية وخيارات الوصول السريع.'
            )}
          </p>
        </div>
      </header>

      {/* Quick actions */}
      <section className="cd__quick-actions" aria-label="إجراءات سريعة">
        <h2 className="cd__section-title">إجراءات سريعة</h2>
        <div className="cd__quick-grid">
          {quickActions.map(({ path, icon: Icon, title, description }) => (
            <button
              key={path}
              type="button"
              className="cd__quick-card"
              onClick={() => navigate(path)}
            >
              <div className="cd__quick-card-icon">
                <Icon aria-hidden />
              </div>
              <div className="cd__quick-card-content">
                <h3 className="cd__quick-card-title">{title}</h3>
                <p className="cd__quick-card-desc">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      {!error && (
        <section className="cd__tables" aria-label="النشاط الأخير">
          <article className={loading ? 'cd__table-card cd__table-card--skeleton' : 'cd__table-card'}>
            <header>
              <h2>أحدث الخطط</h2>
              {!loading && (
                <button
                  type="button"
                  className="cd__table-link"
                  onClick={() => navigate('/plans')}
                >
                  عرض الكل
                </button>
              )}
            </header>
            {loading ? (
              <>
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
              </>
            ) : recentPlans.length === 0 ? (
              <div className="cd__empty">
                <div className="cd__empty-icon">
                  <MdMenuBook aria-hidden />
                </div>
                <p className="cd__empty-title">لا توجد خطط بعد</p>
                <p className="cd__empty-text">ستظهر هنا أحدث الخطط المولدة عند إنشائها.</p>
              </div>
            ) : (
              <div className="cd__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>عنوان الدرس</th>
                      <th>المادة</th>
                      <th>النوع</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPlans.map((plan) => (
                      <tr key={plan.public_id}>
                        <td>{plan.lesson_title}</td>
                        <td>{plan.subject}</td>
                        <td>
                          <span className="cd__badge">
                            {plan.plan_type === 'traditional' ? 'تقليدية' : 'تعلم نشط'}
                          </span>
                        </td>
                        <td>{formatDateAr(plan.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className={loading ? 'cd__table-card cd__table-card--skeleton' : 'cd__table-card'}>
            <header>
              <h2>أحدث الاختبارات</h2>
              {!loading && (
                <button
                  type="button"
                  className="cd__table-link"
                  onClick={() => navigate('/quizzes')}
                >
                  عرض الكل
                </button>
              )}
            </header>
            {loading ? (
              <>
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
                <div className="cd__table-skeleton-row" />
              </>
            ) : recentExams.length === 0 ? (
              <div className="cd__empty">
                <div className="cd__empty-icon">
                  <MdQuiz aria-hidden />
                </div>
                <p className="cd__empty-title">لا توجد اختبارات بعد</p>
                <p className="cd__empty-text">ستظهر هنا أحدث الاختبارات عند إنشائها.</p>
              </div>
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
      )}
    </div>
  );
}
