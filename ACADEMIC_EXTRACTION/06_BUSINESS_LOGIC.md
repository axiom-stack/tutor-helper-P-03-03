# 6. CORE BUSINESS LOGIC & WORKFLOWS

## 6.1 Lesson Plan Generation Workflow (End-to-End)

### Phase 1: Request Validation & Preparation

**Entry Point:** Frontend `LessonCreator.tsx` → `POST /api/generate-plan`

```
User Input:
├── lesson_title: "مقدمة إلى الخلية"
├── lesson_content: "أنواع الخلايا وأجزاؤها..."
├── subject: "العلوم"
├── grade: "الثالث الابتدائي"
├── duration_minutes: 45
├── plan_type: "traditional" | "active_learning"
└── lesson_id?: (optional, for linking to curriculum)

Validation (generatePlan.controller.js):
├── ✅ lesson_title: Non-empty string
├── ✅ lesson_content: Non-empty string, max 5000 chars
├── ✅ subject: Valid from dropdown (16 subjects)
├── ✅ grade: Valid from dropdown (الأول-الثالث ابتدائي, etc.)
├── ✅ duration_minutes: 30-120 range
├── ✅ plan_type: "traditional" or "active_learning"
└── ✅ User authenticated + has role="teacher"

If any validation fails:
└── Return 400 with error details (Arabic error messages)
```

### Phase 2: Prompt 1 (Draft Generation)

**Executor:** `generatePlan.service.js` → `prompt1Builder.js`

```
Load Pedagogical Knowledge Base:
├── Bloom taxonomy verbs (6 levels × 12+ verbs each)
├── Teaching methods (7 methods: discussion, QA, games, etc.)
├── Pedagogical rules (14 rules: time distrib, objective format, etc.)
├── Question types (4 types: MC, T/F, fill-blank, open-ended)
└── Domain categories (معرفي, وجداني, مهاري)

Build Prompt 1 System Message:
├── Role: "You are an expert educational content designer..."
├── Constraints: Arabic language, Bloom-based objectives, 10-60-20-10 time dist
├── Output format: Strict JSON schema with required fields
├── Pedagogy: Reference pedagogical rules for validity
└── Context: Yemeni curriculum standards

Build Prompt 1 User Message:
├── Include: lesson_title, lesson_content, subject, grade
├── Context: "Create a lesson plan for: [lesson_title]"
├── Knowledge: "Using these Bloom verbs: [VERBS]"
├── Rules: "Follow these pedagogical rules: [RULES]"
└── Format: "Return ONLY valid JSON matching this schema: [SCHEMA]"

Execute Groq LLM Call (GROQ_PROMPT1_MODEL = llama-3.3-70b):
├── Timeout: 30 seconds
├── On success:
│   └── Extract raw output + parse JSON → draftJson
├── On timeout/error (Attempt 1 failed):
│   ├── Wait 2 seconds
│   ├── Retry with same model (Attempt 2)
│   └── On Attempt 2 failure:
│       └── Throw LLMError("Prompt 1 generation failed")

Parse Draft JSON:
├── Expected Schema:
│   ├── objectives: [
│   │   { bloom_level: "Remember", description: "...", domain: "معرفي" }
│   │ ]
│   ├── activities: [...] (7+ activities)
│   ├── assessment: { methods: [...], timing: "..." }
│   ├── resources: [...] (3+ resources)
│   └── timing_breakdown: { intro: 4.5, main: 27, closing: 13.5 }
│
├── Validate structure:
│   ├── ✅ objectives.length >= 3
│   ├── ✅ activities.length >= 7
│   ├── ✅ All objectives have bloom_level from valid set
│   ├── ✅ All objectives have domain ∈ {معرفي, وجداني, مهاري}
│   ├── ✅ assessment.methods.length >= 2
│   └── ✅ resources.length >= 3
│
└── If validation fails:
    └── Throw ValidationError("Draft structure invalid")
```

### Phase 3: Prompt 2 (Pedagogical Tuning)

**Executor:** `prompt2Builder.js` → Groq LLM

```
Build Prompt 2 System Message:
├── Role: "You are a pedagogical expert reviewing lesson plans..."
├── Task: "Refine this lesson plan to strictly comply with pedagogical rules"
├── Rules to check:
│   ├── 1. Bloom objectives must use exact verbs
│   ├── 2. Forbidden verbs must not appear (know, like, understand)
│   ├── 3. Time distribution must be exactly 10-60-20-10%
│   ├── 4. Assessment must use 2+ methods
│   ├── 5. Activities must be age-appropriate
│   ├── 6. Objectives must be SMART (specific, measurable, achievable, relevant, time-bound)
│   └── ... (14 rules total)
├── Output: JSON with same structure as input, but refined
└── Constraint: Only modify / enhance, do NOT delete sections

Build Prompt 2 User Message:
├── "Review this lesson plan for pedagogical compliance:"
├── [Full JSON from draftJson]
├── "Fix any issues violating these rules: [RULES]"
├── "Return full refined JSON"
└── "Do not change structure, only improve content"

Execute Groq LLM Call (GROQ_PROMPT2_MODEL = llama-3.3-70b):
├── Timeout: 30 seconds
├── On success:
│   └── Extract + parse JSON → tuningJson
├── On timeout/error:
│   ├── Retry once
│   └── On failure:
│       └── Use draftJson as fallback (move to Phase 4)

Parse Tuning JSON:
└── Validate same structure as Phase 2
```

### Phase 4: Validation Against Pedagogical Rules

**Executor:** `lessonPlanValidator.js`

```
Run Comprehensive Validation:

1. BloomValidator:
   ├── For each objective:
   │   ├── Check verb is in Bloom taxonomy (6 levels)
   │   ├── Check verb is NOT in forbidden list
   │   └── Check domain ∈ {معرفي, وجداني, مهاري}
   └── Result: { passed: bool, violations: [...] }

2. TimeDistributionValidator:
   ├── Calculate percentages:
   │   ├── intro_pct = (intro_mins / total_mins) * 100
   │   ├── main_pct = (main_mins / total_mins) * 100
   │   ├── closing_pct = (closing_mins / total_mins) * 100
   │   └── Reverse-calculate timing from activities if needed
   │
   ├── Check distribution:
   │   ├── intro_pct ≈ 10% (±2%)
   │   ├── main_pct ≈ 60% (±3%)
   │   ├── closing_pct ≈ 20% (±2%)
   │   ├── assessment_pct ≈ 10% (±2%)
   │   └── Total = 100%
   │
   └── Result: { passed: bool, normalizedTiming: {...} }

3. ObjectiveValidator:
   ├── For each objective:
   │   ├── Check description is measurable (contains action verb)
   │   ├── Check 5-20 words length
   │   ├── Check outcome is clear
   │   └── Check no ambiguous language
   └── Result: { passed: bool, violations: [...] }

4. ActivityValidator:
   ├── Count activities: must be >= 7
   ├── Check activities use varied teaching methods
   ├── Check activities are age-appropriate
   └── Result: { passed: bool, violations: [...] }

5. AssessmentValidator:
   ├── Check assessment.methods.length >= 2
   ├── Check methods are valid
   ├── Check assessment timing is present
   └── Result: { passed: bool, violations: [...] }

Aggregated Result:
├── validation_status: "passed" | "passed_with_fixes" | "failed"
├── violations_found: [...] (list of issues)
├── scores:
│   ├── bloom_compliance: 0-100
│   ├── time_distribution: 0-100
│   ├── objective_quality: 0-100
│   └── activity_diversity: 0-100
└── Can proceed: bool
```

### Phase 5: Guided Retry (If Validation Failed)

**Executor:** `generatePlan.service.js`

```
If validation_status != "passed":
├── Extract violations from validation
├── Build Prompt 3 (Guided Retry):
│   ├── "Here's your lesson plan"
│   ├── "It has these issues: [violations]"
│   ├── "Fix ONLY these issues:"
│   │   ├── Issue 1: [specific problem]
│   │   ├── Issue 2: [specific problem]
│   │   └── ...
│   └── "Keep everything else unchanged"
│
├── Call LLM with Prompt 3
├── Parse output → revisedJson
├── Re-validate → If now passed:
│   └── Use revisedJson as final plan
└── If still failing:
    └── Use best-effort version with logged issues
```

### Phase 6: Normalization of Time Distribution

**Executor:** `lessonPlanNormalizer.js`

```
Input: planJson with timing_breakdown fields

Algorithm:
1. Extract timing values: intro_mins, main_mins, closing_mins
2. Calculate actual percentages
3. If distribution is off:
   ├── Scale proportionally:
   │   ├── base_ratio = {intro, main, closing, assess}
   │   ├── new_total = duration_minutes
   │   └── rescale = (new_total / old_total)
   │   ├── new_intro = base_ratio.intro * rescale
   │   ├── new_main = base_ratio.main * rescale
   │   └── ... (same for others)
   │
   └── If any component is < 2 minutes:
       └── Adjust using 10-60-20-10 formula:
           ├── intro = duration * 0.10
           ├── main = duration * 0.60
           ├── closing = duration * 0.20
           └── assess = duration * 0.10

4. Round to nearest minute
5. Validate: Sum = duration_minutes
6. Update all timing references in activities
7. Return normalized planJson
```

### Phase 7: Database Storage & Versioning

**Executor:** `lessonPlans.repository.js` + `artifactRevisions.repository.js`

```
1. Create LessonPlan Record:
   INSERT INTO lesson_plans (
     teacher_id,
     lesson_title,
     subject,
     grade,
     unit,
     semester,
     duration_minutes,
     plan_type,
     plan_json,
     validation_status,
     retry_occurred,
     created_at,
     updated_at
   ) VALUES (...)
   → Returns: { id, public_id, ... }

2. Create ArtifactRevision Record:
   INSERT INTO artifact_revisions (
     artifact_type: 'lesson_plan',
     artifact_public_id,
     revision_number: 1,
     parent_revision_id: NULL,
     is_current: 1,
     source: 'seed',
     payload_json,
     created_by_user_id,
     created_by_role: 'teacher',
     created_at
   ) VALUES (...)
   → Enables version control + undo

3. Return to Frontend:
   {
     id: 123,
     public_id: "uuid-...",
     plan_type: "traditional",
     plan_json: { objectives: [...], activities: [...] },
     validation_status: "passed",
     retry_occurred: false,
     created_at: "2025-01-15T14:23:00Z",
     updated_at: "2025-01-15T14:23:00Z"
   }
```

### Phase 8: Frontend Storage (Offline Sync)

**Executor:** Frontend `offline/sync.ts`

```
If Online:
└── Plan already synced via API response

If Offline:
├── 1. Save to IndexedDB:
│   await db.put('plans', {
│     id: plan.public_id,
│     public_id: plan.public_id,
│     plan_json: JSON.stringify(plan.plan_json),
│     created_at: Date.now(),
│     updated_at: Date.now(),
│     sync_status: 'pending',
│     synced_at: null
│   })
│
├── 2. Add to Sync Queue:
│   await db.add('queue', {
│     id: uuid(),
│     artifact_type: 'lesson_plan',
│     artifact_public_id: plan.public_id,
│     operation: 'create',
│     payload: JSON.stringify(plan),
│     priority: 1,
│     retry_count: 0,
│     created_at: Date.now()
│   })
│
└── 3. When online again:
    ├── Retrieve from queue (by priority)
    ├── Retry POST /api/generate-plan
    ├── On success: Mark sync_status='synced'
    └── On failure: Increment retry_count, log error
```

---

## 6.2 Smart Refinement Workflow

### User Initiates Refinement

```
1. Frontend PlanViewerPage:
   ├── User selects section to improve (e.g., "objectives")
   ├── Writes feedback: "Make these more specific"
   └── Clicks "Request Suggestion"

2. POST /api/refinements:
   ├── target_key: "objectives"
   ├── feedback_text: "Make these more specific"
   ├── include_alternatives: true
   └── artifact_public_id: "uuid-..."

3. Backend Processing (refinements.controller.js):
   ├── Create RefinementRequest record:
   │   ├── public_id: uuid
   │   ├── artifact_public_id
   │   ├── target_key
   │   ├── feedback_text
   │   ├── status: 'processing'
   │   └── created_by_user_id: teacher_id
   │
   └── Call refinementsService.process()

4. LLM Refinement (refinement.service.js):
   ├── Load current artifact version
   ├── Extract target section:
   │   └── current_objectives = plan.objectives
   │
   ├── Build Refinement Prompt:
   │   ├── System: "You are a pedagogical expert..."
   │   ├── User:
   │   │   ├── "Current objectives: [LIST]"
   │   │   ├── "Teacher feedback: [feedback_text]"
   │   │   ├── "Improve these to be more specific"
   │   │   ├── "Keep Bloom levels and domains"
   │   │   └── "Suggest alternatives"
   │   └── Output format: JSON with { refined, alternatives }
   │
   ├── Call Groq LLM
   ├── Parse response → { refined_objectives, alternatives }
   └── Store RefinementAttempt record

5. Return to Frontend:
   {
     refinement_public_id: "uuid-...",
     status: 'pending_approval',
     target_key: 'objectives',
     current_section: [...],
     proposed_section: [...],
     alternatives: [[...], [...]]
   }

6. Frontend Comparison UI:
   ├── Show current version (left)
   ├── Show proposed version (right)
   ├── Show alternatives (dropdown)
   └── Buttons: "Approve", "Reject", "Choose Alternative"
```

### Teacher Approves Refinement

```
1. Frontend: Click "Approve" button
   └── POST /api/refinements/:id/approve

2. Backend Processing:
   ├── Load RefinementAttempt
   ├── Extract proposedSection from attempt
   ├── Merge with original:
   │   new_plan = {
   │     ...old_plan,
   │     [target_key]: proposedSection
   │   }
   │
   ├── Create new ArtifactRevision:
   │   ├── artifact_type: 'lesson_plan'
   │   ├── artifact_public_id
   │   ├── revision_number: old + 1
   │   ├── parent_revision_id: old_revision.id
   │   ├── payload_json: new_plan
   │   ├── is_current: 1
   │   ├── source: 'refinement_approval'
   │   ├── refinement_request_id
   │   ├── created_by_user_id: teacher_id
   │   └── created_at: now
   │
   ├── Update LessonPlan record:
   │   └── plan_json = new_plan, updated_at = now
   │
   ├── Update RefinementRequest:
   │   ├── status: 'approved'
   │   ├── decision: 'approve'
   │   ├── decided_at: now
   │   └── decided_by_user_id: teacher_id
   │
   └── Return success

3. Frontend:
   ├── Update plan_json in state
   ├── Show toast: "تم تحسين الخطة"
   └── Refresh PlanViewerPage
```

---

## 6.3 Exam Generation Workflow

### Blueprint Calculation (Table of Specifications)

```
Input:
├── lesson_ids: [1, 3, 5, ...]
├── total_questions: 20
├── total_marks: 100
└── subject: "العلوم"

Algorithm (examBlueprintCalculator.js):

1. Load all lessons with learning objectives:
   lessons = [
     { id: 1, objectives: [{bloom: "Remember", domain: "معرفي"}, ...] },
     { id: 3, objectives: [{bloom: "Analyze", domain: "مهاري"}, ...] },
     ...
   ]

2. Aggregate objectives by Bloom level:
   bloom_distribution = {
     'Remember': 4 objectives,
     'Understand': 6 objectives,
     'Apply': 5 objectives,
     'Analyze': 3 objectives,
     'Evaluate': 2 objectives,
     'Create': 1 objectives
   }

3. Aggregate objectives by domain:
   domain_distribution = {
     'معرفي': 12 objectives,
     'وجداني': 5 objectives,
     'مهاري': 4 objectives
   }

4. Calculate question allocation using Specification Table:
   For each (Bloom level, Domain) cell:
   ├── percentage = (cell_objectives / total_objectives) * 100
   ├── question_count = round(percentage * total_questions)
   ├── marks_per_question = total_marks / total_questions
   └── marks_for_cell = question_count * marks_per_question

   Result Table:
   ┌─────────────┬────────┬───────────┬──────────┐
   │ Bloom\Domain│ معرفي  │  وجداني   │  مهاري   │
   ├─────────────┼────────┼───────────┼──────────┤
   │ Remember    │ 3 Qs   │ 1 Q       │ -        │
   │ Understand  │ 4 Qs   │ 1 Q       │ 1 Q      │
   │ Apply       │ 2 Qs   │ 1 Q       │ 2 Qs     │
   │ ...         │ ...    │ ...       │ ...      │
   └─────────────┴────────┴───────────┴──────────┘

5. Create question slots:
   question_slots = [
     { bloom: 'Remember', domain: 'معرفي', lesson_id: 1, marks: 5 },
     { bloom: 'Remember', domain: 'معرفي', lesson_id: 3, marks: 5 },
     { bloom: 'Remember', domain: 'وجداني', lesson_id: 5, marks: 5 },
     ...
   ]

Output:
{
  total_questions: 20,
  total_marks: 100,
  blueprint_table: {...},
  question_slots: [...],
  lesson_distribution: [...]
}
```

### Question Generation from Slots

```
1. For each question_slot:
   ├── Load lesson content
   ├── Load objectives for that bloom + domain
   ├── Build LLM prompt:
   │   {
   │     "lesson_content": "...",
   │     "bloom_level": "Remember",
   │     "domain": "معرفي",
   │     "question_type": "multiple_choice",
   │     "marks": 5,
   │     "objective": "تذكر أنواع الخلايا"
   │   }
   │
   └── Call Groq: Generate question + options + answer_key

2. LLM Response Format:
   {
     "question_text": "ما هي أنواع الخلايا؟",
     "question_type": "multiple_choice",
     "options": [
       { "label": "أ", "text": "نباتية وحيوانية" },
       { "label": "ب", "text": "نباتية فقط" },
       ...
     ],
     "correct_option": "أ",
     "marks": 5,
     "bloom_level": "Remember",
     "domain": "معرفي"
   }

3. Validate each question:
   ├── ✅ question_text is not empty
   ├── ✅ options.length == 4 for MC
   ├── ✅ correct_option is valid
   ├── ✅ Language is Arabic
   └── ✅ No offensive content

4. Store in database:
   INSERT INTO exams (
     teacher_id,
     class_id,
     subject_id,
     title,
     total_questions,
     total_marks,
     blueprint_json,
     questions_json,
     created_at
   ) VALUES (...)
```

---

## 6.4 Assignment Generation Workflow

### Three Assignment Types

```
Type 1: Written Assignment
├── Prompt: "Design written questions based on lesson"
├── Output: 3-5 open-ended questions
├── Scoring: Manual (teacher grades)
└── Use: Homework / Assessment

Type 2: Varied Assignment
├── Prompt: "Create 10 questions of mixed types"
├── Output: Mix of MC, T/F, fill-in-the-blank
├── Scoring: Auto-scored
└── Use: Quick practice / Formative assessment

Type 3: Practical Assignment
├── Prompt: "Create hands-on activities based on unit"
├── Output: 3-5 practical tasks with materials list
├── Scoring: Rubric-based (teacher)
└── Use: Lab work / Project-based learning

Generation Flow:
1. User selects assignment_type
2. POST /api/assignments with lesson_id
3. Backend loads lesson content + objectives
4. Build assignment-specific prompt
5. Call Groq LLM
6. Parse + validate response
7. Store in assignments table (with assignment_type)
8. Return to frontend
```

---

## Summary of Key Workflows

| Workflow        | Entry        | Processing                               | Output          | Storage        |
| --------------- | ------------ | ---------------------------------------- | --------------- | -------------- |
| Lesson Plan Gen | UI Form      | Prompt1 → Validate → Prompt2 → Normalize | Plan JSON       | DB + Artifacts |
| Refinement      | UI Request   | Load → Build prompt → LLM → Merge        | Revised section | New revision   |
| Exam Gen        | UI Selection | Blueprint calc → Slot creation → LLM gen | Exam + Qs       | DB             |
| Assignment Gen  | UI Selection | Type selection → Prompt build → LLM      | Assignment      | DB             |

---

**Next:** Read **07_AI_INTELLIGENCE.md** for LLM integration details.
