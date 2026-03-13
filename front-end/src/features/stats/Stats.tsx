import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MdCalendarMonth,
  MdFileDownload,
  MdInsights,
  MdRefresh,
  MdTrendingUp,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type {
  StatsMonthlyTrendRow,
  StatsPeriod,
  StatsSummaryFilters,
  StatsSummaryResponse,
  StatsTeacherRiskFlag,
} from '../../types';
import { exportStatsPdf, getStatsSummary } from './stats.services';
import './stats.css';
import { useStage } from '../../context/StageContext';

const PERIOD_OPTIONS: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'all', label: 'كل الفترات' },
  { value: '30d', label: '30 يوماً' },
  { value: '90d', label: '90 يوماً' },
  { value: 'custom', label: 'فترة مخصصة' },
];

const TREND_SERIES = [
  { key: 'plans', label: 'الخطط', color: '#2563eb' },
  { key: 'exams', label: 'الاختبارات', color: '#16a34a' },
  { key: 'assignments', label: 'الواجبات', color: '#ea580c' },
] as const;

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return value.toLocaleString('ar-SA', {
    maximumFractionDigits: 1,
  });
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRiskLabel(flag: StatsTeacherRiskFlag): string {
  if (flag === 'low_quality') {
    return 'جودة منخفضة';
  }

  if (flag === 'high_retry') {
    return 'إعادة توليد مرتفعة';
  }

  return 'تعديلات واجبات مرتفعة';
}

function getQualityBandTone(
  band: string
): 'excellent' | 'good' | 'acceptable' | 'risk' | 'neutral' {
  if (band === 'ممتاز') return 'excellent';
  if (band === 'جيد جداً') return 'good';
  if (band === 'مقبول') return 'acceptable';
  if (band === 'يحتاج تحسين') return 'risk';
  return 'neutral';
}

function buildTeacherInsights(summary: StatsSummaryResponse): string[] {
  const insights: string[] = [];
  const kpis = summary.kpis;

  if (kpis.plans_generated === 0) {
    return [
      'لا توجد خطط في هذا النطاق الزمني. أنشئ خطة جديدة لبدء تتبع الجودة.',
    ];
  }

  if (kpis.avg_plan_quality < 70) {
    insights.push(
      'متوسط جودة الخطط منخفض. راجع عناصر Rubric خصوصاً الاكتمال البنيوي وعمق المحتوى.'
    );
  }

  if (kpis.retry_rate > 30) {
    insights.push(
      'معدل إعادة التوليد مرتفع. حسّن وضوح مدخلات الدرس وأهداف التعلم قبل التوليد.'
    );
  }

  if (kpis.assignment_edit_rate > 60) {
    insights.push(
      'معدل تعديل الواجبات مرتفع. حاول تحسين صياغة الطلب الأولي لتقليل التعديلات اللاحقة.'
    );
  }

  if (kpis.first_pass_rate >= 80) {
    insights.push('أداء ممتاز: نسبة النجاح من أول محاولة مرتفعة.');
  }

  if (insights.length === 0) {
    insights.push(
      'الأداء مستقر ضمن هذا النطاق. استمر في تحسين الاتساق بين الأهداف والأنشطة والتقويم.'
    );
  }

  return insights;
}

function TrendChart({ rows }: { rows: StatsMonthlyTrendRow[] }) {
  if (!rows.length) {
    return <p className="st__empty">لا توجد بيانات اتجاهات حتى الآن.</p>;
  }

  const width = 760;
  const height = 240;
  const paddingX = 40;
  const paddingY = 24;

  const values = rows.flatMap((row) => [row.plans, row.exams, row.assignments]);
  const maxValue = Math.max(1, ...values);

  const xForIndex = (index: number) => {
    if (rows.length === 1) {
      return width / 2;
    }

    return paddingX + (index * (width - paddingX * 2)) / (rows.length - 1);
  };

  const yForValue = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0;
    return height - paddingY - (safe / maxValue) * (height - paddingY * 2);
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = height - paddingY - ratio * (height - paddingY * 2);
    const v = Math.round(maxValue * ratio);
    return { y, value: v };
  });

  return (
    <div className="st__chart-wrap">
      <svg
        className="st__chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="اتجاهات شهرية للخطط والاختبارات والواجبات"
      >
        {yTicks.map((tick) => (
          <g key={`grid-${tick.value}`}>
            <line
              x1={paddingX}
              y1={tick.y}
              x2={width - paddingX}
              y2={tick.y}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeDasharray="4 5"
            />
            <text
              x={paddingX - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="st__chart-axis-label"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {TREND_SERIES.map((series) => {
          const points = rows
            .map((row, index) => {
              const value = row[series.key] ?? 0;
              return `${xForIndex(index)},${yForValue(value)}`;
            })
            .join(' ');

          return (
            <polyline
              key={series.key}
              points={points}
              fill="none"
              stroke={series.color}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {TREND_SERIES.map((series) =>
          rows.map((row, index) => {
            const value = row[series.key] ?? 0;
            return (
              <circle
                key={`${series.key}-${row.month}`}
                cx={xForIndex(index)}
                cy={yForValue(value)}
                r={4}
                fill={series.color}
              />
            );
          })
        )}
      </svg>

      <div className="st__chart-legend" aria-hidden>
        {TREND_SERIES.map((series) => (
          <span key={series.key}>
            <i style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>

      <div className="st__chart-months" aria-hidden>
        {rows.map((row) => (
          <span key={`month-${row.month}`}>{row.month_label}</span>
        ))}
      </div>
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const isAdmin = user?.userRole === 'admin';

  const { activeStage } = useStage();

  const [period, setPeriod] = useState<StatsPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const [summary, setSummary] = useState<StatsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo<StatsSummaryFilters>(() => {
    const next: StatsSummaryFilters = {
      period,
      stage: activeStage === 'all' ? null : activeStage,
    };

    if (period === 'custom') {
      if (customFrom) {
        next.date_from = customFrom;
      }
      if (customTo) {
        next.date_to = customTo;
      }
    }

    if (isAdmin && selectedTeacherId) {
      next.teacher_id = Number(selectedTeacherId);
    }

    return next;
  }, [period, customFrom, customTo, isAdmin, selectedTeacherId, activeStage]);

  const customRangeError = useMemo(() => {
    if (period !== 'custom') {
      return null;
    }

    if (!customFrom || !customTo) {
      return 'اختر تاريخ البداية والنهاية للفترة المخصصة.';
    }

    if (customFrom > customTo) {
      return 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.';
    }

    return null;
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (!user?.userRole) {
      return;
    }

    if (customRangeError) {
      return;
    }

    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getStatsSummary(filters);

        if (!cancelled) {
          setSummary(response);
        }
      } catch (loadError: unknown) {
        if (cancelled) {
          return;
        }

        const message =
          typeof loadError === 'object' &&
          loadError &&
          'message' in loadError &&
          typeof loadError.message === 'string'
            ? loadError.message
            : 'تعذر تحميل بيانات الإحصائيات.';

        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [user?.userRole, customRangeError, filters, reloadSeed]);

  useEffect(() => {
    if (customRangeError) {
      toast.error(customRangeError);
    }
  }, [customRangeError]);

  const kpiCards = useMemo(() => {
    if (!summary) {
      return [];
    }

    const cards: Array<{
      label: string;
      value: string;
      tone?: 'neutral' | 'positive' | 'warn';
    }> = [
      {
        label: 'عدد الخطط المولدة',
        value: formatNumber(summary.kpis.plans_generated),
      },
      {
        label: 'متوسط جودة الخطط',
        value: formatNumber(summary.kpis.avg_plan_quality),
        tone: 'positive',
      },
      {
        label: 'عدد الاختبارات المولدة',
        value: formatNumber(summary.kpis.exams_generated),
      },
      {
        label: 'عدد الواجبات المولدة',
        value: formatNumber(summary.kpis.assignments_generated),
      },
      {
        label: 'نسبة النجاح من أول محاولة',
        value: formatPercent(summary.kpis.first_pass_rate),
        tone: 'positive',
      },
      {
        label: 'معدل إعادة التوليد',
        value: formatPercent(summary.kpis.retry_rate),
        tone: 'warn',
      },
      {
        label: 'معدل تعديل الواجبات',
        value: formatPercent(summary.kpis.assignment_edit_rate),
      },
      {
        label: 'متوسط عدد أسئلة الاختبار',
        value: formatNumber(summary.kpis.avg_exam_questions),
      },
      {
        label: 'عدد الأيام النشطة',
        value: formatNumber(summary.kpis.active_days),
      },
    ];

    if (isAdmin && summary.kpis.active_teachers != null) {
      cards.push({
        label: 'المعلمون النشطون',
        value: formatNumber(summary.kpis.active_teachers),
      });
    }

    return cards;
  }, [summary, isAdmin]);

  const teacherInsights = useMemo(() => {
    if (!summary || isAdmin) {
      return [];
    }

    return buildTeacherInsights(summary);
  }, [summary, isAdmin]);

  const hasData = Boolean(
    summary &&
    (summary.kpis.plans_generated > 0 ||
      summary.kpis.exams_generated > 0 ||
      summary.kpis.assignments_generated > 0)
  );

  const handleExport = () => {
    if (exporting) {
      return;
    }

    if (customRangeError) {
      setError(customRangeError);
      toast.error(customRangeError);
      return;
    }

    setExporting(true);
    setError(null);

    exportStatsPdf(filters)
      .catch((exportError: unknown) => {
        const message =
          typeof exportError === 'object' &&
          exportError &&
          'message' in exportError &&
          typeof exportError.message === 'string'
            ? exportError.message
            : 'فشل تصدير التقرير.';

        setError(message);
        toast.error(message);
      })
      .finally(() => {
        setExporting(false);
      });
  };

  if (!user) {
    return null;
  }

  const effectiveLoading = customRangeError ? false : loading;

  if (loading && !summary && !customRangeError) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="st ui-loaded">
      <header className="st__header page-header">
        <div className="st__title-wrap">
          <span className="st__eyebrow">
            <MdInsights aria-hidden />
            مركز التحليلات
          </span>
          <h1>التقارير والإحصائيات</h1>
          <p>
            {isAdmin
              ? 'لوحة تحليل شاملة على مستوى النظام مع مؤشرات جودة وأداء المعلمين.'
              : 'تحليل نشاطك التعليمي وجودة الخطط بنموذج Rubric مبسط.'}
          </p>
        </div>

        <div className="st__header-meta">
          <span>
            <MdCalendarMonth aria-hidden />
            آخر تحديث: {formatDateTime(summary?.filters_applied.generated_at)}
          </span>
          {summary?.filters_applied.date_from &&
          summary?.filters_applied.date_to ? (
            <span>
              الفترة: {summary.filters_applied.date_from} -{' '}
              {summary.filters_applied.date_to}
            </span>
          ) : (
            <span>الفترة: كل الفترات</span>
          )}
        </div>
      </header>

      <section className="st__filters" aria-label="فلاتر الإحصائيات">
        <div className="st__chips">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`st__chip ${period === option.value ? 'st__chip--active' : ''}`}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="st__filters-right">
          {period === 'custom' ? (
            <div className="st__custom-range">
              <label>
                من
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </label>
              <label>
                إلى
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {isAdmin ? (
            <label className="st__teacher-filter">
              المعلم
              <select
                value={selectedTeacherId}
                onChange={(event) => setSelectedTeacherId(event.target.value)}
              >
                <option value="">كل المعلمين</option>
                {(summary?.admin?.teacher_options ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.display_name || teacher.username}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            className="st__action-btn"
            onClick={() => setReloadSeed((prev) => prev + 1)}
            disabled={effectiveLoading}
          >
            {effectiveLoading && (
              <span className="ui-button-spinner" aria-hidden />
            )}
            {!effectiveLoading && <MdRefresh aria-hidden />}
            تحديث
          </button>

          <button
            type="button"
            className="st__action-btn st__action-btn--primary"
            onClick={handleExport}
            disabled={effectiveLoading || exporting}
          >
            {exporting && <span className="ui-button-spinner" aria-hidden />}
            {!exporting && <MdFileDownload aria-hidden />}
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </button>
        </div>
      </section>

      {effectiveLoading ? (
        <>
          <section
            className="st__kpis st__kpis--loading"
            aria-label="تحميل الإحصائيات"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`kpi-skeleton-${index}`}
                className="st__kpi-card st__kpi-card--skeleton"
              />
            ))}
          </section>
          <section className="st__grid-two">
            <div className="st__panel st__panel--skeleton" />
            <div className="st__panel st__panel--skeleton" />
          </section>
        </>
      ) : null}

      {!effectiveLoading && summary ? (
        <>
          <section className="st__kpis" aria-label="المؤشرات الرئيسية">
            {kpiCards.map((card) => (
              <article
                key={card.label}
                className={`st__kpi-card st__kpi-card--${card.tone || 'neutral'}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          {!hasData ? (
            <section className="st__panel st__empty-state">
              <h2>لا توجد بيانات في النطاق الحالي</h2>
              <p>
                جرّب توسيع الفترة الزمنية أو إزالة الفلاتر لعرض بيانات أكثر.
              </p>
            </section>
          ) : (
            <>
              <section className="st__grid-two">
                <article className="st__panel">
                  <header className="st__panel-head">
                    <h2>متوسط جودة الخطط (Rubric)</h2>
                    <span
                      className={`st__quality-band st__quality-band--${getQualityBandTone(
                        summary.quality_rubric.quality_band
                      )}`}
                    >
                      {summary.quality_rubric.quality_band}
                    </span>
                  </header>

                  <div className="st__quality-score">
                    <strong>
                      {formatNumber(summary.quality_rubric.average_score)}
                    </strong>
                    <small>من 100</small>
                  </div>

                  <div className="st__criteria-list">
                    {[
                      {
                        label: 'الاعتمادية من أول محاولة',
                        value:
                          summary.quality_rubric.criteria
                            .first_pass_reliability,
                        max: 40,
                      },
                      {
                        label: 'الاكتمال البنيوي',
                        value:
                          summary.quality_rubric.criteria
                            .structural_completeness,
                        max: 35,
                      },
                      {
                        label: 'عمق المحتوى',
                        value: summary.quality_rubric.criteria.content_depth,
                        max: 25,
                      },
                    ].map((item) => {
                      const width =
                        item.max > 0
                          ? Math.min(100, (item.value / item.max) * 100)
                          : 0;

                      return (
                        <div key={item.label} className="st__criterion-item">
                          <div className="st__criterion-meta">
                            <span>{item.label}</span>
                            <strong>{formatNumber(item.value)}</strong>
                          </div>
                          <div className="st__criterion-track">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="st__distribution-grid">
                    <div>
                      <label>ممتاز</label>
                      <strong>
                        {formatNumber(
                          summary.quality_rubric.distribution.excellent
                        )}
                      </strong>
                    </div>
                    <div>
                      <label>جيد جداً</label>
                      <strong>
                        {formatNumber(
                          summary.quality_rubric.distribution.very_good
                        )}
                      </strong>
                    </div>
                    <div>
                      <label>مقبول</label>
                      <strong>
                        {formatNumber(
                          summary.quality_rubric.distribution.acceptable
                        )}
                      </strong>
                    </div>
                    <div>
                      <label>يحتاج تحسين</label>
                      <strong>
                        {formatNumber(
                          summary.quality_rubric.distribution.needs_improvement
                        )}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className="st__panel">
                  <header className="st__panel-head">
                    <h2>تفصيل الأنواع</h2>
                    <span className="st__panel-icon">
                      <MdTrendingUp aria-hidden />
                    </span>
                  </header>

                  <div className="st__breakdown-block">
                    <h3>أنواع الخطط</h3>
                    {[
                      {
                        label: 'تقليدية',
                        count: summary.breakdowns.plan_types.traditional,
                      },
                      {
                        label: 'تعلم نشط',
                        count: summary.breakdowns.plan_types.active_learning,
                      },
                    ].map((item) => {
                      const total =
                        summary.breakdowns.plan_types.traditional +
                        summary.breakdowns.plan_types.active_learning;
                      const width = total > 0 ? (item.count / total) * 100 : 0;

                      return (
                        <div className="st__breakdown-row" key={item.label}>
                          <div className="st__breakdown-meta">
                            <span>{item.label}</span>
                            <strong>{formatNumber(item.count)}</strong>
                          </div>
                          <div className="st__breakdown-track">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="st__breakdown-block">
                    <h3>أنواع الواجبات</h3>
                    {[
                      {
                        label: 'تحريري',
                        count: summary.breakdowns.assignment_types.written,
                      },
                      {
                        label: 'متنوع',
                        count: summary.breakdowns.assignment_types.varied,
                      },
                      {
                        label: 'عملي',
                        count: summary.breakdowns.assignment_types.practical,
                      },
                    ].map((item) => {
                      const total =
                        summary.breakdowns.assignment_types.written +
                        summary.breakdowns.assignment_types.varied +
                        summary.breakdowns.assignment_types.practical;
                      const width = total > 0 ? (item.count / total) * 100 : 0;

                      return (
                        <div className="st__breakdown-row" key={item.label}>
                          <div className="st__breakdown-meta">
                            <span>{item.label}</span>
                            <strong>{formatNumber(item.count)}</strong>
                          </div>
                          <div className="st__breakdown-track">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </section>

              <section className="st__panel">
                <header className="st__panel-head">
                  <h2>الاتجاهات الشهرية</h2>
                </header>
                <TrendChart rows={summary.trends.monthly} />
              </section>

              {isAdmin && summary.admin ? (
                <section className="st__panel">
                  <header className="st__panel-head">
                    <h2>أداء المعلمين</h2>
                    <small>انقر على صف المعلم لتطبيق فلتر مباشر</small>
                  </header>
                  <div className="st__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>المعلم</th>
                          <th>الخطط</th>
                          <th>متوسط الجودة</th>
                          <th>نجاح أول محاولة</th>
                          <th>الاختبارات</th>
                          <th>الواجبات</th>
                          <th>تعديلات الواجبات</th>
                          <th>آخر نشاط</th>
                          <th>مخاطر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.admin.teacher_performance.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="st__table-empty">
                              لا توجد بيانات معلمين ضمن النطاق الحالي.
                            </td>
                          </tr>
                        ) : (
                          summary.admin.teacher_performance.map((row) => (
                            <tr
                              key={row.teacher_id}
                              className={
                                selectedTeacherId === String(row.teacher_id)
                                  ? 'st__row--active'
                                  : ''
                              }
                              onClick={() =>
                                setSelectedTeacherId(String(row.teacher_id))
                              }
                            >
                              <td>{row.display_name || row.username}</td>
                              <td>{formatNumber(row.plans_generated)}</td>
                              <td>{formatNumber(row.avg_plan_quality)}</td>
                              <td>{formatPercent(row.first_pass_rate)}</td>
                              <td>{formatNumber(row.exams_generated)}</td>
                              <td>{formatNumber(row.assignments_generated)}</td>
                              <td>{formatNumber(row.edited_assignments)}</td>
                              <td>{formatDateTime(row.last_activity_at)}</td>
                              <td>
                                {row.risk_flags.length === 0 ? (
                                  <span className="st__risk-badge st__risk-badge--safe">
                                    مستقر
                                  </span>
                                ) : (
                                  row.risk_flags.map((flag) => (
                                    <span
                                      key={`${row.teacher_id}-${flag}`}
                                      className="st__risk-badge st__risk-badge--risk"
                                    >
                                      {getRiskLabel(flag)}
                                    </span>
                                  ))
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {!isAdmin ? (
                <section className="st__panel st__panel--insights">
                  <header className="st__panel-head">
                    <h2>رؤى وتوصيات</h2>
                  </header>
                  <ul className="st__insights-list">
                    {teacherInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
