# 9. STATISTICS & ANALYTICS SYSTEM

## 9.1 Key Performance Indicators (KPIs)

### Teacher-Level Metrics

```typescript
export interface TeacherStats {
  // Usage Metrics
  plans_generated: number;           // Total lesson plans created
  last_plan_date: timestamp;         // Most recent plan
  plans_edited: number;              // Plans edited after generation
  plans_exported: number;            // Plans downloaded/exported
  edit_rate: percentage;             // edited / generated

  quizzes_created: number;           // Exams created
  assignments_created: number;       // Assignments created

  // Quality Metrics
  avg_plan_quality_score: 0-100;     // Average quality rubric score
  quality_distribution: {
    ممتاز: percentage,               // Excellent (85-100)
    جيد_جدا: percentage,             // V.Good (70-84)
    مقبول: percentage,               // Acceptable (55-69)
    يحتاج_تحسين: percentage          // Needs improvement (<55)
  };

  first_pass_rate: percentage;       // % of plans passing validation on first LLM attempt
  retry_rate: percentage;            // % requiring Prompt 2 retry or guided retry

  // Engagement
  last_active_date: timestamp;
  active_days_count: number;         // Days with activity in last 30 days
  streak_days: number;               // Consecutive active days

  // Subscription/Admin
  total_students: number;            // Classes * average students per class
  content_hours_created: number;     // Sum of all plan durations / 60

  // Refinement Adoption
  refinements_requested: number;     // Smart refinement requests
  refinements_approved: number;      // Approved by teacher
  refinement_adoption_rate: percentage;
}
```

### System-Level Metrics

```typescript
export interface SystemStats {
  // Growth
  total_teachers: number;
  active_teachers_today: number;
  active_teachers_week: number;
  active_teachers_month: number;
  new_teachers_this_week: number;
  new_teachers_this_month: number;

  // Content Production
  total_plans_generated: number;
  total_assignments_created: number;
  total_exams_created: number;
  avg_plans_per_teacher: number;

  // Quality Distribution (System-wide)
  system_avg_quality_score: 0-100;
  plans_with_quality_excellent: percentage;
  plans_with_quality_good: percentage;
  plans_with_quality_acceptable: percentage;
  plans_needing_improvement: percentage;

  // LLM Performance
  avg_generation_time_seconds: number;
  prompt1_success_rate: percentage;   // % not requiring retry
  prompt2_success_rate: percentage;
  validation_pass_rate: percentage;   // % passing pedagogical rules

  // Engagement & Retention
  daus: number;                       // Daily Active Users
  maus: number;                       // Monthly Active Users
  retention_d7: percentage;           // 7-day retention
  retention_d30: percentage;          // 30-day retention
  churn_rate_month: percentage;       // % inactive > 30 days

  // Top Content
  most_used_subjects: string[];
  most_used_grades: string[];
  avg_lesson_duration: minutes;
}
```

---

## 9.2 Quality Rubric Scoring Algorithm

### Quality Score Calculation

```typescript
// back-end/src/services/stats/qualityRubric.js

export class QualityRubric {
  /**
   * Calculate quality score 0-100 based on plan characteristics
   */
  scorePlanQuality(planRecord) {
    const plan = JSON.parse(planRecord.plan_json);
    let totalScore = 0;

    // 1. First Pass Reliability (40 points max)
    // Logic: Plans passing validation on first LLM attempt are more reliable
    const firstPassReliability = planRecord.retry_occurred ? 24 : 40;
    totalScore += firstPassReliability;

    // 2. Structural Completeness (35 points max)
    const structureScore = this.scoreStructure(plan);
    totalScore += structureScore;

    // 3. Content Depth (25 points max)
    const depthScore = this.scoreContentDepth(plan);
    totalScore += depthScore;

    return Math.min(totalScore, 100);
  }

  /**
   * Structural completeness: Does plan have all required sections?
   */
  scoreStructure(plan) {
    let score = 0;

    // 7 points per section present
    if (plan.objectives && plan.objectives.length >= 3) score += 7;
    if (plan.activities && plan.activities.length >= 7) score += 7;
    if (plan.assessment && plan.assessment.methods.length >= 2) score += 7;
    if (plan.resources && plan.resources.length >= 3) score += 7;
    if (plan.timing_breakdown) score += 7;

    // Bonus: Proper time distribution (3 points)
    if (this.isValidTimeDistribution(plan.timing_breakdown)) score += 3;

    return Math.min(score, 35);
  }

  /**
   * Content depth: Quality of descriptions and objectives
   */
  scoreContentDepth(plan) {
    let score = 0;

    // Objective quality (8 points max)
    const objectiveQuality = this.scoreObjectives(plan.objectives);
    score += objectiveQuality;

    // Activity variety (8 points max)
    const activityVariety = this.scoreActivityVariety(plan.activities);
    score += activityVariety;

    // Assessment methods variety (5 points max)
    const assessmentVariety = this.scoreAssessmentVariety(
      plan.assessment.methods,
    );
    score += assessmentVariety;

    // Resource adequacy (4 points max)
    const resourceScore = Math.min((plan.resources || []).length, 4);
    score += resourceScore;

    return Math.min(score, 25);
  }

  scoreObjectives(objectives) {
    let score = 0;

    // Valid Bloom distribution (4 points)
    const bloomLevels = new Set(objectives.map((o) => o.bloom_level));
    if (bloomLevels.size >= 3) score += 4;
    else if (bloomLevels.size >= 2) score += 2;

    // Domain distribution (4 points)
    const domains = new Set(objectives.map((o) => o.domain));
    if (domains.size === 3) score += 4;
    else if (domains.size === 2) score += 2;

    return Math.min(score, 8);
  }

  scoreActivityVariety(activities) {
    let score = 0;

    // Number of activities (4 points)
    if (activities.length >= 10) score += 4;
    else if (activities.length >= 7) score += 2;

    // Method diversity (4 points)
    const methods = new Set(activities.map((a) => a.teaching_method));
    if (methods.size >= 4) score += 4;
    else if (methods.size >= 3) score += 2;

    return Math.min(score, 8);
  }

  scoreAssessmentVariety(methods) {
    if (methods.length >= 4) return 5;
    if (methods.length >= 3) return 4;
    if (methods.length >= 2) return 2;
    return 0;
  }

  isValidTimeDistribution(timing) {
    const total =
      timing.intro_minutes +
      timing.main_minutes +
      timing.closing_minutes +
      timing.assessment_minutes;

    const introPct = (timing.intro_minutes / total) * 100;
    const mainPct = (timing.main_minutes / total) * 100;
    const closingPct = (timing.closing_minutes / total) * 100;
    const assessmentPct = (timing.assessment_minutes / total) * 100;

    return (
      introPct >= 8 &&
      introPct <= 12 &&
      mainPct >= 57 &&
      mainPct <= 63 &&
      closingPct >= 18 &&
      closingPct <= 22 &&
      assessmentPct >= 8 &&
      assessmentPct <= 12
    );
  }
}

// Usage
const rubric = new QualityRubric();
const score = rubric.scorePlanQuality(planRecord);
```

### Quality Bands

```typescript
export const QUALITY_BANDS = {
  EXCELLENT: { min: 85, max: 100, label: "ممتاز", color: "#4caf50" },
  VERY_GOOD: { min: 70, max: 84, label: "جيد جداً", color: "#8bc34a" },
  ACCEPTABLE: { min: 55, max: 69, label: "مقبول", color: "#ffc107" },
  NEEDS_IMPROVEMENT: {
    min: 0,
    max: 54,
    label: "يحتاج تحسين",
    color: "#f44336",
  },
};

export function getQualityBand(score) {
  for (const [key, band] of Object.entries(QUALITY_BANDS)) {
    if (score >= band.min && score <= band.max) {
      return band;
    }
  }
  return QUALITY_BANDS.NEEDS_IMPROVEMENT;
}
```

---

## 9.3 Statistics Aggregation Service

### Monthly Statistics Calculation

```typescript
// back-end/src/services/stats/stats.service.js

export class StatsService {
  async getTeacherStatsForPeriod(teacherId, period = "month") {
    const startDate = this.getDateRange(period).start;
    const endDate = this.getDateRange(period).end;

    // 1. Plans Generated
    const plansCount = await db.query(
      `
      SELECT COUNT(*) as count
      FROM lesson_plans
      WHERE teacher_id = ? AND created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    // 2. Plans Edited
    const editsCount = await db.query(
      `
      SELECT COUNT(DISTINCT ar.artifact_public_id) as count
      FROM artifact_revisions ar
      WHERE ar.created_by_user_id = ?
        AND ar.artifact_type = 'lesson_plan'
        AND ar.revision_number > 1
        AND ar.created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    // 3. Average Quality Score
    const avgQuality = await db.query(
      `
      SELECT AVG(qr.quality_score) as avg
      FROM lesson_plans lp
      JOIN quality_rubric_scores qr ON lp.id = qr.plan_id
      WHERE lp.teacher_id = ? AND lp.created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    // 4. First Pass Rate (no retry)
    const noRetrysCount = await db.query(
      `
      SELECT COUNT(*) as count
      FROM lesson_plans
      WHERE teacher_id = ? 
        AND retry_occurred = 0
        AND created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    const firstPassRate =
      plansCount.count > 0 ? (noRetrysCount.count / plansCount.count) * 100 : 0;

    // 5. Active Days
    const activeDays = await db.query(
      `
      SELECT COUNT(DISTINCT DATE(created_at)) as count
      FROM lesson_plans
      WHERE teacher_id = ? AND created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    // 6. Refinement Stats
    const refinementStats = await db.query(
      `
      SELECT 
        COUNT(*) as requests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM refinement_requests
      WHERE created_by_user_id = ? AND created_at BETWEEN ? AND ?
    `,
      [teacherId, startDate, endDate],
    );

    return {
      plans_generated: plansCount.count,
      plans_edited: editsCount.count,
      avg_quality_score: Math.round(avgQuality.avg || 0),
      first_pass_rate: Math.round(firstPassRate),
      active_days: activeDays.count,
      refinements_requested: refinementStats.requests,
      refinements_approved: refinementStats.approved,
      refinement_adoption_rate:
        refinementStats.requests > 0
          ? Math.round(
              (refinementStats.approved / refinementStats.requests) * 100,
            )
          : 0,
      period_start: startDate,
      period_end: endDate,
    };
  }

  async getSystemStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();

    // Active users
    const activeToday = await db.query(
      `
      SELECT COUNT(DISTINCT teacher_id) as count
      FROM lesson_plans WHERE created_at >= DATE(?)
    `,
      [today],
    );

    const activeWeek = await db.query(
      `
      SELECT COUNT(DISTINCT teacher_id) as count
      FROM lesson_plans WHERE created_at >= ?
    `,
      [sevenDaysAgo],
    );

    const activeMonth = await db.query(
      `
      SELECT COUNT(DISTINCT teacher_id) as count
      FROM lesson_plans WHERE created_at >= ?
    `,
      [thirtyDaysAgo],
    );

    // Quality distribution (system-wide)
    const qualityDist = await db.query(`
      SELECT
        SUM(CASE WHEN quality_score >= 85 THEN 1 ELSE 0 END) as excellent,
        SUM(CASE WHEN quality_score BETWEEN 70 AND 84 THEN 1 ELSE 0 END) as very_good,
        SUM(CASE WHEN quality_score BETWEEN 55 AND 69 THEN 1 ELSE 0 END) as acceptable,
        SUM(CASE WHEN quality_score < 55 THEN 1 ELSE 0 END) as needs_improve,
        COUNT(*) as total
      FROM lesson_plans lp
      JOIN quality_rubric_scores qrs ON lp.id = qrs.plan_id
    `);

    return {
      actuals: {
        active_today: activeToday.count,
        active_week: activeWeek.count,
        active_month: activeMonth.count,
      },
      quality_distribution: qualityDist,
      timestamp: new Date().toISOString(),
    };
  }

  getDateRange(period) {
    const now = new Date();
    let start;

    switch (period) {
      case "week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end: now };
  }
}
```

---

## 9.4 Statistics API Endpoints

### REST API for Admin Dashboard

```typescript
// back-end/src/routes/admin.routes.js

router.get(
  "/api/admin/stats/overview",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const stats = await statsService.getSystemStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/api/admin/stats/teachers",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const teachers = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        (SELECT COUNT(*) FROM lesson_plans WHERE teacher_id = u.id) as plans_count,
        (SELECT MAX(created_at) FROM lesson_plans WHERE teacher_id = u.id) as last_active,
        (SELECT AVG(qrs.quality_score) 
         FROM lesson_plans lp 
         JOIN quality_rubric_scores qrs ON lp.id = qrs.plan_id
         WHERE lp.teacher_id = u.id) as avg_quality
      FROM users u
      WHERE u.role = 'teacher'
      ORDER BY plans_count DESC
      LIMIT 100
    `);

      res.json(teachers);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/api/admin/stats/teacher/:teacherId",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { period = "month" } = req.query;

      const stats = await statsService.getTeacherStatsForPeriod(
        teacherId,
        period,
      );
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/api/admin/stats/trends",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const trends = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as plans_created,
        COUNT(DISTINCT teacher_id) as active_teachers,
        AVG(CASE WHEN qrs.quality_score >= 85 THEN 100 
                 WHEN qrs.quality_score >= 70 THEN 75
                 WHEN qrs.quality_score >= 55 THEN 50
                 ELSE 25 END) as avg_quality
      FROM lesson_plans lp
      LEFT JOIN quality_rubric_scores qrs ON lp.id = qrs.plan_id
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

      res.json(trends);
    } catch (error) {
      next(error);
    }
  },
);
```

---

## 9.5 Frontend Statistics Visualization

### Dashboard Components

```typescript
// front-end/src/features/dashboard/AdminDashboard.tsx

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axiosInstance.get('/api/admin/stats/overview');
        setStats(response.data);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="dashboard-grid">
      {/* KPI Cards */}
      <StatsCard
        title="معلمون نشطون اليوم"
        value={stats?.actuals.active_today}
        trend={+5}
        icon="users"
      />

      <StatsCard
        title="خطط تم توليدها (الشهر)"
        value={stats?.total_plans}
        trend={+12}
        icon="document"
      />

      <StatsCard
        title="متوسط جودة الخطط"
        value={`${stats?.system_avg_quality_score}/100`}
        trend={+2}
        icon="star"
      />

      <StatsCard
        title="معدل الاحتفاظ (7 أيام)"
        value={`${stats?.retention_d7}%`}
        trend={-3}
        icon="trending"
      />

      {/* Quality Distribution Pie Chart */}
      <QualityDistributionChart data={stats?.quality_distribution} />

      {/* Trends Line Chart */}
      <TrendsChart />

      {/* Top Teachers Table */}
      <TopTeachersTable />
    </div>
  );
};
```

---

## Summary

The Statistics System:

- **Quality Scoring:** 40% first-pass reliability + 35% structure + 25% content depth
- **Multi-Level:** Teacher-level + system-level metrics
- **Time Periods:** Daily, weekly, monthly, yearly aggregations
- **Visualization:** Charts, trends, distributions
- **Admin Dashboard:** Real-time view of system health
- **Teacher Dashboard:** Personal performance metrics and insights

---

**Next:** Read **10_OFFLINE_SUPPORT.md** for offline/sync architecture.
