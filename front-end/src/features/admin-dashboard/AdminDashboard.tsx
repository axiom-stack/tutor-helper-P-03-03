import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import {
  MdInsights,
  MdLibraryBooks,
  MdPeople,
  MdQuiz,
  MdSchool,
  MdSettings,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useStage } from '../../context/StageContext';
import type { Exam, LessonPlanRecord, TeacherManagementRow } from '../../types';
import { listTeachers } from '../users/users.services';
import { getScopedClasses, getScopedSubjects, listScopedExams, listScopedPlans } from '../control-dashboard/control-dashboard.services';
import './admin-dashboard.css';

type AdminAction = {
  path: string;
  title: string;
  description: string;
  icon: typeof MdPeople;
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const { activeStage } = useStage();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);
  const [plans, setPlans] = useState<LessonPlanRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.display_name || user?.username || 'المدير';

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listTeachers(),
      listScopedPlans(activeStage === 'all' ? undefined : activeStage),
      listScopedExams(activeStage === 'all' ? undefined : activeStage),
      getScopedClasses('admin', activeStage === 'all' ? undefined : activeStage),
      getScopedSubjects('admin', activeStage === 'all' ? undefined : activeStage),
    ])
      .then(([teachersResponse, plansResponse, examsResponse]) => {
        if (cancelled) {
          return;
        }

        setTeachers(teachersResponse.teachers ?? []);
        setPlans(plansResponse.plans ?? []);
        setExams(examsResponse.exams ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('تعذر تحميل لوحة المدير.');
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
  }, [activeStage]);

  const teacherCount = teachers.length;
  const recentPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3),
    [plans]
  );
  const recentExams = useMemo(
    () => [...exams].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3),
    [exams]
  );

  const actions: AdminAction[] = [
    {
      path: '/teachers',
      title: 'إدارة المعلمين',
      description: 'إنشاء الحسابات، تحديثها، إعادة ضبط كلمات المرور، والحذف المؤكد.',
      icon: MdPeople,
    },
    {
      path: '/curriculum',
      title: 'إدارة المنهج',
      description: 'استعراض هرم المنهج على مستوى المعلمين أو تحريره عند الحاجة.',
      icon: MdSchool,
    },
    {
      path: '/plans',
      title: 'مكتبة الخطط',
      description: 'مراجعة جميع الخطط المولدة في النظام والبحث بينها بسرعة.',
      icon: MdLibraryBooks,
    },
    {
      path: '/quizzes',
      title: 'مكتبة الاختبارات',
      description: 'تتبع الاختبارات المولدة على مستوى النظام والمراجعة السريعة لها.',
      icon: MdQuiz,
    },
    {
      path: '/stats',
      title: 'التقارير والأداء',
      description: 'استخراج صورة عامة عن النشاط والجودة والاستخدام على مستوى النظام.',
      icon: MdInsights,
    },
    {
      path: '/settings',
      title: 'إعدادات الحساب',
      description: 'ضبط اللغة والهوية البصرية وتفضيلات التحضير الخاصة بالحساب الحالي.',
      icon: MdSettings,
    },
  ];

  if (!user) {
    return null;
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

  return (
    <div className="ad ui-loaded">
      <header className="ad__hero page-header">
        <div>
          <p className="ad__eyebrow">لوحة النظام</p>
          <h1>مرحباً، {displayName}</h1>
          <p>هذه مساحة الإشراف الشامل على المنصة، مع وصول مباشر إلى المعلمين والمحتوى.</p>
        </div>

        <div className="ad__stats">
          <div>
            <span>المعلمين</span>
            <strong>{teacherCount}</strong>
          </div>
          <div>
            <span>الخطط</span>
            <strong>{plans.length}</strong>
          </div>
          <div>
            <span>الاختبارات</span>
            <strong>{exams.length}</strong>
          </div>
        </div>
      </header>

      <section className="ad__actions" aria-label="اختصارات المدير">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.path} type="button" className="ad__action-card" onClick={() => navigate(action.path)}>
              <span className="ad__action-icon" aria-hidden>
                <Icon />
              </span>
              <span className="ad__action-copy">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="ad__panels">
        <article className="ad__panel">
          <header className="ad__panel-head">
            <h2>أخر الخطط</h2>
            <button type="button" onClick={() => navigate('/plans')}>
              عرض الكل
            </button>
          </header>

          <div className="ad__list">
            {recentPlans.length === 0 ? (
              <p className="ad__empty">لا توجد خطط بعد.</p>
            ) : (
              recentPlans.map((plan) => (
                <div key={plan.public_id} className="ad__item">
                  <strong>{plan.lesson_title}</strong>
                  <span>{plan.subject} | {plan.grade}</span>
                  <span>{formatDateAr(plan.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="ad__panel">
          <header className="ad__panel-head">
            <h2>أخر الاختبارات</h2>
            <button type="button" onClick={() => navigate('/quizzes')}>
              عرض الكل
            </button>
          </header>

          <div className="ad__list">
            {recentExams.length === 0 ? (
              <p className="ad__empty">لا توجد اختبارات بعد.</p>
            ) : (
              recentExams.map((exam) => (
                <div key={exam.public_id} className="ad__item">
                  <strong>{exam.title}</strong>
                  <span>{exam.total_questions} سؤال | {exam.total_marks} درجة</span>
                  <span>{formatDateAr(exam.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
