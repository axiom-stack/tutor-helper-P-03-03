# 14. REAL-WORLD SCENARIOS & END-TO-END WORKFLOWS

## 14.1 Teacher's First Day

### Scenario: Fatima, Grade 3 Science Teacher

```
Morning - 8:30 AM (Yemen Time)

Fatima is a dedicated elementary school teacher in Sana'a, Yemen.
She has 2 classes of 30 students each.
She wants to prepare lesson plans efficiently instead of spending hours writing.

Timeline:

08:30 → Login
  └─ Action: Opens tutor-helper.com
  └─ Credentials: email: fatima.ali@school.ye / password
  └─ Result: Dashboard shows "لا توجد خطط بعد" (No plans yet)

08:35 → Create First Lesson Plan
  └─ Navigate: Click "إنشاء خطة درس جديدة"
  └─ Fill form:
     • الدرس: "دورة الماء في الطبيعة"
     • المحتوى: "تدوير الماء، التبخر، التكثف، الهطول..."
     • المادة: "العلوم"
     • الصف: "الثالث الابتدائي"
     • المدة: 45 دقيقة
     • نوع الخطة: "تقليدية"

  └─ Click: "توليد الخطة الذكية"

08:35 → Groq LLM Generation
  Backend processing (user doesn't see):
  ├─ Prompt 1: "Create draft lesson plan..."
  ├─ Response: Objectives, activities, assessment, timing
  ├─ Prompt 2: "Refine for pedagogical compliance..."
  ├─ Response: Improved plan with better objectives
  └─ Validation: Check all rules (Bloom, time dist, etc.)

08:50 → View Generated Plan (15 seconds later)
  Landing page shows:
  ├─ Title: "دورة الماء في الطبيعة"
  ├─ Quality Score: ⭐ 82/100 (جيد جداً)
  ├─ Sections:
  │  ├─ الأهداف التعليمية (4 objectives)
  │  ├─ الأنشطة (8 activities, each 5-7 min)
  │  ├─ التقييم (3 assessment methods)
  │  └─ التوزيع الزمني (Intro: 4min, Main: 27min, Closing: 9min, Assess: 5min)
  │
  └─ Action buttons:
     ├─ تحسين (Refine: "Make objectives more specific")
     ├─ تحميل PDF (Download as PDF)
     ├─ تحميل Word (Download as DOCX)
     └─ ✏️  تعديل (Edit plan)

08:52 → Use Plan in Class
  ├─ Open plan on tablet
  ├─ Activities loaded in order with timing
  ├─ Click each activity for full description
  ├─ Timer starts when activity begins
  └─ Students engage with interactive learning activities

10:00 → End of Lesson
  └─ Plan marked complete
  └─ Feedback prompted: "كيف كانت جودة الخطة؟" (Rate quality)
  └─ Fatima rates: 4/5 stars "الأنشطة رائعة لكن التقييم سريع جداً"

10:05 → Export & Share
  └─ Click "تحميل PDF"
  └─ Gets: "دورة_الماء.pdf" (Beautiful 3-page plan)
  └─ Shares with colleague via email or WhatsApp
  └─ Colleague can just use or import to their account

Impact:
✅ Fatima saved 1-2 hours of manual planning
✅ Plans now based on pedagogy (not just content)
✅ Can prepare multiple lessons in one day
✅ Colleague appreciates high-quality starting point
```

---

## 14.2 Teacher Refinement Workflow

### Scenario: Ahmed Reviews & Improves Plan

```
Next Day - 14:30 (Yemen Time)

Ahmed reviewed Fatima's plan.
He thinks the objectives need to be more specific.
He uses the Smart Refinement feature.

Timeline:

14:30 → View Plan
  └─ Opens "دورة الماء في الطبيعة" plan
  └─ Reviews objectives section
  └─ Thinks: "هذه الأهداف عامة جداً، أريد نتائج أكثر تحديداً"

14:35 → Request Refinement
  └─ Hovers over "الأهداف التعليمية" section
  └─ Clicks: "اطلب تحسين الذكي"
  └─ Dialog opens with fields:
     • ماذا تريد تحسينه؟ (What to improve?)
        "جعل الأهداف أكثر تحديداً وقابلية للقياس"
     • هل تريد خيارات بديلة؟ (Alternatives?)
        ✓ Yes
     └─ Click: "اطلب التحسين"

14:35 → Backend Processing (LLM Refinement)
  ├─ Load current objectives
  ├─ Build Prompt: "Improve these objectives to be more specific..."
  ├─ Call Groq LLM
  └─ Generate 3 alternative versions

14:40 → Compare & Approve (5 seconds later)
  UI shows side-by-side:

  Current (Left):              →  Proposed (Right):
  ├─ هدف 1:                      ├─ هدف 1:
  │  "يفهم الطالب دورة الماء"    │  "يصف الطالب مراحل دورة الماء الأربع
  │                             │   (التبخر، التكثف، الهطول، التجميع)
  │                             │   بفهم كامل وتطبيق على الطبيعة"
  │
  └─ [Alternatives dropdown]
     • Option A: "يصنف..."
     • Option B: "لتجريبية يقارن..."

  Action buttons:
  ├─ ✅ Approve
  ├─ ❌ Reject
  └─ 👁️  Choose Alternative

14:42 → Approve Refinement
  └─ Click: "موافقة على التحسين"

14:42 → Backend Processing
  ├─ Create new ArtifactRevision (revision #2)
  ├─ Merge refined objectives with original plan
  ├─ Update plan's updated_at timestamp
  └─ Record in refinement_requests table

14:43 → Plan Updated
  Toast notification: "✅ تم تحسين الخطة بنجاح"

  Plan now shows:
  ├─ Quality Score: 88/100 (was 82)
  ├─ Updated objectives (more specific)
  └─ "Revision 2" indicator

14:45 → Share Improved Version
  └─ Download new PDF
  └─ Share with all teachers
  └─ Everyone benefits from refinement

Success Metrics:
✅ Refinement saved Ahmed 30+ minutes
✅ Collaborative improvement without code editing
✅ Quality improved: 82→88
✅ Teachers can now iteratively improve content
```

---

## 14.3 Exam Creation for Mid-Term Assessment

### Scenario: Noor Creates Math Exam

```
Week before Exam - Wednesday

Noor (Grade 6 Math teacher) needs to create mid-term exam.
He wants exam to test different Bloom levels fairly.
He has 25 minutes before class ends.

Timeline:

14:00 → Create Exam
  └─ Navigate: "إنشاء اختبار"
  └─ Select lessons:
     • Lesson 1-5: "الأعداد الصحيحة"
     • Lesson 6-8: "العمليات الحسابية"
     • Lesson 9-12: "المعادلات البسيطة"

  └─ Specify exam structure:
     • إجمالي الأسئلة: 20
     • الدرجات الكلية: 100
     • نوع الأسئلة: متعدد الخيارات (MC) + صح/خطأ + اكمل الفراغ

14:05 → Blueprint Calculation
  Backend processes:
  ├─ Count objectives per Bloom level (from lessons)
  ├─ Calculate Specification Table:
  │
  │  ┌─────────────┬────────┬────────┬────────┐
  │  │ Bloom|Domain│ معرفي  │ وجداني │ مهاري  │
  │  ├─────────────┼────────┼────────┼────────┤
  │  │ Remember    │ 3 Qs   │ 1 Q    │ -      │
  │  │ Understand  │ 3 Qs   │ 2 Qs   │ 2 Qs   │
  │  │ Apply       │ 2 Qs   │ 1 Q    │ 3 Qs   │
  │  │ Analyze     │ 1 Q    │ 1 Q    │ 1 Q    │
  │  └─────────────┴────────┴────────┴────────┘
  │
  ├─ Total: 20 questions
  └─ Marks distribution: 5 marks per question

14:06 → Question Generation
  ├─ For each cell in blueprint:
  │  ├─ Load lesson content
  │  ├─ Call Groq: Generate question for (Bloom level, Domain)
  │  ├─ Validate: Correct options, no errors
  │  └─ Store in database
  │
  └─ Total: 20 LLM calls (parallel batched)
      Time: ~12 seconds

14:20 → Exam Preview
  Toast: "✅ تم توليد الاختبار بنجاح!"

  Shows:
  ├─ Title: "اختبار النصف الأول - الرياضيات"
  ├─ Statistics:
  │  • Total Q: 20
  │  • Total marks: 100 (5/Q)
  │  • Bloom distribution:
  │    - Remember: 4Q (20%)
  │    - Understand: 7Q (35%)
  │    - Apply: 6Q (30%)
  │    - Analyze: 3Q (15%)
  │
  ├─ Preview Questions:
  │  Q1: "أي من الأعداد التالية موجب؟ (Multiple Choice)"
  │  Q2: "العدد -5 أكبر من 0 (صح/خطأ)"
  │  Q3: "5 + (-8) = ___ (اكمل الفراغ)"
  │
  └─ Action buttons:
     ├─ اطبع كـ PDF (Print as PDF - questions only)
     ├─ اطبع إجابات (Print answer key - teacher only)
     ├─ حمّل Word (Download for editing)
     └─ استخدم مباشرة (Use immediately)

14:25 → Export & Prepare
  └─ Click: "اطبع كـ PDF"
  └─ Gets: exam-math-semester1.pdf (4 pages)
  └─ Review questions (making sure they make sense)
  └─ Print 30 copies
  └─ Give to students tomorrow

14:30 → Class Ends
  Success:
  ✅ Exam created in 30 minutes (vs normal 2-3 hours)
  ✅ Balanced across Bloom levels
  ✅ All questions aligned to curriculum
  ✅ Students get fair assessment
```

---

## 14.4 Offline Scenario

### Scenario: Mariam Works Without Internet

```
Thursday Morning (Internet Down in Sana'a)

Mariam arrives at school.
No internet (common 2-3x/week in Sana'a).
But she still needs to prepare lesson for 10:00 class.

Timeline:

08:45 → Start Day (No Internet)
  App shows: ⚠️ "أنت غير متصل" (You're offline)

  But all previously downloaded material available:
  ├─ ✅ Past lesson plans (all 45 of them)
  ├─ ✅ Draft plans (in edit state)
  ├─ ✅ Assignments
  └─ ❌ Cannot generate new (requires LLM)

08:50 → Use Cached Plan
  └─ View "خصائص النبات" (Plant characteristics)
  └─ Plan fully visible offline
  └─ All content loaded from IndexedDB
  └─ Display: "هذه نسخة محلية" (This is a local copy)

08:55 → Edit Cached Plan
  └─ Update timing (5 min → 8 min)
  └─ Add note to first activity
  └─ Save changes locally
  └─ Status: "📝 معلق للمزامنة" (Pending sync)

09:00 → Teach Class
  └─ Display lesson on tablet (offline version works)
  └─ Students engage with activities
  └─ Timer works (local)
  └─ No connectivity needed

10:00 → Try New Generation (Internet Still Down)
  └─ Open "إنشاء خطة جديدة"
  └─ Fill form
  └─ Click "توليد الخطة"
  └─ Error: ❌ "يتطلب اتصالاً بالإنترنت لتوليد الخطة"
  └─ Option: "خطط أثناء الاتصال لاحقاً" (Plan later when online)

12:00 → Internet Returns
  App detects: "تم استعادة الاتصال" (Connection restored)

  Sync automatically starts:
  ├─ Send edits to server
  ├─ Save as Revision #2 on server
  ├─ Display: "✅ تمت المزامنة بنجاح"

12:05 → Continue Working
  └─ Now can generate new plans again
  └─ All offline changes synced
  └─ Can continue where left off

Success:
✅ Mariam could work without internet
✅ Edits preserved and synced
✅ Offline/online transition seamless
✅ No data lost
```

---

## 14.5 Admin Analytics Dashboard

### Scenario: Director Monitors System

```
Monday Morning (weekly check-in)

The school director checks system health via /admin dashboard.

Dashboard Overview:

Active Teachers (This Week):
  ├─ 12 active teachers
  ├─ 4 new this week
  ├─ 1 teacher churned
  └─ Retention: 92%

Content Production:
  ├─ Plans generated: 87 (this week)
  ├─ Average quality: 78/100
  ├─ Quality distribution:
  │  ├─ Excellent (85+): 40%
  │  ├─ Good (70-84): 35%
  │  ├─ Acceptable (55-69): 20%
  │  └─ Needs improve (<55): 5%

LLM Performance:
  ├─ Generation success rate: 98.5%
  ├─ First-pass rate: 91%
  ├─ Refinement adoption: 43%
  └─ Avg generation time: 12 seconds

Top Teachers (By Plans):
  1. Fatima Ali: 23 plans
  2. Ahmed Mohamed: 19 plans
  3. Noor Hassan: 18 plans

Trends (Last 30 Days):
  └─ Graph shows upward trend
     Plans/day: 2 → 6
     Teachers: 4 → 12

System Health:
  ├─ Server uptime: 99.8%
  ├─ API errors: 0.3%
  ├─ Avg response: 1.2s
  ├─ Database: 1.2GB / 3GB
  └─ Status: ✅ Healthy

Actions Director Can Take:
  ├─ View individual teacher stats
  ├─ Export usage report (PDF/Excel)
  ├─ Send message to all teachers
  └─ Configure system settings

Impact:
✅ Director can see system adoption
✅ Data shows positive momentum
✅ Teachers engaged and productive
✅ System performing reliably
```

---

## Summary: End-to-End Impact

| Stage          | Time      | Teacher Experience | System Support |
| -------------- | --------- | ------------------ | -------------- |
| **Login**      | <5s       | Smooth             | Auth works     |
| **Plan Gen**   | 15s       | Fast, impressive   | LLM pipeline   |
| **Refinement** | 5s        | Interactive        | AI suggestions |
| **Export**     | <2s       | Beautiful docs     | PDF/Word gen   |
| **Offline**    | Seamless  | No interruption    | IndexedDB sync |
| **Admin**      | Real-time | Transparency       | Analytics      |

**Overall:** Teachers focus on pedagogy; system handles complexity.

---

**Next:** Read **15_TECH_STACK.md** for technology summary.
