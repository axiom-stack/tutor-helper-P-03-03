import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import {
  MdCollectionsBookmark,
  MdInsights,
  MdLibraryBooks,
  MdMenuBook,
  MdQuiz,
  MdRefresh,
  MdSchool,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { Class, Exam, LessonPlanRecord, Subject } from '../../types';
import {
  getScopedClasses,
  getScopedSubjects,
  listScopedExams,
  listScopedPlans,
} from './control-dashboard.services';
import './control-dashboard.css';
import '../auth/auth.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const HEALTH_URL = `${BACKEND_URL.replace(/\/$/, '')}/health`;
const HEALTH_TIMEOUT_MS = 5000;
const WAKE_UP_WAIT_MS = 40000;

type DashboardAction = {
  path: string;
  title: string;
  description: string;
  icon: typeof MdMenuBook;
};

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

export default function ControlDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<LessonPlanRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverWakingUp, setServerWakingUp] = useState(false);
  const [refreshReady, setRefreshReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = user?.display_name || user?.username || 'المعلم';
  const isAdmin = user?.userRole === 'admin';

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT_MS
    );

    fetch(HEALTH_URL, { signal: controller.signal })
      .then(() => clearTimeout(timeoutId))
      .catch(() => {
        clearTimeout(timeoutId);
        setServerWakingUp(true);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!serverWakingUp) {
      return;
    }

    const timer = window.setTimeout(
      () => setRefreshReady(true),
      WAKE_UP_WAIT_MS
    );
    return () => window.clearTimeout(timer);
  }, [serverWakingUp]);

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
      listScopedPlans(),
      listScopedExams(),
    ])
      .then(
        ([classesResponse, subjectsResponse, plansResponse, examsResponse]) => {
          if (cancelled) {
            return;
          }

          setClasses(classesResponse.classes ?? []);
          setSubjects(subjectsResponse.subjects ?? []);
          setPlans(plansResponse.plans ?? []);
          setExams(examsResponse.exams ?? []);
        }
      )
      .catch(() => {
        if (!cancelled) {
          const message = 'تعذر تحميل بيانات الصفحة الرئيسية.';
          setError(message);
          toast.error(message);
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
  }, [user?.userRole]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  const classMap = useMemo(() => {
    return new Map(classes.map((classItem) => [classItem.id, classItem]));
  }, [classes]);

  const recentPlans = useMemo(() => {
    return [...plans]
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime()
      )
      .slice(0, 3);
  }, [plans]);

  const recentExams = useMemo(() => {
    return [...exams]
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime()
      )
      .slice(0, 3);
  }, [exams]);

  const actions: DashboardAction[] = [
    {
      path: '/curriculum',
      title: 'إدارة المنهج',
      description:
        'بناء هيكل العام الدراسي والفصل والصف والشعبة والمواد والوحدات والدروس.',
      icon: MdSchool,
    },
    {
      path: '/curriculum?tab=library',
      title: 'مكتبة الدروس',
      description:
        'بحث وفلترة بجميع دروسك (الصف، المادة، الفصل الدراسي) مع المراجعة والتعديل والحذف.',
      icon: MdCollectionsBookmark,
    },
    {
      path: '/lessons',
      title: 'إنشاء خطة درس',
      description:
        'توليد خطة درس ذكية من محتوى الدرس مع التحرير والتحسين والتصدير.',
      icon: MdMenuBook,
    },
    {
      path: '/quizzes/create',
      title: 'إنشاء اختبار',
      description:
        'إعداد اختبار موحّد من الدروس المسجلة مع ضبط العدد والدرجة والمدة.',
      icon: MdQuiz,
    },
    {
      path: '/plans',
      title: 'مكتبة الخطط',
      description:
        'تصفح الخطط المولدة، افتحها، حررها، أو صدّرها بصيغة PDF أو DOCX.',
      icon: MdLibraryBooks,
    },
    {
      path: '/quizzes',
      title: 'مكتبة الاختبارات',
      description: 'استعرض الاختبارات المحفوظة مع فلترة بالمادة والصف.',
      icon: MdQuiz,
    },
    {
      path: '/stats',
      title: 'التقارير والأداء',
      description: 'مراجعة ملخصات الاستخدام والجودة والنشاط من مكتبتك الخاصة.',
      icon: MdInsights,
    },
  ];

  if (!user) {
    return null;
  }

  if (loading && plans.length === 0 && exams.length === 0) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="cd ui-loaded">
      {serverWakingUp ? (
        <div className="auth__wake-notice" role="status">
          <p className="auth__wake-notice-text">
            الخادم المجاني قيد التشغيل. يرجى تحديث الصفحة بعد 40 ثانية ثم البدء
            باستخدام التطبيق.
          </p>
          <p className="auth__wake-notice-en">
            The free server is waking up. Please refresh the page after 40
            seconds, then you can start using the app.
          </p>
          {refreshReady ? (
            <button
              type="button"
              className="auth__wake-refresh-btn"
              onClick={() => window.location.reload()}
            >
              <MdRefresh aria-hidden />
              تحديث الصفحة الآن / Refresh now
            </button>
          ) : null}
        </div>
      ) : null}

      {isAdmin ? (
        <header className="cd__hero">
          <div className="cd__hero-content">
            <div className="cd__hero-copy">
              <p className="cd__eyebrow">الصفحة الرئيسية</p>
              <h1>مرحباً، {displayName}</h1>
              <p>
                اختر المهمة التي تريدها بسرعة، أو راجع أحدث الخطط والاختبارات من
                أسفل الصفحة.
              </p>
            </div>

            <div className="cd__hero-badge">
              <span>وضع المدير</span>
              <strong>{error ? 'يوجد تنبيه' : 'جاهز للعمل'}</strong>
            </div>
          </div>
        </header>
      ) : null}

      <section className="cd__actions" aria-label="التنقل السريع">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              type="button"
              className="cd__action-card"
              onClick={() => navigate(action.path)}
            >
              <span className="cd__action-icon" aria-hidden>
                <Icon />
              </span>
              <span className="cd__action-copy">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="cd__previews" aria-label="المخرجات الأخيرة">
        <article className="cd__panel">
          <header className="cd__panel-head">
            <h2>أخر الخطط</h2>
            <button type="button" onClick={() => navigate('/plans')}>
              عرض الكل
            </button>
          </header>

          <div className="cd__preview-list">
            {recentPlans.length === 0 ? (
              <p className="cd__empty">لا توجد خطط بعد.</p>
            ) : (
              recentPlans.map((plan) => (
                <Link
                  key={plan.public_id}
                  to={`/plans/${plan.public_id}`}
                  className="cd__preview-card cd__preview-card--link"
                >
                  <strong>{plan.lesson_title}</strong>
                  <span>
                    {plan.subject} | {plan.grade}
                  </span>
                  <span>
                    {plan.plan_type === 'traditional' ? 'تقليدية' : 'تعلم نشط'}
                  </span>
                  <span>{formatDateAr(plan.created_at)}</span>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="cd__panel">
          <header className="cd__panel-head">
            <h2>أخر الاختبارات</h2>
            <button type="button" onClick={() => navigate('/quizzes')}>
              عرض الكل
            </button>
          </header>

          <div className="cd__preview-list">
            {recentExams.length === 0 ? (
              <p className="cd__empty">لا توجد اختبارات بعد.</p>
            ) : (
              recentExams.map((exam) => {
                const subject = subjectMap.get(exam.subject_id);
                const classItem = classMap.get(exam.class_id);

                return (
                  <Link
                    key={exam.public_id}
                    to={`/quizzes/${exam.public_id}`}
                    className="cd__preview-card cd__preview-card--link"
                  >
                    <strong>{exam.title}</strong>
                    <span>
                      {subject?.name ?? '—'} | {classItem?.grade_label ?? '—'}
                    </span>
                    <span>
                      {exam.total_questions} سؤال | {exam.total_marks} درجة
                    </span>
                    <span>{formatDateAr(exam.created_at)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
