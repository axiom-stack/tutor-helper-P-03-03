import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getScopedClasses,
  getScopedLessons,
  listScopedAssignments,
  listScopedExams,
  listScopedPlans,
  listTeacherScopes,
} from '../control-dashboard/control-dashboard.services';
import './stats.css';

interface Metrics {
  classes: number;
  lessons: number;
  plans: number;
  exams: number;
  assignments: number;
  editedAssignments: number;
  plansWithRetry: number;
  firstPassRate: number;
  activeTeachers: number;
}

function toPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

export default function Stats() {
  const { user } = useAuth();
  const isAdmin = user?.userRole === 'admin';

  const [metrics, setMetrics] = useState<Metrics>({
    classes: 0,
    lessons: 0,
    plans: 0,
    exams: 0,
    assignments: 0,
    editedAssignments: 0,
    plansWithRetry: 0,
    firstPassRate: 0,
    activeTeachers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const teachersPromise =
      user.userRole === 'admin' ? listTeacherScopes() : Promise.resolve({ teachers: [] });

    Promise.all([
      getScopedClasses(user.userRole),
      getScopedLessons(user.userRole),
      listScopedPlans(),
      listScopedExams(),
      listScopedAssignments(),
      teachersPromise,
    ])
      .then(
        ([classesResponse, lessonsResponse, plansResponse, examsResponse, assignmentsResponse, teachersResponse]) => {
          if (cancelled) {
            return;
          }

          const plans = plansResponse.plans ?? [];
          const assignments = assignmentsResponse.assignments ?? [];
          const editedAssignments = assignments.filter(
            (assignment) => assignment.updated_at > assignment.created_at
          ).length;
          const plansWithRetry = plans.filter((plan) => plan.retry_occurred).length;
          const firstPassRate =
            plans.length === 0 ? 0 : ((plans.length - plansWithRetry) / plans.length) * 100;

          const activeTeachers = (teachersResponse.teachers ?? []).filter((teacher) => {
            const usage = teacher.usage;
            return (
              usage.generated_plans_count > 0 ||
              usage.generated_exams_count > 0 ||
              usage.generated_assignments_count > 0
            );
          }).length;

          setMetrics({
            classes: classesResponse.classes?.length ?? 0,
            lessons: lessonsResponse.lessons?.length ?? 0,
            plans: plans.length,
            exams: examsResponse.exams?.length ?? 0,
            assignments: assignments.length,
            editedAssignments,
            plansWithRetry,
            firstPassRate,
            activeTeachers,
          });
        }
      )
      .catch(() => {
        if (!cancelled) {
          setError('تعذر تحميل الإحصائيات.');
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

  const cards = useMemo(() => {
    const base = [
      { label: 'عدد الصفوف', value: metrics.classes },
      { label: 'عدد الدروس', value: metrics.lessons },
      { label: 'عدد الخطط', value: metrics.plans },
      { label: 'عدد الاختبارات', value: metrics.exams },
      { label: 'عدد الواجبات', value: metrics.assignments },
      { label: 'تعديلات الواجبات', value: metrics.editedAssignments },
      { label: 'الخطط التي احتاجت إعادة', value: metrics.plansWithRetry },
      {
        label: 'نسبة نجاح الخطة من أول محاولة',
        value: toPercentage(metrics.firstPassRate),
      },
    ];

    if (isAdmin) {
      base.push({ label: 'المعلمون النشطون', value: metrics.activeTeachers });
    }

    return base;
  }, [isAdmin, metrics]);

  return (
    <div className="rp" dir="rtl">
      <header className="rp__header">
        <h1>التقارير والإحصائيات المبسطة</h1>
        <p>
          {isAdmin
            ? 'مؤشرات على مستوى النظام بالكامل.'
            : 'مؤشرات على نطاق حسابك الشخصي.'}
        </p>
      </header>

      {loading ? <p className="rp__state">جاري تحميل الإحصائيات...</p> : null}
      {error ? <p className="rp__state rp__state--error">{error}</p> : null}

      {!loading && !error ? (
        <section className="rp__cards">
          {cards.map((card) => (
            <article key={card.label} className="rp__card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
