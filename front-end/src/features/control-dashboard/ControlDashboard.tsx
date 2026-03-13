import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { MdMenuBook, MdQuiz, MdRefresh } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useStage } from '../../context/StageContext';
import { QuickAccess } from '../../components/layout';
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
import '../auth/auth.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const HEALTH_URL = `${BACKEND_URL.replace(/\/$/, '')}/health`;
const HEALTH_TIMEOUT_MS = 5000;
const WAKE_UP_WAIT_MS = 40000;

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
  const [error, setError] = useState<string | null>(null);
  const [serverWakingUp, setServerWakingUp] = useState(false);
  const [refreshReady, setRefreshReady] = useState(false);

  const isAdmin = user?.userRole === 'admin';

  // Ping backend health on mount; if > 5s, show "server waking up" and allow refresh after 40s
  useEffect(() => {
    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => {
      ac.abort();
    }, HEALTH_TIMEOUT_MS);

    fetch(HEALTH_URL, { signal: ac.signal })
      .then(() => {
        clearTimeout(timeoutId);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setServerWakingUp(true);
      });

    return () => {
      clearTimeout(timeoutId);
      ac.abort();
    };
  }, []);

  // When showing "waking up", start 40s countdown for refresh
  useEffect(() => {
    if (!serverWakingUp) return;
    const id = window.setTimeout(() => setRefreshReady(true), WAKE_UP_WAIT_MS);
    return () => clearTimeout(id);
  }, [serverWakingUp]);

  const { activeStage } = useStage();

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    let cancelled = false;

    const stage = activeStage === 'all' ? undefined : activeStage;

    Promise.all([
      getScopedClasses(user.userRole, stage),
      getScopedSubjects(user.userRole, stage),
      getScopedLessons(user.userRole, stage),
      listScopedPlans(stage),
      listScopedExams(stage),
      listScopedAssignments(stage),
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
  }, [user?.userRole, activeStage]);

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

  const stageStats = useMemo(() => {
    const stages: Array<'ابتدائي' | 'اعدادي' | 'ثانوي'> = ['ابتدائي', 'اعدادي', 'ثانوي'];
    const byStage = stages.map((stage) => {
      const stageClasses = classes.filter((c) => c.stage === stage);
      const classIds = new Set(stageClasses.map((c) => c.id));
      const stageSubjects = subjects.filter((s) => classIds.has(s.class_id));
      const subjectIds = new Set(stageSubjects.map((s) => s.id));
      const stagePlans = plans.filter((p) => subjectIds.has((p as unknown as { subject_id?: number }).subject_id ?? 0));
      const stageExams = exams.filter((e) => classIds.has(e.class_id));
      return {
        stage,
        classesCount: stageClasses.length,
        subjectsCount: stageSubjects.length,
        plansCount: stagePlans.length,
        examsCount: stageExams.length,
      };
    });

    const totals = {
      classesCount: classes.length,
      subjectsCount: subjects.length,
      plansCount: plans.length,
      examsCount: exams.length,
    };

    return { byStage, totals };
  }, [classes, subjects, plans, exams]);

  if (!user) {
    return null;
  }

  return (
    <div className={`cd ui-loaded ${loading ? 'cd--loading' : ''}${serverWakingUp ? ' auth--wake-notice-visible' : ''}`}>
      {serverWakingUp && (
        <div className="auth__wake-notice" role="status">
          <p className="auth__wake-notice-text">
            الخادم المجاني قيد التشغيل. يرجى تحديث الصفحة بعد 40 ثانية ثم البدء باستخدام التطبيق.
          </p>
          <p className="auth__wake-notice-en">
            The free server is waking up. Please refresh the page after 40 seconds, then you can start using the app.
          </p>
          {refreshReady && (
            <button
              type="button"
              className="auth__wake-refresh-btn"
              onClick={() => window.location.reload()}
            >
              <MdRefresh aria-hidden />
              تحديث الصفحة الآن / Refresh now
            </button>
          )}
        </div>
      )}
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
      <QuickAccess />

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
                          <td>
                            {classItem ? (
                              `${classItem.grade_label} - ${classItem.section_label}`
                            ) : (
                              '—'
                            )}
                          </td>
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

      {/* Stage-based stats for teachers */}
      {!error && !isAdmin && (
        <section className="cd__tables" aria-label="ملخص حسب المرحلة">
          <article className="cd__table-card">
            <header>
              <h2>ملخص المراحل التعليمية</h2>
            </header>
            <div className="cd__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المرحلة</th>
                    <th>عدد الصفوف</th>
                    <th>عدد المواد</th>
                    <th>عدد الخطط</th>
                    <th>عدد الاختبارات</th>
                  </tr>
                </thead>
                <tbody>
                  {stageStats.byStage.map((row) => (
                    <tr key={row.stage}>
                      <td>{row.stage}</td>
                      <td>{row.classesCount}</td>
                      <td>{row.subjectsCount}</td>
                      <td>{row.plansCount}</td>
                      <td>{row.examsCount}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>الإجمالي</strong></td>
                    <td>{stageStats.totals.classesCount}</td>
                    <td>{stageStats.totals.subjectsCount}</td>
                    <td>{stageStats.totals.plansCount}</td>
                    <td>{stageStats.totals.examsCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
