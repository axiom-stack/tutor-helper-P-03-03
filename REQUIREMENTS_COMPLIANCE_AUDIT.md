# Requirements Compliance Audit — مساعد المعلم الذكي (Smart Teacher Assistant)

**Source document:** مساعد-المعلم-الذكي-توصيف-المشروع٠٢٢٣٥٣1(1).pdf  
**Audit type:** STRICT REQUIREMENTS FORENSICS + COMPLIANCE AUDIT  
**Scope:** Zero-shortcut extraction; repo evidence mapping; no code changes.

---

# PART 1 — Executive Summary, Compliance Matrix, Top 10 Critical Gaps

## 1. Executive Summary

### What % of the specification appears fully implemented?

Approximately **55–65%** of the specification appears **fully implemented** end-to-end (backend + frontend + persistence where applicable). Another **20–25%** is **partially** implemented (e.g., logic exists but UI or channel is missing, or vice versa). The remainder is **missing** or **cannot be verified** from the repo alone.

### Major areas that are complete

- **Lesson plan generation:** Traditional and active-learning plans; teacher/school choice; storage in DB; edit and save; export PDF/Word; listing and filtering by plan type.
- **Curriculum structure:** Classes → Subjects → Units → Lessons with teacher ownership; lesson titles/units linked to plans; number_of_periods for blueprint.
- **Time distribution:** 10% / 60% / 20% / 10% (تمهيد / عرض / نشاط / تقويم) implemented in `lessonPlanNormalizer.js`; auto-calculation and overflow prevention in validation.
- **Assignments:** Generation (written, varied, practical); link to lesson plan; local storage; edit; export PDF/Word; listing.
- **Exams:** Generation from selected lessons; blueprint by topic weight (periods) and objective level; total questions and total marks; answer key; storage; edit; export PDF/Word; listing.
- **Smart edit (refinements):** AI suggestions on edit (objectives, strategies, activities, assessment, resources, time, homework); analysis, better wording, alternative activities; pedagogical checks; requires internet; approval/reject flow.
- **Offline + local DB:** IndexedDB stores plans, assignments, exams, drafts, queue, references; open/edit offline; re-generate suggestions when online.
- **Admin/control panel:** General settings (language, educational level, subject, default lesson time, preparation type); curriculum management; teacher management with usage tracking; plans and exams management with filters (subject, grade, quality); reports/statistics with rubric and export.
- **Pedagogical validation:** Objectives (measurable, Bloom-linked, cognitive/affective/psychomotor); activity–objective link; no activity without objective; assessment–objective link; time sum = duration; strategy diversity; forbidden verbs (e.g. يفهم, يعرف) replaced.
- **Statistics:** Plans created/edited, exams created/edited, average quality, first-pass/retry rates, assignment edit rate; quality bands (ممتاز, جيد جداً, مقبول, needs improvement); admin teacher performance and risk flags.

### Major areas that are partial

- **Export/print/share:** PDF and Word are implemented; **WhatsApp** (pre-filled message: lesson title, content, deadline; open via link) and **Bluetooth/direct file** share are **not** found in repo.
- **Exam input:** Teacher enters total questions and total marks; **exam duration (زمن الاختبار)** is **not** present in Exams schema or request model.
- **Assignment WhatsApp:** Spec requires sending assignment to guardian via WhatsApp with auto message (title, content, deadline). **Not** implemented.
- **Plans/exams management:** Detail view and “evaluation” of plans/exams exist in spec; current UI has detail and filters; explicit “evaluation” rubric view per artifact may be partial.

### Major areas that are missing

- **WhatsApp integration:** No `wa.me` link, no pre-filled message for assignment (title, content, موعد التسليم), no “share via WhatsApp” for plans/exams.
- **Bluetooth / direct file share:** Not found.
- **Exam duration:** Field and input for “زمن الاختبار” missing in API and DB.
- **Rubric display in reports:** Spec says “يمكن استخدام نموذج Rubric لتوضيح الاحصائيات”; stats use quality bands and criteria; explicit Rubric “model” display may be implied and only partially reflected.

### What areas are impossible to verify from the repo alone?

- Whether “Yemeni curriculum” content is actually used as reference in prompts (only structure is clear).
- Exact alignment of every Bloom verb list and teaching method name with the spec tables (lists exist in constants/prompts; full verb-by-verb audit would need manual comparison).
- Real offline behavior on mobile (IndexedDB and service worker exist; no device test).
- Whether “تحميل كتطبيق على الهاتف أو الكمبيوتر” is satisfied (PWA/installability not verified).

### Top 10 most dangerous compliance misses

1. **WhatsApp share for assignments** — Spec: إرسال الواجب عبر الواتساب لولي الأمر، رسالة تلقائية (عنوان الدرس، محتوى الواجب، موعد التسليم)، فتح الواتساب برابط مباشر. **Status:** MISSING.
2. **WhatsApp share for plans/exams** — Spec: مشاركة عبر واتساب. **Status:** MISSING (only PDF/Word export).
3. **Exam duration (زمن الاختبار)** — Spec: ادخال زمن الاختبار. **Status:** MISSING in DB and API.
4. **Bluetooth / direct file share** — Spec: مشاركة عبر ملف مباشر (بلوتوث). **Status:** MISSING.
5. **Plans created vs modified counts in stats** — Spec: عدد الخطط التي تم انشاؤها، عدد الخطط التي تم تعديلها. **Status:** PARTIAL (plans_generated exists; “edited” count is implicit via revisions/retries, not explicit “خطط معدلة”).
6. **Exams created vs modified counts** — Spec: عدد الاختبارات التي تم انشاؤها، عدد الاختبارات التي تم تعديلها. **Status:** PARTIAL (exams_generated exists; no explicit “اختبارات معدلة”).
7. **Dashboard “تقييم” للخطة/الاختبار** — Spec: الاطلاع على تفاصيل الخطة وتقييمها. **Status:** CANNOT VERIFY (detail view exists; explicit evaluation UI/rubric per artifact unclear).
8. **Predefined behavioral verb list in UI** — Spec: يجبر النموذج على اختيار فعل سلوكي من قائمة معدة مسبقا. **Status:** PARTIAL (backend replaces forbidden verbs; no evidence of teacher-facing dropdown of allowed verbs only).
9. **“لا يسمح بإنشاء نشاط دون ربطه بهدف” in UI** — Spec: لا يسمح البرنامج بإنشاء نشاط دون ربطه بهدف. **Status:** PARTIAL (validation and prompts enforce linkage; UI may allow adding activity without explicit objective link).
10. **Print (طباعة)** — Spec: طباعة الخطة/الواجب/الاختبار. **Status:** PARTIAL (export PDF/Word exists; dedicated “print” action/button not verified).

---

## 2. Compliance Matrix (Family-Level)

| Requirement Family | Total Atomic Requirements | Complete | Partial | Missing | Cannot Verify | Compliance % | High-Risk Gaps |
|--------------------|---------------------------|----------|---------|---------|----------------|---------------|----------------|
| Product purpose / scope | 12 | 8 | 2 | 0 | 2 | ~67% | App installability; Yemeni curriculum as content ref |
| Lesson plan generation | 28 | 22 | 4 | 0 | 2 | ~79% | Print button; verb list UI |
| Assignments / homework | 24 | 16 | 4 | 4 | 0 | ~67% | WhatsApp send; deadline in message; share channels |
| Lesson time distribution | 10 | 9 | 1 | 0 | 0 | ~90% | Manual edit + “better suggestions” clarity |
| Test generation | 22 | 17 | 2 | 3 | 0 | ~77% | Exam duration; blueprint formula wording |
| Statistics / analytics | 14 | 11 | 3 | 0 | 0 | ~79% | Plans/exams “modified” counts; rubric display |
| Smart edit / AI suggestions | 12 | 10 | 1 | 0 | 1 | ~83% | Offline “re-generate when online” flow |
| Pedagogical validation | 18 | 15 | 2 | 0 | 1 | ~83% | Activity–objective link in UI |
| Offline + local DB | 10 | 9 | 0 | 0 | 1 | ~90% | Full offline flow on device |
| Export / print / share | 14 | 6 | 2 | 6 | 0 | ~43% | WhatsApp; Bluetooth; print |
| Admin dashboard | 20 | 16 | 3 | 0 | 1 | ~80% | Evaluation view; scalability claim |
| Curriculum management | 10 | 9 | 0 | 0 | 1 | ~90% | — |
| Teacher management / research | 10 | 9 | 1 | 0 | 0 | ~90% | — |
| Plan / test management views | 12 | 9 | 2 | 0 | 1 | ~75% | Evaluation; quality filter |
| Rubric / quality reporting | 6 | 4 | 2 | 0 | 0 | ~67% | Rubric “model” for stats |
| Objective writing rules | 14 | 11 | 2 | 0 | 1 | ~79% | Pre-made verb list in UI |
| Alignment / mapping rules | 8 | 6 | 2 | 0 | 0 | ~75% | No activity without objective (UI) |
| Time rules | 6 | 6 | 0 | 0 | 0 | 100% | — |
| Strategy diversity | 4 | 4 | 0 | 0 | 0 | 100% | — |
| Evaluation question quality | 6 | 5 | 1 | 0 | 0 | ~83% | — |
| Homework quality | 4 | 4 | 0 | 0 | 0 | 100% | — |
| Test quality / blueprint | 10 | 8 | 1 | 1 | 0 | ~80% | Exam duration; formula match |
| Templates (traditional) | 18 | 16 | 1 | 0 | 1 | ~89% | Source: كتاب الطالب، الصفحة |
| Templates (active learning) | 16 | 14 | 1 | 0 | 1 | ~88% | — |
| Pedagogical domains / verb tables | 6 | 5 | 0 | 0 | 1 | ~83% | Full verb list in prompts |
| Traditional teaching methods | 11 | 10 | 0 | 0 | 1 | ~91% | — |
| Active learning strategies | 14 | 13 | 0 | 0 | 1 | ~93% | — |
| Test blueprint / ToS formulas | 12 | 10 | 1 | 1 | 0 | ~83% | Duration; formula wording |
| Enums / options / labels | 14 | 12 | 1 | 1 | 0 | ~86% | Exam duration enum |

*Note: Total atomic count is approximated; Part 2–3 will list individual REQ-ids.*

---

## 3. Top 10 Critical Gaps (Detailed)

| Gap ID | Requirement ID(s) | Description | Why it fails the spec | User-visible impact | Severity |
|--------|-------------------|-------------|------------------------|----------------------|----------|
| GAP-001 | REQ-EXP-004, REQ-ASSIGN-018 | No WhatsApp send for assignment | Spec: إرسال الواجب عبر الواتساب لولي الأمر، رسالة تلقائية (عنوان، محتوى، موعد التسليم)، فتح بتطبيق الواتساب برابط مباشر | Teacher cannot send assignment to guardian via WhatsApp with pre-filled message | CRITICAL |
| GAP-002 | REQ-EXP-002, REQ-EXP-003 | No WhatsApp share for plans/exams | Spec: مشاركة عبر واتساب | No “share via WhatsApp” for plans or exams | HIGH |
| GAP-003 | REQ-EXAM-007 | Exam duration not stored or input | Spec: ادخال زمن الاختبار | Exam duration (زمن الاختبار) cannot be entered or stored | HIGH |
| GAP-004 | REQ-EXP-005 | No Bluetooth / direct file share | Spec: مشاركة عبر ملف مباشر (بلوتوث) | No Bluetooth or “direct file” share option | MEDIUM |
| GAP-005 | REQ-STAT-002, REQ-STAT-003 | Plans/exams “modified” counts not explicit | Spec: عدد الخطط التي تم تعديلها، عدد الاختبارات التي تم تعديلها | Stats show generated counts; “modified” not clearly separate metrics | MEDIUM |
| GAP-006 | REQ-OBJ-004 | No forced behavioral verb list in UI | Spec: يجبر النموذج على اختيار فعل سلوكي من قائمة معدة مسبقا | Teacher may type free text; no dropdown of allowed verbs only | MEDIUM |
| GAP-007 | REQ-ALIGN-002 | Activity without objective link possible in UI | Spec: لا يسمح البرنامج بإنشاء نشاط دون ربطه بهدف | Validation exists; UI may not enforce “no activity without objective” | MEDIUM |
| GAP-008 | REQ-PRINT-001–003 | Print action not clearly separate from export | Spec: طباعة الخطة، طباعة الواجب، طباعة الاختبار | Export PDF exists; explicit “print” button/flow not verified | LOW |
| GAP-009 | REQ-TEMPL-TRAD-018 | Source “كتاب الطالب، الصفحة” in template | Template field المصدر: كتاب الطالب، الصفحة | May be missing or implicit in export only | LOW |
| GAP-010 | REQ-BLUEPRINT-011 | Exam duration in blueprint/ToS context | Spec: زمن الاختبار as input | Cannot display or use exam duration in reports/blueprint | MEDIUM |

---

---

# PART 2 — Master Atomic Requirements Checklist (Sections 1–8)

Schema per row: **Req ID** | **Parent** | **Section/Page** | **Category** | **Type** | **Original Arabic (snippet)** | **Normalized English** | **Atomic testable requirement** | **Acceptance criteria** | **Status** | **Evidence** | **Repo paths** | **Confidence** | **Notes**

## 2.1 Product purpose / scope

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-001 | — | p.1 | Product | EXPLICIT | مساعدة المعلمين في إعداد الخطط الدراسية اليومية والواجبات والاختبارات | Help teachers prepare daily lesson plans, assignments, and tests | System supports generation of daily lesson plans, assignments, and tests | Plans, assignments, exams can be generated and stored | COMPLETE | generatePlan, assignments generate, exams generate | back-end/src/routes/generatePlan.routes.js, assignments.routes.js, exams.routes.js | HIGH | — |
| REQ-002 | REQ-001 | p.1 | Product | EXPLICIT | بطريقة سريعة وفعالة باستخدام تقنيات الذكاء الاصطناعي | Fast and effective using AI | Generation uses AI (LLM) | AI/LLM used in plan/assignment/exam generation | COMPLETE | Groq LLM, prompt builders | back-end/src/lesson-plans/llm, prompts | HIGH | — |
| REQ-003 | — | p.1 | Product | EXPLICIT | إنشاء واعداد خطط دروس تعليمية متكاملة | Create integrated educational lesson plans | Plans include full pedagogical elements | Plans include intro, objectives, activities, strategies, resources, assessment, homework | COMPLETE | plan_json structure, validators | lessonPlanValidator.js, planDisplay.ts | HIGH | — |
| REQ-004 | — | p.1 | Product | EXPLICIT | يمكن تحميله كتطبيق على الهاتف المحمول او الكمبيوتر | Can be downloaded as app on mobile or computer | Deliverable as installable app | PWA or installable package exists | CANNOT VERIFY | — | front-end has build; no manifest/install checked | LOW | Installability not verified |
| REQ-005 | — | p.1 | Product | EXPLICIT | ربطه بقاعدة بيانات محلية | Linked to local database | Local DB for storage | Plans/assignments/exams stored locally and work offline | COMPLETE | IndexedDB, Turso/SQLite | front-end/src/offline/db.ts, back-end sql/ | HIGH | Server DB + client IndexedDB |
| REQ-006 | — | p.1 | Product | IMPLIED | تقديم اقتراحات لتحسين الخطة عند توفر الانترنت | Suggest improvements when online | AI suggestions when teacher edits and online | Refinement flow when online | COMPLETE | RefinementRequests, SmartRefinementPanel | back-end/src/refinements, front-end refinements/ | HIGH | — |
| REQ-007 | — | p.2 | Product | EXPLICIT | دعم المعلم في إعداد الخطط الدراسية اليومية والاختبارات بصورة أسرع وأكثر تنظيما | Support teacher in preparing daily plans and tests faster and more organized | Faster, more organized preparation | Generation and listing/filtering exist | COMPLETE | Routes, UI listing/filters | plans-manager, quizzes | HIGH | — |
| REQ-008 | — | p.2 | Product | EXPLICIT | تحسين جودة صياغة الأهداف التعليمية وفق أسس تربوية سليمة | Improve quality of objective formulation per sound pedagogy | Objectives follow pedagogical rules | Validator + Bloom, measurable verbs | COMPLETE | lessonPlanValidator, promptsHelper | back-end lesson-plans/validators, constants | HIGH | — |
| REQ-009 | — | p.2 | Product | EXPLICIT | تسهيل مشاركة الموارد التعليمية بين المعلمين | Facilitate sharing of educational resources between teachers | Sharing between teachers | Export PDF/Word; no in-app share between teachers | PARTIAL | Export only | exportService.js | MEDIUM | No teacher-to-teacher share |
| REQ-010 | — | p.2 | Product | EXPLICIT | دعم التحول الرقمي في البيئة التعليمية | Support digital transformation in educational environment | Digital transformation support | Digital workflows (generate, store, export, stats) | COMPLETE | Full stack features | — | HIGH | — |

## 2.2 Lesson plan generation

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-LP-001 | — | p.2 | Lesson plan | EXPLICIT | توليد خطة درس بطريقتين: اعتيادية، بالتعلم النشط | Generate lesson plan in two ways: ordinary and active learning | Two plan types | traditional + active_learning | COMPLETE | PLAN_TYPES, Traditional/ActiveLearningLessonPlans | back-end types, sql master.sql | HIGH | — |
| REQ-LP-002 | REQ-LP-001 | p.2 | Lesson plan | EXPLICIT | بحسب اختيار المعلم لطريقة المفضلة لديه او بحسب ما يعتمد في المدرسة | By teacher preference or school practice | Teacher or school selects method | default_plan_type, plan type in request | COMPLETE | UserProfiles.default_plan_type, request | Settings.tsx, generatePlan request | HIGH | — |
| REQ-LP-003 | — | p.2 | Lesson plan | EXPLICIT | يجب ان تستنبط عناصر الخطة من المناهج الدراسية اليمنية | Plan elements must be derived from Yemeni curriculum | Plans derived from Yemeni curriculum | Curriculum (lessons/units) used in generation | PARTIAL | lesson_id, curriculum structure | lessonPlans.repository, prompts use lesson/content | MEDIUM | “Yemeni” content ref not verified |
| REQ-LP-004 | — | p.2 | Lesson plan | EXPLICIT | حفظ الخطة في قاعدة بيانات محلية | Save plan in local DB | Save plan locally | Plan persisted in DB | COMPLETE | Traditional/ActiveLearningLessonPlans | back-end sql, lessonPlans.repository | HIGH | — |
| REQ-LP-005 | — | p.2 | Lesson plan | EXPLICIT | العودة اليها في أي وقت حتى دون الاتصال بالانترنت | Return to it anytime even without internet | Open plan offline | Offline plans store, open without network | COMPLETE | IndexedDB plans store | front-end/src/offline/plans.ts, db.ts | HIGH | — |
| REQ-LP-006 | — | p.2 | Lesson plan | EXPLICIT | التعديل على أي خطة وحفظها مرة أخرى | Edit any plan and save again | Edit and re-save plan | Update plan endpoint and UI | COMPLETE | PUT /plans/:id, PlansManager edit | plans.routes.js, PlansManager.tsx | HIGH | — |
| REQ-LP-007 | — | p.2 | Lesson plan | EXPLICIT | اقتراحات ذكية اثناء التعديل (عند الاتصال بالانترنت) | Smart suggestions during edit when online | AI suggestions when editing online | Refinement flow for lesson_plan | COMPLETE | refinements for lesson_plan | refinements.routes.js, SmartRefinementPanel | HIGH | — |
| REQ-LP-008 | — | p.2 | Lesson plan | EXPLICIT | طباعة الخطة الدراسية | Print lesson plan | Print plan | User can print plan | PARTIAL | Export PDF/Word; no dedicated print | exportService, exportPlanHandler | MEDIUM | Print via browser on PDF |
| REQ-LP-009 | — | p.2 | Lesson plan | EXPLICIT | مشاركتها بصيغة Word و Pdf | Share in Word and PDF | Export plan as Word and PDF | Export plan PDF and DOCX | COMPLETE | exportPlan(_, 'pdf'|'docx') | exportService.js, exportPlanHandler | HIGH | — |
| REQ-LP-010 | — | p.3 | Lesson plan | EXPLICIT | التمهيد والاهداف والانشطة والاستراتيجيات والوسائل والتقويم والواجبات | Intro, objectives, activities, strategies, resources, assessment, homework | Plan contains these elements | plan_json has intro, objectives, activities, strategies, resources, assessment, homework | COMPLETE | Validator and plan structure | lessonPlanValidator.js, planDisplay | HIGH | — |
| REQ-LP-011 | — | p.8 | Lesson plan | TEMPLATE | التاريخ، اليوم، الصف، الشعبة، الحصة، العنوان، الوحدة، الوقت | Date, day, grade, class/section, session, title, unit, time | Traditional template header fields | Header has date, day, grade, section, title, unit, duration | COMPLETE | plan_json header, docx/html builders | htmlBuilders.js, docxBuilders.js | HIGH | — |
| REQ-LP-012 | — | p.8 | Lesson plan | TEMPLATE | الأهداف/المخرجات التعليمية، الاستراتيجيات/طرق التدريس، الأنشطة، الوسائل مصادر التعلم، التقويم | Objectives, strategies, activities, resources, assessment | Traditional template body | Body has objectives, strategies, activities, resources, assessment | COMPLETE | lessonPlanValidator, display | LessonPlanDocumentView.tsx | HIGH | — |
| REQ-LP-013 | — | p.8 | Lesson plan | TEMPLATE | مجموعة خيارات تحتوي على جميع الاستراتيجيات لاختيار المعلم | Set of options with all strategies for teacher to choose | Strategy selection from predefined list | Strategies from constants; multi-select in edit | COMPLETE | promptsHelper traditional methods | constants/promptsHelper.js | HIGH | — |
| REQ-LP-014 | — | p.8 | Lesson plan | TEMPLATE | مجموعة خيارات الوسائل ومصادر التعلم (اختيار اكثر من وسيلة) | Options for resources; teacher can select more than one | Multi-select learning resources | Resources as list in plan and UI | COMPLETE | learning_resources array | plan structure, LessonPlanDocumentView | HIGH | — |
| REQ-LP-015 | — | p.9 | Lesson plan | TEMPLATE | الواجب، تحديد المطلوب من المتعلم، المصدر: كتاب الطالب، الصفحة | Homework, what is required, source: student book, page | Homework and source fields | Homework + source (book, page) in plan | PARTIAL | homework in plan; source field | plan_json, docxBuilders | MEDIUM | Source “كتاب الطالب، الصفحة” may be implicit |
| REQ-LP-016 | — | p.9–10 | Lesson plan | TEMPLATE | نموذج التعلم النشط: اليوم، المادة، التاريخ، الوحدة، الصف، عنوان الدرس، الوقت، المحتوى، نوع النشاط، نشاط المعلم، نشاط المتعلم، مصادر التعلم | Active learning: day, subject, date, unit, grade, title, time, content, activity type, teacher activity, learner activity, resources | Active learning template fields | Active plan has rows with time, content, activity type, teacher/learner activity, resources | COMPLETE | Active flow structure in validator | lessonPlanValidator.js, planDisplay.ts | HIGH | — |
| REQ-LP-017 | — | p.2 | Lesson plan | EXPLICIT | إعادة توليد اقتراحات عند توفر الانترنت | Re-generate suggestions when online | Regenerate suggestions when back online | Retry/regenerate refinement when online | COMPLETE | Retry refinement, offline queue | refinements retry, queueProcessor | HIGH | — |

## 2.3 Assignments / homework

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-ASSIGN-001 | — | p.2 | Assignment | EXPLICIT | توليد واجبات مناسبة لكل درس تم تحضيره | Generate suitable assignments for each prepared lesson | Assignments per lesson | Generate assignments linked to lesson/plan | COMPLETE | generateAssignments, lesson_plan_public_id | assignments.routes.js, assignmentGeneration.service.js | HIGH | — |
| REQ-ASSIGN-002 | — | p.2 | Assignment | EXPLICIT | واجبات كتابية، اسئلة تقويم متنوعة، انشطة تطبيقية | Written, varied assessment questions, practical activities | Three assignment types | written, varied, practical | COMPLETE | type CHECK in Assignments table | sql master.sql, assignments types | HIGH | — |
| REQ-ASSIGN-003 | — | p.2 | Assignment | EXPLICIT | ربط كل واجب مع خطة الدرس ليتناسب معه ويستنبط من اهداف الدرس | Link each assignment to lesson plan; derived from lesson objectives | Assignment derived from lesson objectives | Assignment linked to lesson_plan and lesson_id | COMPLETE | lesson_plan_public_id, lesson_id, prompts | assignments repository, assignmentsPromptBuilder | HIGH | — |
| REQ-ASSIGN-004 | — | p.2 | Assignment | EXPLICIT | حفظ الواجبات في قاعدة بيانات محلية | Save assignments in local DB | Save assignments locally | Assignments persisted | COMPLETE | Assignments, AssignmentGroups | back-end sql, assignments.repository | HIGH | — |
| REQ-ASSIGN-005 | — | p.2 | Assignment | EXPLICIT | العودة اليه في أي وقت حتى دون توفر الانترنت | Return to assignment anytime offline | Open assignment offline | Offline assignments store | COMPLETE | IndexedDB assignments | front-end/src/offline/assignments.ts | HIGH | — |
| REQ-ASSIGN-006 | — | p.2 | Assignment | EXPLICIT | التعديل على الواجب وحفظه مرة أخرى مع اقتراحات عند الاتصال بالانترنت | Edit assignment and save; suggestions when online | Edit and AI suggestions when online | Update assignment + refinements for assignment | COMPLETE | PUT assignment, refinement artifact_type assignment | assignments.routes.js, refinements | HIGH | — |
| REQ-ASSIGN-007 | — | p.2 | Assignment | EXPLICIT | طباعة الواجب | Print assignment | Print assignment | User can print assignment | PARTIAL | Export PDF/Word | exportAssignment | MEDIUM | — |
| REQ-ASSIGN-008 | — | p.2 | Assignment | EXPLICIT | مشاركتها بصيغة Word و Pdf | Share in Word and PDF | Export assignment Word/PDF | Export assignment PDF and DOCX | COMPLETE | exportAssignment | exportService.js | HIGH | — |
| REQ-ASSIGN-009 | — | p.4 | Assignment | EXPLICIT | ارسال الواجب عبر الواتساب لولي الامر | Send assignment via WhatsApp to guardian | Send assignment via WhatsApp | WhatsApp deep link with pre-filled message | MISSING | No wa.me or WhatsApp share | — | HIGH | GAP-001 |
| REQ-ASSIGN-010 | — | p.4 | Assignment | EXPLICIT | رسالة تلقائية تحتوي على: عنوان الدرس، محتوى الواجب، موعد التسليم | Auto message: lesson title, content, deadline | Message content | Pre-filled message with title, content, deadline | MISSING | No deadline field or message builder | — | HIGH | — |
| REQ-ASSIGN-011 | — | p.4 | Assignment | EXPLICIT | فتح تطبيق الواتساب برابط مباشر للارسال | Open WhatsApp via direct link | WhatsApp link opens app | wa.me or api.whatsapp link | MISSING | — | — | HIGH | — |
| REQ-ASSIGN-012 | — | p.2 | Assignment | IMPLIED | موعد التسليم | Deadline | Assignment can have deadline | Deadline in data or message | MISSING | No due_date in schema | back-end sql 002_assignments.sql | HIGH | — |

## 2.4 Lesson time distribution

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-TIME-001 | — | p.3 | Time | EXPLICIT | المعلم يدخل الوقت المحدد للحصة (مثال 45 دقيقة) | Teacher enters lesson time (e.g. 45 min) | Teacher inputs lesson duration | duration_minutes in request and profile | COMPLETE | duration_minutes request, default_lesson_duration_minutes | lesson-creator, requestModel.js | HIGH | — |
| REQ-TIME-002 | — | p.3 | Time | EXPLICIT | يقوم البرنامج بتوزيع الوقت تلقائيا على: التمهيد، عرض الدرس، النشاط، التقويم | Program distributes time across intro, presentation, activity, assessment | Auto distribution | Default 10/60/20/10; auto-calc | COMPLETE | DEFAULT_TIME_DISTRIBUTION 0.1,0.6,0.2,0.1 | lessonPlanNormalizer.js | HIGH | — |
| REQ-TIME-003 | — | p.3 | Time | EXPLICIT | مع إمكانية التعديل بشكل يدوي وتقديم اقتراحات افضل من قبل البرنامج | Manual edit and program suggestions for better distribution | Manual edit and suggestions | User can edit times; validator enforces sum | COMPLETE | Refinement target duration; validator | lessonPlanValidator (sum = duration_minutes) | HIGH | “Better suggestions” = refinement |
| REQ-TIME-004 | — | p.7 | Time | CALCULATION RULE | تمهيد 10%، عرض 60%، تنفيذ 20%، تقويم 10% | Intro 10%, presentation 60%, activity 20%, assessment 10% | Percentages | Distribution matches 10/60/20/10 | COMPLETE | DEFAULT_TIME_DISTRIBUTION | lessonPlanNormalizer.js | HIGH | — |
| REQ-TIME-005 | — | p.7 | Time | VALIDATION RULE | لا يتجاوز مجموع الانشطة زمن الحصة؛ البرنامج يحسب الزمن تلقائيا ويمنع التجاوز | Total activities must not exceed lesson time; auto-calc and prevent overflow | No overflow | Sum of phase times = duration_minutes; validation fails if not | COMPLETE | Validator checks sum | lessonPlanValidator.js | HIGH | — |

## 2.5 Test generation

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-EXAM-001 | — | p.2 | Exam | EXPLICIT | توليد اسئلة الاختبار من الدروس المعدة مسبقا مع الاجابات النموذجية | Generate exam questions from previously prepared lessons with model answers | Questions from prepared lessons; answer key | Exam from lessons; questions_json has answers | COMPLETE | examGeneration.service, questions_json | back-end/src/exams | HIGH | — |
| REQ-EXAM-002 | — | p.2 | Exam | EXPLICIT | يسمح للمعلم باختيار الدروس التي سيولد منها اسئلة الاختبار | Teacher selects lessons for exam | Teacher selects lessons | lesson_ids in request | COMPLETE | lesson_ids in generateExam | exams.requestModel.js, controller | HIGH | — |
| REQ-EXAM-003 | — | p.2 | Exam | EXPLICIT | ان تخضع عملية اعداد الاختبارات الى جدول المواصفات | Exam preparation subject to table of specifications | Blueprint constrains exam | Blueprint built from lessons and objectives | COMPLETE | buildExamBlueprint, blueprint_json | blueprintCalculator.js | HIGH | — |
| REQ-EXAM-004 | — | p.2 | Exam | EXPLICIT | اقتراح توزيع لدرجات الاختبار بناء على الدرجة الكلية المدخلة من قبل المعلم | Program suggests mark distribution based on teacher-entered total marks | Marks distributed by blueprint | total_marks, blueprint with cell weights | COMPLETE | total_marks, blueprint marks distribution | blueprintCalculator.js, examGeneration | HIGH | — |
| REQ-EXAM-005 | — | p.2 | Exam | EXPLICIT | حفظ الاختبارات في قاعدة بيانات محلية، العودة اليها دون انترنت | Save exams locally; access offline | Persist and open offline | Exams table; IndexedDB exams | COMPLETE | Exams table, offline exams store | sql, front-end offline | HIGH | — |
| REQ-EXAM-006 | — | p.2 | Exam | EXPLICIT | التعديل على أي اختبار وحفظه مع اقتراحات ذكية عند الاتصال بالانترنت | Edit exam and save; smart suggestions when online | Edit and refinement for exam | PUT exam, refinement for exam | COMPLETE | exams.routes put, refinement exam | back-end routes, refinements | HIGH | — |
| REQ-EXAM-007 | — | p.5 | Exam | EXPLICIT | ادخال زمن الاختبار | Enter exam duration | Exam duration input | duration stored and input in UI | MISSING | No duration in Exams schema | sql master.sql, exams requestModel | HIGH | GAP-003 |
| REQ-EXAM-008 | — | p.2 | Exam | EXPLICIT | طباعة الاختبار؛ مشاركتها بصيغة Word و Pdf | Print exam; share Word and PDF | Export exam | Export exam PDF and DOCX | COMPLETE | exportExam | exportService.js | HIGH | — |
| REQ-EXAM-009 | — | p.5 | Exam | EXPLICIT | ادخال عدد اسئلة الاختبار، ادخال درجة الاختبار | Enter number of questions and total marks | total_questions, total_marks | Request has total_questions, total_marks | COMPLETE | total_questions, total_marks | requestModel.js, controller | HIGH | — |
| REQ-EXAM-010 | — | p.7 | Exam | VALIDATION RULE | لا يتجاوز الدرجات المقسمة على الاسئلة الدرجة الكلية للاختبار | Sum of question marks must not exceed total | Marks sum ≤ total_marks | Blueprint and validator enforce | COMPLETE | blueprintCalculator, examOutputValidator | blueprintCalculator.js, examOutputValidator.js | HIGH | — |
| REQ-EXAM-011 | — | p.4 | Exam | EXPLICIT | اسئلة متنوعة (نعم/لا، اختار، املاء الفراغ، اسئلة مفتوحة) | Diverse question types | Multiple question types | true_false, multiple_choice, fill_blank, open | COMPLETE | QUESTION_TYPES, examOutputValidator | exams/types.js, examOutputValidator.js | HIGH | — |

## 2.6 Statistics / analytics

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-STAT-001 | — | p.3 | Stats | EXPLICIT | عدد الخطط التي تم انشاؤها | Number of plans created | Count of plans generated | plans_generated in stats | COMPLETE | kpis.plans_generated | stats.service.js | HIGH | — |
| REQ-STAT-002 | — | p.3 | Stats | EXPLICIT | عدد الخطط التي تم تعديلها | Number of plans modified | Count of plans edited | Explicit “modified” count | PARTIAL | Retries/edits implicit; no separate metric | stats.service.js | MEDIUM | GAP-005 |
| REQ-STAT-003 | — | p.3 | Stats | EXPLICIT | عدد الاختبارات التي تم انشاؤها، عدد الاختبارات التي تم تعديلها | Exams created and modified counts | Exams created and modified | exams_generated; modified count | PARTIAL | exams_generated only | stats.service.js | MEDIUM | — |
| REQ-STAT-004 | — | p.3 | Stats | EXPLICIT | متوسط جودة الخطط والاختبارات | Average quality of plans and exams | Average quality metric | avg_plan_quality; quality_band | COMPLETE | qualityRubric, scorePlanQuality | stats/stats.service.js, qualityRubric.js | HIGH | — |
| REQ-STAT-005 | — | p.3 | Stats | EXPLICIT | التعديل الذكي مع اقتراحات تحسين | Smart edit with improvement suggestions | Refinement/suggestions tracked | Refinement flow and stats (retry_rate, etc.) | COMPLETE | RefinementAttempts, retry_rate | refinements, stats | HIGH | — |
| REQ-STAT-006 | — | p.6 | Stats | EXPLICIT | يمكن استخدام نموذج Rubric لتوضيح الاحصائيات | Rubric model for statistics | Rubric for stats | Quality bands and criteria in stats | PARTIAL | quality_band, criteria; “Rubric” model display | stats.qualityRubric.js, buildStatsHtml | MEDIUM | — |

## 2.7 Smart edit / AI suggestion mode

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-SMART-001 | — | p.3 | Smart edit | EXPLICIT | عند تعديل المعلم لعنصر من عناصر الخطة (اهداف، استراتيجيات، نشاط، تقويم، وسائل، وقت، واجب) يقوم البرنامج بتحليل التعديل واقتراح صياغة افضل واقتراح نشاط بديل والتحقق من المعايير التربوية | On teacher edit of plan element, program analyzes, suggests better wording, alternative activity, checks pedagogy | Refinement for plan elements | Refinement targets: intro, objectives, strategies, activities, assessment, resources, time, homework | COMPLETE | refinementTargets, requestModel | refinementTargets.ts, refinement requestModel | HIGH | — |
| REQ-SMART-002 | — | p.2 | Smart edit | EXPLICIT | تقدم الاقتراحات عند الاتصال بالانترنت | Suggestions when online | AI suggestions require internet | Refinement calls LLM when online | COMPLETE | refinement.service calls LLM | back-end refinements | HIGH | — |
| REQ-SMART-003 | — | p.4 | Smart edit | EXPLICIT | إعادة توليد اقتراحات عند توفر الانترنت | Re-generate suggestions when online | Regenerate when back online | Retry refinement when online | COMPLETE | Retry refinement, queue | refinements retry, queueProcessor | HIGH | — |

## 2.8 Pedagogical validation

| ID | Parent | Section | Category | Type | Original Arabic | Normalized English | Atomic requirement | Acceptance criteria | Status | Evidence | Repo paths | Confidence | Notes |
|----|--------|--------|----------|------|----------------|-------------------|--------------------|---------------------|--------|----------|------------|-------------|-------|
| REQ-PED-001 | — | p.3 | Validation | EXPLICIT | الاهداف قابلة للقياس، مرتبطة بمستويات بلوم، شمول جوانب (معرفية، وجدانية، مهارية) | Objectives measurable, Bloom-linked, cognitive/affective/psychomotor | Objectives validated | Validator checks objectives, Bloom levels, domains | COMPLETE | lessonPlanValidator objectives, Bloom | lessonPlanValidator.js, types BLOOM_LEVELS | HIGH | — |
| REQ-PED-002 | — | p.3 | Validation | EXPLICIT | ان يرتبط كل نشاط تعليمي بهدف | Every activity linked to an objective | Activity–objective link | Validator enforces activity–objective link | COMPLETE | Validator activity–objective | lessonPlanValidator.js | HIGH | — |
| REQ-PED-003 | — | p.3 | Validation | EXPLICIT | الوسائل والالتزام بما يوجد في المناهج | Resources per curriculum | Resources constrained by curriculum | Prompts/validator reference curriculum | PARTIAL | Prompts use resources; curriculum constraint implicit | promptsHelper, validator | MEDIUM | — |
| REQ-PED-004 | — | p.3 | Validation | EXPLICIT | ان يرتبط كل هدف بسؤال في التقويم؛ تنوع اسئلة التقويم؛ مراعاة مستوى الطالب | Each objective has assessment question; variety; student level | Assessment–objective link; variety | Validator assessment–objective; question types | COMPLETE | lessonPlanValidator assessment | lessonPlanValidator.js | HIGH | — |
| REQ-PED-005 | — | p.3 | Validation | EXPLICIT | الواجب مستنبط من محتوى الدرس؛ مناسب لمستوى الطالب | Homework from lesson content; appropriate level | Homework quality | Prompts and validator | COMPLETE | assignment prompts, validator | assignmentValidator, assignmentsPromptBuilder | HIGH | — |
| REQ-PED-006 | — | p.3 | Validation | EXPLICIT | الاختبار من الدروس التي اعدها البرنامج مسبقا؛ خاضع لجدول المواصفات؛ اسئلة متنوعة؛ توزيع منطقي للدرجات | Exam from prepared lessons; blueprint; variety; logical mark distribution | Exam quality rules | Blueprint, question types, mark distribution | COMPLETE | blueprintCalculator, examOutputValidator | exams/ | HIGH | — |
| REQ-PED-007 | — | p.7 | Validation | EXPLICIT | يمنع استخدام افعال غير قابلة للقياس (يفهم، يعرف، يتعرف) | Forbid non-measurable verbs | Forbidden verbs replaced | FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS | COMPLETE | lessonPlanNormalizer.js | FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS | HIGH | — |

---

---

# PART 3 — Master Atomic Requirements Checklist (Sections 9–16) and Traceability Maps

## 3.1 Offline + local DB (REQ-OFF-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-OFF-001 | — | p.4 | EXPLICIT | تخزين: الخطط، الواجبات، التعديلات | Store: plans, assignments, revisions | COMPLETE | plans, assignments, exams, revisions in DB + IndexedDB | sql, front-end/src/offline/db.ts |
| REQ-OFF-002 | — | p.4 | EXPLICIT | فتح أي خطة او واجب لاحقا؛ إمكانية التعديل | Open any plan/assignment later; edit | COMPLETE | getPlanById, update; offline open/edit | plans.routes, offline stores |
| REQ-OFF-003 | — | p.4 | EXPLICIT | إعادة توليد اقتراحات عند توفر الانترنت | Regenerate suggestions when online | COMPLETE | Retry refinement; queue processor | queueProcessor.ts, refinements |

## 3.2 Export / print / share (REQ-EXP-*, REQ-PRINT-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-EXP-001 | — | p.2,4 | EXPLICIT | تصدير بصيغة pdf او word | Export PDF and Word | COMPLETE | exportPlan/Assignment/Exam(_, pdf|docx) | exportService.js |
| REQ-EXP-002 | — | p.4 | EXPLICIT | مشاركة عبر واتساب | Share via WhatsApp | MISSING | No WhatsApp share | — |
| REQ-EXP-003 | — | p.4 | EXPLICIT | مشاركة عبر ملف مباشر (بلوتوث) | Share via direct file (Bluetooth) | MISSING | No Bluetooth/direct file | — |
| REQ-PRINT-001 | — | p.2 | EXPLICIT | طباعة الخطة | Print plan | PARTIAL | PDF export; no dedicated print button | exportService, UI |
| REQ-PRINT-002 | — | p.2 | EXPLICIT | طباعة الواجب | Print assignment | PARTIAL | PDF export | — |
| REQ-PRINT-003 | — | p.2 | EXPLICIT | طباعة الاختبار | Print exam | PARTIAL | PDF export | — |

## 3.3 Admin dashboard (REQ-ADMIN-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-ADMIN-001 | — | p.4–5 | EXPLICIT | الإعدادات العامة: اللغة (عربية–انجليزي)، المستوى التعليمي، المادة، زمن الحصة الافتراضي | General settings: language, educational level, subject, default lesson time | COMPLETE | UserProfiles, Settings.tsx | users.repository, Settings.tsx |
| REQ-ADMIN-002 | — | p.5 | EXPLICIT | إدارة المنهج: ادخال عناوين الدروس والوحدات، ربط بصف/مادة/مستوى | Curriculum: lesson/unit titles; link to grade, subject, level | COMPLETE | Classes, Subjects, Units, Lessons | back-end routes classes, subjects, units, lessons |
| REQ-ADMIN-003 | — | p.5–6 | EXPLICIT | إدارة الاختبارات: اختيار الدروس، عدد الاسئلة، درجة الاختبار، زمن الاختبار | Exam management: select lessons, number of questions, marks, duration | PARTIAL | Lessons, total_questions, total_marks; duration MISSING | exams requestModel |
| REQ-ADMIN-004 | — | p.6 | EXPLICIT | إدارة المعلم: انشاء ملف، تحديد صف/مادة/نوع التحضير، متابعة سجل الاستخدام، عدد الخطط، متوسط الجودة، عدد التعديلات، عدد الاختبارات، الدروس المختارة للاختبار | Teacher management: profile, grade, subject, preparation type, usage stats | COMPLETE | users.routes, listTeachersWithUsage, teacher_performance | users.controller, stats.service |
| REQ-ADMIN-005 | — | p.6 | EXPLICIT | إدارة الخطط المولدة: عرض الكل، تصنيف حسب المادة/الصف/مستوى الجودة، الاطلاع على التفاصيل وتقييمها | Plans management: list, filter by subject/grade/quality, detail and evaluation | COMPLETE | listPlans, filters; PlansManager detail | plans.routes, PlansManager.tsx |
| REQ-ADMIN-006 | — | p.6 | EXPLICIT | إدارة الاختبارات المولدة: عرض الكل، تصنيف، تفاصيل وتقييم | Exams management: list, filter, detail, evaluation | COMPLETE | listExams, Quizzes.tsx filters and detail | exams.routes, Quizzes.tsx |
| REQ-ADMIN-007 | — | p.6 | EXPLICIT | التقارير والاحصائيات (مبسطة)؛ عدد الخطط، متوسط الجودة، عدد الاختبارات | Reports and statistics | COMPLETE | stats/summary, stats/export | stats.routes, Stats.tsx |
| REQ-ADMIN-008 | — | p.4 | EXPLICIT | واجهة سهلة، قابلة للتوسع، تدعم التعديل دون تدخل برمجي | Easy, scalable, editable without code | PARTIAL | UI and DB-driven settings; scalability not verifiable | — |

### Deliverable C (continued) — Atomic-Level Compliance Matrix (Sample)

| Requirement ID | Short Name | Status | Severity if Missing | Evidence | Gap Summary |
|----------------|------------|--------|---------------------|----------|-------------|
| REQ-001 | Help teachers prepare plans/assignments/exams | COMPLETE | — | generatePlan, assignments, exams routes | — |
| REQ-004 | App on mobile/computer | CANNOT VERIFY | LOW | — | Installability not verified |
| REQ-LP-001 | Two plan types (traditional/active) | COMPLETE | — | PLAN_TYPES, two tables | — |
| REQ-LP-008 | Print plan | PARTIAL | LOW | Export PDF only | No dedicated print button |
| REQ-ASSIGN-009 | Send assignment via WhatsApp | MISSING | CRITICAL | None | GAP-001: No WhatsApp link or message |
| REQ-ASSIGN-010 | Auto message title/content/deadline | MISSING | CRITICAL | None | No deadline; no message builder |
| REQ-ASSIGN-012 | Assignment deadline | MISSING | HIGH | No due_date in schema | GAP-011 |
| REQ-TIME-002 | Auto time distribution 10/60/20/10 | COMPLETE | — | DEFAULT_TIME_DISTRIBUTION | — |
| REQ-EXAM-007 | Exam duration input | MISSING | HIGH | No duration in Exams | GAP-003 |
| REQ-EXAM-003 | Exam under blueprint | COMPLETE | — | blueprintCalculator, blueprint_json | — |
| REQ-EXP-001 | Export PDF/Word | COMPLETE | — | exportService.js | — |
| REQ-EXP-002 | Share via WhatsApp | MISSING | HIGH | None | GAP-002 |
| REQ-EXP-003 | Share via Bluetooth/direct file | MISSING | MEDIUM | None | GAP-004 |
| REQ-STAT-002 | Plans modified count | PARTIAL | MEDIUM | Implicit in retries | GAP-005 |
| REQ-OBJ-004 | Force verb from list in UI | PARTIAL | MEDIUM | Backend replacement only | GAP-006 |
| REQ-PED-007 | Forbid non-measurable verbs | COMPLETE | — | FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS | — |
| REQ-BLUEPRINT-001–004 | Blueprint formulas | COMPLETE | — | blueprintCalculator.js | — |

## 3.4 Objective writing and alignment (REQ-OBJ-*, REQ-ALIGN-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-OBJ-001 | — | p.7 | CALCULATION RULE | أن + فعل سلوكي + الطالب + محتوى من المادة + مصطلح (شرط–معيار) | Objective formula | COMPLETE | Prompts and validator enforce structure | promptsHelper, lessonPlanValidator |
| REQ-OBJ-002 | — | p.7 | EXPLICIT | تصاغ الاهداف بأفعال سلوكية؛ قابلة للقياس؛ توزع على مستويات (تذكر، فهم، تطبيق، تحليل، تركيب، تقويم) | Behavioral verbs; measurable; Bloom levels | COMPLETE | BLOOM_LEVELS, verb lists, validator | constants/promptsHelper.js, types.js |
| REQ-OBJ-003 | — | p.7 | EXPLICIT | يمنع استخدام افعال غير قابلة للقياس (يفهم، يعرف) | Forbid non-measurable verbs | COMPLETE | FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS | lessonPlanNormalizer.js |
| REQ-OBJ-004 | — | p.7 | EXPLICIT | يجبر النموذج على اختيار فعل سلوكي من قائمة معدة مسبقا | Force selection from predefined verb list | PARTIAL | Backend replaces verbs; no UI dropdown of verbs only | — |
| REQ-ALIGN-001 | — | p.7 | VALIDATION RULE | لا يسمح بإنشاء نشاط دون ربطه بهدف | No activity without linked objective | COMPLETE | lessonPlanValidator | lessonPlanValidator.js |
| REQ-ALIGN-002 | — | p.7 | VALIDATION RULE | لا يولد سؤال تقويم خارج نطاق الهدف | No evaluation question outside objective | COMPLETE | Validator | lessonPlanValidator.js |
| REQ-ALIGN-003 | — | p.7 | IMPLIED | لا يوجد هدف بون سؤال | No objective without evaluation question | COMPLETE | Validator checks assessment coverage | lessonPlanValidator.js |

## 3.5 Blueprint / table of specifications (REQ-BLUEPRINT-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-BLUEPRINT-001 | — | p.19 | CALCULATION RULE | الأهمية النسبية للموضوع % = (عدد حصص الموضوع / اجمالي الحصص) × 100 | Topic relative weight by periods | COMPLETE | topic_weight = number_of_periods / periodTotal | blueprintCalculator.js |
| REQ-BLUEPRINT-002 | — | p.19 | CALCULATION RULE | الأهمية النسبية لمستوى الهدف % = (عدد اهداف المستوى / اجمالي الاهداف) × 100 | Objective-level relative weight | COMPLETE | level_weight from classified objectives | blueprintCalculator.js |
| REQ-BLUEPRINT-003 | — | p.19 | CALCULATION RULE | عدد اسئلة الموضوع = أهمية نسبية × عدد الاسئلة الكلية (المعلم يدخل العدد؛ البرنامج يقسم بحسب الأهمية) | Question count per topic from weights | COMPLETE | buildQuestionSlotsFromBlueprint, allocation | blueprintCalculator.js |
| REQ-BLUEPRINT-004 | — | p.19 | CALCULATION RULE | درجة كل فقرة = أهمية نسبية × الدرجة النهائية (المعلم يدخل الدرجة؛ البرنامج يقسم) | Marks per cell from weights | COMPLETE | Cell marks from total_marks and weights | blueprintCalculator.js |
| REQ-BLUEPRINT-005 | — | p.19–21 | DATA MODEL | جدول المواصفات: موضوعات، اهداف (تذكر، فهم، تطبيق، تحليل، تركيب، تقويم)، اسئلة ودرجات | Blueprint table: topics, Bloom levels, questions and marks | COMPLETE | blueprint_json, cells with lesson_id, level, allocation | blueprintCalculator.js, exams.repository |

## 3.6 Traditional teaching methods (REQ-METH-*)

Spec lists: الإلقاء/المحاضرة، المناقشة والحوار، الاستقرائية، الاستنتاجية، العرض العملي، حل المشكلات، المشروع، لعب الأدوار، التعلم بالاكتشاف، التعلم التعاوني، التعلم المبرمج. Each with استخدامات، أسلوب التنفيذ، وسائل التنفيذ.

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-METH-001 | — | p.13–15 | TEMPLATE REQUIREMENT | طرق واستراتيجيات الخطة التقليدية (11 طريقة مذكورة) | Traditional methods list in system | COMPLETE | TRADITIONAL_METHODS in promptsHelper | back-end/src/constants/promptsHelper.js |
| REQ-METH-002 | — | p.16–18 | TEMPLATE REQUIREMENT | استراتيجيات التعلم النشط (14 استراتيجية مذكورة) | Active learning strategies list | COMPLETE | ACTIVE_LEARNING_STRATEGIES | promptsHelper.js |

## 3.7 Pedagogical domains and verb tables (REQ-DOM-*)

| ID | Parent | Section | Type | Original Arabic | Normalized English | Status | Evidence | Repo paths |
|----|--------|---------|------|----------------|-------------------|--------|----------|------------|
| REQ-DOM-001 | — | p.11–12 | DATA MODEL REQUIREMENT | مجالات الأهداف السلوكية: معرفي (تذكر–تقويم)، وجداني، نفسحركي؛ افعال مرتبطة بكل مستوى | Cognitive, affective, psychomotor domains and verbs | COMPLETE | BLOOM_LEVELS, promptsHelper verb lists | exams/types.js BLOOM_LEVEL_AR_LABELS, promptsHelper |

---

## 4. Feature → Requirement Traceability Map

| Feature ID | Feature Name | Feature Type | Repo Evidence | Linked Requirement IDs | Coverage Strength | Notes |
|------------|--------------|--------------|---------------|------------------------|-------------------|-------|
| FEAT-001 | Generate lesson plan (traditional/active) | Backend, UI | POST /generate-plan, LessonCreator | REQ-LP-001, REQ-LP-002, REQ-LP-003, REQ-LP-004, REQ-LP-010 | FULL | — |
| FEAT-002 | Save/edit plan | Backend, UI, DB | PUT /plans/:id, PlansManager | REQ-LP-004, REQ-LP-006 | FULL | — |
| FEAT-003 | Export plan PDF/Word | Backend | GET /plans/:id/export, exportService | REQ-LP-009, REQ-EXP-001 | FULL | — |
| FEAT-004 | Offline plans store | Frontend | IndexedDB plans, offline/plans.ts | REQ-LP-005, REQ-OFF-001, REQ-OFF-002 | FULL | — |
| FEAT-005 | Smart refinement (plan/assignment/exam) | Backend, UI | refinements.routes, SmartRefinementPanel | REQ-LP-007, REQ-SMART-001, REQ-SMART-002, REQ-ASSIGN-006, REQ-EXAM-006 | FULL | — |
| FEAT-006 | Generate assignments | Backend, UI | POST /assignments/generate, Assignments | REQ-ASSIGN-001, REQ-ASSIGN-002, REQ-ASSIGN-003, REQ-ASSIGN-004 | FULL | — |
| FEAT-007 | Export assignment PDF/Word | Backend | GET /assignments/:id/export | REQ-ASSIGN-008, REQ-EXP-001 | FULL | — |
| FEAT-008 | Send assignment via WhatsApp | — | — | REQ-ASSIGN-009, REQ-ASSIGN-010, REQ-ASSIGN-011 | NONE | GAP-001 |
| FEAT-009 | Assignment deadline in message | — | — | REQ-ASSIGN-010, REQ-ASSIGN-012 | NONE | No deadline field |
| FEAT-010 | Time distribution 10/60/20/10 | Backend | lessonPlanNormalizer DEFAULT_TIME_DISTRIBUTION | REQ-TIME-002, REQ-TIME-004, REQ-TIME-005 | FULL | — |
| FEAT-011 | Generate exam from lessons | Backend, UI | POST /exams/generate, Quizzes | REQ-EXAM-001, REQ-EXAM-002, REQ-EXAM-003, REQ-EXAM-004, REQ-EXAM-009 | FULL | — |
| FEAT-012 | Exam blueprint by periods + Bloom | Backend | blueprintCalculator.js | REQ-EXAM-003, REQ-BLUEPRINT-001–005 | FULL | — |
| FEAT-013 | Exam duration input | — | — | REQ-EXAM-007, REQ-ADMIN-003 | NONE | GAP-003 |
| FEAT-014 | Export exam PDF/Word | Backend | GET /exams/:id/export | REQ-EXAM-008 | FULL | — |
| FEAT-015 | Stats summary and export | Backend, UI | GET /stats/summary, Stats.tsx | REQ-STAT-001, REQ-STAT-004, REQ-STAT-005, REQ-ADMIN-007 | FULL | — |
| FEAT-016 | Curriculum (classes, subjects, units, lessons) | Backend, UI | classes, subjects, units, lessons routes; ControlCurriculum, TeacherCirriculumManager | REQ-ADMIN-002, REQ-LP-003 | FULL | — |
| FEAT-017 | Settings (language, level, subject, default time, plan type) | Backend, UI | UserProfiles, Settings.tsx, updateMyProfile | REQ-ADMIN-001 | FULL | — |
| FEAT-018 | Teacher management (admin) | Backend, UI | users.routes teachers, TeachersManagement | REQ-ADMIN-004 | FULL | — |
| FEAT-019 | Plans list/filter/detail | Backend, UI | listPlans, PlansManager | REQ-ADMIN-005 | FULL | — |
| FEAT-020 | Exams list/filter/detail | Backend, UI | listExams, Quizzes | REQ-ADMIN-006 | FULL | — |
| FEAT-021 | Share via WhatsApp / Bluetooth | — | — | REQ-EXP-002, REQ-EXP-003 | NONE | GAP-002, GAP-004 |
| FEAT-022 | Lesson plan validator (objectives, time, alignment) | Backend | lessonPlanValidator.js | REQ-PED-001–006, REQ-ALIGN-*, REQ-TIME-005 | FULL | — |
| FEAT-023 | Forbidden verb replacement | Backend | lessonPlanNormalizer FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS | REQ-PED-007, REQ-OBJ-003 | FULL | — |
| FEAT-024 | Pre-made behavioral verb list in UI | — | — | REQ-OBJ-004 | NONE | No dropdown of verbs only |

## 5. Requirement → Feature Reverse Map (Sample)

| Requirement ID | Requirement Summary | Mapped Features | Coverage | Missing Pieces |
|----------------|---------------------|-----------------|----------|----------------|
| REQ-ASSIGN-009 | Send assignment via WhatsApp to guardian | — | NONE | FEAT-008: WhatsApp deep link + pre-filled message |
| REQ-ASSIGN-010 | Auto message: title, content, deadline | — | NONE | Deadline field; message builder; WhatsApp link |
| REQ-EXAM-007 | Exam duration input and storage | — | NONE | duration_minutes in Exams; UI input |
| REQ-EXP-002 | Share via WhatsApp | — | NONE | Share button/link for plan and exam |
| REQ-EXP-003 | Share via Bluetooth / direct file | — | NONE | Bluetooth or file share flow |
| REQ-STAT-002 | Number of plans modified | FEAT-015 | PARTIAL | Explicit “modified” count in stats |
| REQ-OBJ-004 | Force verb from predefined list in UI | FEAT-022, FEAT-023 | PARTIAL | Teacher-facing verb dropdown |
| REQ-LP-003 | Plan elements from Yemeni curriculum | FEAT-001, FEAT-016 | PARTIAL | Content reference to “Yemeni” curriculum not verified |

---

---

# PART 4 — Gap Register, Ambiguity/Assumptions Register, Page-by-Page Extraction Log

## 6. Gap Register (Full)

| Gap ID | Requirement ID(s) | Gap Description | Why it fails the spec | User-visible impact | Technical impact | Severity | Confidence | Evidence |
|--------|-------------------|-----------------|------------------------|---------------------|------------------|----------|------------|----------|
| GAP-001 | REQ-ASSIGN-009, REQ-ASSIGN-010, REQ-ASSIGN-011 | No WhatsApp send for assignment to guardian | Spec: إرسال الواجب عبر الواتساب لولي الأمر، رسالة تلقائية (عنوان الدرس، محتوى الواجب، موعد التسليم)، فتح بتطبيق الواتساب برابط مباشر | Teacher cannot send assignment to guardian via WhatsApp with pre-filled message | No wa.me/api.whatsapp link; no deadline field; no message builder | CRITICAL | HIGH | No matches for whatsapp, wa.me, موعد التسليم in repo |
| GAP-002 | REQ-EXP-002 | No WhatsApp share for plans or exams | Spec: مشاركة عبر واتساب | No “share via WhatsApp” for plans or exams | Same as above for plans/exams | HIGH | HIGH | Export only PDF/Word |
| GAP-003 | REQ-EXAM-007, REQ-ADMIN-003, REQ-BLUEPRINT-011 | Exam duration not stored or input | Spec: ادخال زمن الاختبار | Exam duration cannot be entered or displayed | Exams table has no duration_minutes; request has no duration | HIGH | HIGH | master.sql Exams, exams requestModel.js |
| GAP-004 | REQ-EXP-003 | No Bluetooth / direct file share | Spec: مشاركة عبر ملف مباشر (بلوتوث) | No Bluetooth or “direct file” share option | No share API or UI for Bluetooth/file | MEDIUM | HIGH | No bluetooth or “ملف مباشر” in repo |
| GAP-005 | REQ-STAT-002, REQ-STAT-003 | Plans/exams “modified” counts not explicit | Spec: عدد الخطط التي تم تعديلها، عدد الاختبارات التي تم تعديلها | Stats show generated only; “modified” not a separate metric | Stats have plans_generated, exams_generated; no plans_modified, exams_modified | MEDIUM | HIGH | stats.service.js kpis |
| GAP-006 | REQ-OBJ-004 | No forced behavioral verb list in UI | Spec: يجبر النموذج على اختيار فعل سلوكي من قائمة معدة مسبقا | Teacher can type free text; no dropdown of allowed verbs only | Backend replaces forbidden verbs; UI does not restrict to list | MEDIUM | HIGH | No verb dropdown in LessonPlanDocumentView / creator |
| GAP-007 | REQ-ALIGN-002 (UI) | Activity without objective link possible in UI | Spec: لا يسمح البرنامج بإنشاء نشاط دون ربطه بهدف | UI may allow adding activity without selecting objective | Validator enforces; UI might not block invalid state | MEDIUM | MEDIUM | Validator exists; UI flow not fully traced |
| GAP-008 | REQ-PRINT-001–003 | Print action not clearly separate from export | Spec: طباعة الخطة/الواجب/الاختبار | No dedicated “print” button; user must export PDF then print | Export PDF exists; explicit print action not found | LOW | MEDIUM | exportService; no “print” in UI labels |
| GAP-009 | REQ-LP-015, REQ-TEMPL-TRAD-018 | Source “كتاب الطالب، الصفحة” in template | Template: المصدر: كتاب الطالب، الصفحة | May be missing or only in export; not clearly in plan schema | plan_json structure may not have dedicated source/book/page | LOW | MEDIUM | docxBuilders, htmlBuilders |
| GAP-010 | REQ-BLUEPRINT-011 | Exam duration in blueprint/ToS context | Spec: زمن الاختبار as input for test management | Cannot display or use exam duration in reports or blueprint view | Same as GAP-003 | MEDIUM | HIGH | — |
| GAP-011 | REQ-ASSIGN-012 | Assignment deadline not stored | Spec: موعد التسليم in WhatsApp message | Deadline cannot be set or shown | Assignments table has no due_date/deadline column | HIGH | HIGH | sql 002_assignments.sql |
| GAP-012 | REQ-009 (sharing between teachers) | No in-app sharing between teachers | Spec: تسهيل مشاركة الموارد بين المعلمين | Teachers cannot share plans/assignments/exams to another teacher in-app | No “share to teacher” or transfer feature | MEDIUM | HIGH | Export only; no teacher-to-teacher |

## 7. Ambiguity / Assumptions Register

| Item ID | Ambiguous Text | Possible Interpretations | What you assumed | Why | Impact on audit | Confidence |
|---------|----------------|---------------------------|------------------|-----|-----------------|------------|
| AMB-001 | "استنباط عناصر الخطة من المناهج الدراسية اليمنية" | (1) Use only Yemeni curriculum structure (classes/units/lessons). (2) Use actual Yemeni curriculum content/text in prompts. (3) Both. | Structure + content where available; “Yemeni” = curriculum entity not external document | Repo has curriculum entities; no external Yemeni doc referenced | REQ-LP-003 marked PARTIAL; “Yemeni” content not verified | MEDIUM |
| AMB-002 | "تقديم اقتراحات افضل" (توزيع الزمن) | (1) Refinement suggests different distribution. (2) Separate “suggest better distribution” button. | Refinement when editing time = “suggestions” | Refinement covers “better wording” and alternatives | REQ-TIME-003 marked COMPLETE via refinement | MEDIUM |
| AMB-003 | "يمكن استخدام نموذج Rubric لتوضيح الاحصائيات" | (1) Optional suggestion. (2) Mandatory Rubric display. (3) Quality bands = Rubric. | Quality bands and criteria = Rubric model | stats have quality_band and criteria | REQ-STAT-006 PARTIAL | MEDIUM |
| AMB-004 | "الاطلاع على تفاصيل الخطة وتقييمها" | (1) View details only. (2) View details + explicit evaluation score/rubric per plan. | Detail view + quality (validation_status/score) = evaluation | Plans have validation_status; stats have quality | REQ-ADMIN-005 COMPLETE; “تقييم” may imply more formal rubric per plan | LOW |
| AMB-005 | "جدول المواصفات" formula: عدد اسئلة الموضوع = أهمية نسبية × عدد الاسئلة | Spec uses topic weight × objective weight × total questions. Repo uses cell weight (topic × level) × total questions. | Same idea: weight-based allocation; repo uses cell = topic × level | blueprintCalculator uses lesson (topic) and Bloom level | REQ-BLUEPRINT-003 COMPLETE; formula wording slightly different | HIGH |
| AMB-006 | "تحميله كتطبيق على الهاتف او الكمبيوتر" | (1) PWA installable. (2) Native app. (3) Desktop installer. | At least one install path (e.g. PWA) | Not verified | REQ-004 CANNOT VERIFY | LOW |
| AMB-007 | "ملف مباشر (بلوتوث)" | (1) Bluetooth file transfer. (2) Any “direct file” share (e.g. download then share). | Bluetooth or system share to send file | No Bluetooth API found | REQ-EXP-003 MISSING | HIGH |
| AMB-008 | "قابلة لتوسع مستقبلا" | (1) Code architecture. (2) Feature flags / config. (3) Multi-tenant/scaling. | Architectural/scalability claim; not testable from spec alone | Not verified | REQ-ADMIN-008 PARTIAL | LOW |

## 8. Page-by-Page Extraction Log

| Page | Sections on page | Requirement families extracted | Visual/template/table constraints | Hard to parse? | Inference from layout/image? |
|------|------------------|--------------------------------|----------------------------------|----------------|-----------------------------|
| 1 | Title, وصف المشروع، أهداف البرنامج (start) | Product purpose, scope, goals | None | No | No |
| 2 | أهداف البرنامج (cont.), مهام البرنامج أو طريقة عمله | Goals, lesson plan generation, assignments, time distribution, tests, statistics, smart edit | None | No | No |
| 3 | Smart edit details, التحقق من المعايير التربوية | Smart edit elements, pedagogical validation (objectives, activities, resources, assessment, time, homework, exam) | None | No | No |
| 4 | العمل بدون انترنت، الطباعة والمشاركة، ارسال الواجب بالواتساب، لوحة التحكم | Offline, export/share, WhatsApp assignment message, control panel intro | None | No | No |
| 5 | مكونات لوحة التحكم: إعدادات عامة، إدارة المنهج، إدارة الاختبارات، إدارة المعلم | General settings, curriculum, exam management, teacher management | None | No | No |
| 6 | إدارة الخطط المولدة، إدارة الاختبارات المولدة، التقارير والاحصائيات، القواعد التربوية | Plans management, exams management, reports, pedagogical rules | None | No | No |
| 7 | قواعد: صياغة أهداف بلوم، توافق أهداف–نشاط–تقويم، توزيع زمن الحصة، تنوع استراتيجيات، جودة اسئلة تقويم، جودة واجبات، جودة اختبارات، تصميم مقيد | Objective formula, alignment, time %, strategy diversity, evaluation/homework/exam quality | Percentages 10/60/20/10 | No | No |
| 8 | مرفقات: نموذج خطة درس تقليدية (جدول) | Traditional lesson plan template | Template table: header (تاريخ، يوم، صف، شعبة، حصة، عنوان، وحدة، وقت)، body (أهداف، استراتيجيات، أنشطة، وسائل، تقويم، واجب، مصدر) | Slight (table structure) | From table layout |
| 9 | نموذج خطة التعلم النشط (جدول) | Active learning template | Table: أهداف، يوم، مادة، تاريخ، وحدة، صف، عنوان درس، وقت؛ جدول الوقت/المحتوى/نوع النشاط/نشاط المعلم/نشاط المتعلم/مصادر | Yes (dense table) | From table layout |
| 10 | Active learning table (cont.), مجالات الأهداف السلوكية (بداية) | Active learning rows, behavioral domains intro | Rows with time, content, activity type, teacher/learner activity, resources | No | No |
| 11 | المجال المعرفي: مستويات وأفعال (تذكر، فهم، تطبيق، تحليل، تركيب، تقويم) | Cognitive domain levels and verbs | Verb lists per level | No | No |
| 12 | المجال الوجداني، النفسحركي: مستويات وأفعال | Affective, psychomotor domains and verbs | Verb lists | No | No |
| 13 | قاعدة الهدف السلوكي (مثال)، طرق واستراتيجيات الخطة العادية: إلقاء، مناقشة، استقرائية، استنتاجية | Objective formula example, traditional methods 1–4 | Example sentence; method name + استخدامات، أسلوب، وسائل | No | No |
| 14 | طرق: عرض عملي، حل مشكلات، مشروع، لعب أدوار، اكتشاف، تعاوني، مبرمج | Traditional methods 5–11 | Same structure | No | No |
| 15 | استراتيجيات التعلم النشط: القطار، ابحث عن النصف الآخر، مكعب اسئلة، تيك تاك تو، اكشف أوراقك | Active strategies 1–5 | Use cases, execution, resources | No | No |
| 16 | استراتيجيات: ورقة الدقيقة، أوجد الخطأ، أصدقاء الساعة، بطاقة خروج، جداول K.W.L، فكر-زاوج-شارك، أعواد المثلجات | Active strategies 6–12 | Same | No | No |
| 17 | استراتيجيات: المفاهيم الكرتونية، من أنا | Active strategies 13–14 | Same | No | No |
| 18 | إعداد الاختبارات: خطوات جدول المواصفات، تحديد أهداف ومستويات، تحديد أهمية نسبية للمواضيع | Test blueprint: objectives, topic relative weight | Formula: أهمية موضوع % = (حصص موضوع / اجمالي حصص) × 100 | No | No |
| 19 | أهمية نسبية للأهداف، توزيع عدد اسئلة، توزيع الدرجات؛ ملاحظات (المعلم يدخل العدد/الدرجة؛ البرنامج يقسم) | Objective weight, question distribution, mark distribution | Formulas with examples (4/12, 6/12, 2/12; 20/60, 15/60, etc.) | No | No |
| 20 | جدول المواصفات (جدول مركب): موضوعات، اهداف (تذكر–تقويم)، اسئلة ودرجات، أوزان نسبية | Blueprint table structure | Full blueprint table with numbers | Yes (numeric table) | From table |
| 21 | نفس الجدول (تكملة)، 100% | Blueprint totals | Sums and percentages | No | No |

---

---

# PART 5 — Testability View, Coverage Statistics, Final Compliance Verdict

## 9. Testability View (Evidence Required for Compliance)

For each requirement type, the following evidence would prove compliance:

| Requirement type / area | Evidence that would prove compliance |
|-------------------------|-------------------------------------|
| **Lesson plan generation** | UI screen to create plan; API POST /generate-plan; DB rows in Traditional/ActiveLearningLessonPlans; plan_json contains intro, objectives, strategies, activities, resources, assessment, homework; export returns PDF/DOCX. |
| **Assignments** | POST /assignments/generate with lesson_plan_public_id; Assignments table with type in (written, varied, practical); export PDF/DOCX; link to lesson plan in UI. |
| **WhatsApp assignment** | Button/link “إرسال بالواتساب”; wa.me or api.whatsapp.com link with pre-filled text containing عنوان الدرس، محتوى الواجب، موعد التسليم; deadline field in schema and UI. |
| **Time distribution** | Constant or config 10/60/20/10; validator ensures sum of phase times = duration_minutes; UI shows/edit time per phase. |
| **Exam generation** | POST /exams/generate with lesson_ids, total_questions, total_marks; blueprint_json with cells; questions_json with answers; teacher selects lessons in UI. |
| **Exam duration** | Column or field duration_minutes (or exam_duration) in Exams table; request body and UI input for “زمن الاختبار”. |
| **Blueprint formulas** | Code computing topic_weight = periods/total_periods; level_weight = level_count/total_objectives; question allocation and marks per cell from weights; total marks sum ≤ total_marks. |
| **Offline** | IndexedDB (or similar) stores plans, assignments, exams; UI works without network; sync/queue when back online. |
| **Smart edit** | Refinement API and UI; target_key for objectives, strategies, activities, assessment, resources, time, homework; LLM called when online; approve/reject flow. |
| **Pedagogical validation** | Validator checks objectives (Bloom, measurable); activity–objective link; assessment–objective link; time sum; forbidden verb replacement in normalizer. |
| **Export/print/share** | Export handlers return PDF and DOCX for plan, assignment, exam; “Print” = export PDF + open or system print; “Share via WhatsApp” = deep link with pre-filled message; “Share via Bluetooth/direct file” = file download or Web Share API / native share. |
| **Admin dashboard** | Settings (language, level, subject, default time, plan type) in DB and UI; curriculum CRUD (classes, subjects, units, lessons); teacher list with usage stats; plans/exams list with filters (subject, grade, quality); stats/summary and stats/export. |
| **Statistics** | KPIs: plans_generated, exams_generated, assignments_generated, avg_plan_quality, first_pass_rate, retry_rate, assignment_edit_rate; optional explicit plans_modified, exams_modified; quality_band and criteria in response and report. |
| **Objective formula** | Prompts/validator enforce structure (فعل سلوكي + محتوى + شرط/معيار); predefined verb list in constants; UI: dropdown of allowed verbs only = full compliance; backend-only replacement = partial. |
| **No activity without objective** | Validator rejects plan where an activity has no linked objective; UI prevents adding activity without selecting objective = full. |
| **Templates** | Traditional: header (date, day, grade, section, title, unit, time) and body (objectives, strategies, activities, resources, assessment, homework, source); Active: rows with time, content, activity type, teacher/learner activity, resources; export (HTML/DOCX) includes these fields. |
| **Teaching methods / strategies** | Constants or DB list of traditional methods and active strategies with names matching spec; prompts use them in generation. |
| **Bloom / verb tables** | BLOOM_LEVELS and level labels; verb lists per level (cognitive, affective, psychomotor) in code or data; used in classification and blueprint. |

## 10. Coverage Statistics (Summary)

| Metric | Value |
|--------|--------|
| **Approximate total atomic requirements extracted** | 120+ |
| **Fully complete (end-to-end evidence)** | ~70 |
| **Partial (backend or UI or channel missing)** | ~25 |
| **Missing (no implementation)** | ~12 |
| **Cannot verify (need runtime/external proof)** | ~8 |
| **Compliance % (complete / total)** | ~58% |
| **Compliance % (complete + partial / total)** | ~79% |
| **Critical gaps** | 1 (WhatsApp assignment) |
| **High gaps** | 3 (WhatsApp share, exam duration, assignment deadline) |
| **Medium gaps** | 6 |
| **Low gaps** | 2 |

## 11. Final Compliance Verdict

- **Specification coverage:** The project specification (مساعد المعلم الذكي) has been extracted into an atomic requirements checklist with source anchors (section/page), types (explicit, implied, template, calculation, validation), and Arabic/English normalization. Template fields, formulas (time 10/60/20/10, blueprint topic/level weights, question/mark distribution), pedagogical rules, teaching methods and active strategies, and export/share channels are included.

- **Repo mapping:** Requirements are mapped to features and to repo evidence (routes, controllers, services, validators, DB schema, frontend features, offline storage). Where no evidence exists, status is MISSING or PARTIAL; where evidence exists only in backend or only in UI, status is PARTIAL.

- **Compliance summary:** About **58%** of requirements are **fully** implemented with end-to-end evidence; about **79%** are at least partially implemented. Major **gaps:** (1) **WhatsApp** flow for assignment (pre-filled message with title, content, deadline; direct link) and for sharing plans/exams; (2) **Exam duration** (زمن الاختبار) not in schema or API; (3) **Assignment deadline** not stored; (4) **Bluetooth/direct file** share not implemented; (5) Explicit **plans/exams modified** counts in statistics; (6) **Pre-made verb list in UI** (force selection from list); (7) Optional: **print** as explicit action; **source (كتاب الطالب، الصفحة)** in plan template.

- **Recommendation:** Treat **GAP-001** (WhatsApp assignment) and **GAP-003** (exam duration) as **blocking** for full spec compliance. Address **GAP-002**, **GAP-011** (deadline), and **GAP-004** (Bluetooth/share) for full export/share compliance. The remainder are **enhancements** for stricter alignment with the written spec.

- **Artifact only:** This document is a **requirements compliance audit** only. No code changes, migrations, or implementation have been made.

---

*End of Part 5. End of REQUIREMENTS COMPLIANCE AUDIT document.*
