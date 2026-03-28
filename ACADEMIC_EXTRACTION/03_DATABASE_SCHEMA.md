# 3. DATABASE SCHEMA (COMPREHENSIVE)

## 3.1 Overview

**Database System:** Turso/libSQL (SQLite-compatible cloud database)  
**Total Tables:** 14 core tables + 1 junction  
**Relationships:** 20+ foreign key relationships  
**Constraints:** 40+ CHECK/UNIQUE constraints  
**Indexes:** 20+ indexes for performance

---

## 3.2 Complete Entity-Relationship Model

### Central Entities

```
Users
├─ UserProfiles (1:1)
├─ Classes (1:N)
├─ Subjects (1:N)
├─ Units (1:N)
├─ Lessons (1:N)
├─ TraditionalLessonPlans (1:N)
├─ ActiveLearningLessonPlans (1:N)
├─ Assignments (1:N)
├─ Exams (1:N)
├─ AssignmentGroups (1:N)
├─ ArtifactRevisions (1:N as created_by)
├─ RefinementRequests (1:N as created_by/decision_by)
└─ RefinementAttempts (1:N indirectly)

Classes
├─ Subjects (1:N)
├─ Exams (1:N)
└─ (multiple teacher-owned classes per grade/semester)

Subjects
├─ Units (1:N)
├─ Exams (1:N)
└─ (multiple subjects per class)

Units
└─ Lessons (1:N)

Lessons
├─ TraditionalLessonPlans (1:N)
├─ ActiveLearningLessonPlans (1:N)
├─ Assignments (1:N)
├─ ExamLessons (N:N via junction)
└─ (number_of_periods used in exam calculations)

TraditionalLessonPlans / ActiveLearningLessonPlans
├─ AssignmentGroups (1:N via lesson_plan_public_id)
├─ Assignments (1:N via lesson_plan_public_id)
├─ ArtifactRevisions (1:N)
└─ RefinementRequests (1:N)

AssignmentGroups
└─ Assignments (1:N)

Assignments
├─ ArtifactRevisions (1:N)
└─ RefinementRequests (1:N)

Exams
├─ ExamLessons (N:N via junction)
├─ ArtifactRevisions (1:N)
└─ RefinementRequests (1:N)

ArtifactRevisions
└─ (contains version history of all artifacts)

RefinementRequests
├─ RefinementAttempts (1:N)
└─ ArtifactRevisions (1:N as source)

RefinementAttempts
└─ (audit trail of LLM attempts)
```

---

## 3.3 Table-by-Table Documentation

### TABLE: Users

**Purpose:** Central user registry; authentication & role-based access

**Schema:**

```sql
CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT CHECK(role IN ('teacher', 'admin')) NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**

| Column         | Type     | Constraints     | Purpose                       |
| -------------- | -------- | --------------- | ----------------------------- |
| `id`           | INTEGER  | PK AUTO_INC     | Unique user ID                |
| `role`         | TEXT     | CHECK NOT NULL  | 'teacher' or 'admin'          |
| `username`     | TEXT     | NOT NULL UNIQUE | Login identifier              |
| `display_name` | TEXT     | NULL            | Full name for UI              |
| `password`     | TEXT     | NOT NULL        | Bcrypt hash (NEVER plaintext) |
| `created_at`   | DATETIME | DEFAULT NOW     | Account creation timestamp    |

**Key Rules:**

- ✅ Username is case-sensitive and globally unique
- ✅ Password must be bcrypted before storage (using `bcryptjs` library)
- ✅ Role determines feature access (RequireTeacher, RequireAdmin middleware)
- ❌ Never delete users (disable via role change instead)

**Usage Notes:**

- Teachers have full access to their own data
- Admins have read access to all data + management capabilities
- Each login generates new JWT token (stateless auth)

---

### TABLE: UserProfiles

**Purpose:** Extended user preferences; defaults for lesson planning

**Schema:**

```sql
CREATE TABLE UserProfiles (
  user_id INTEGER PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ar' CHECK(language IN ('ar', 'en')),
  subject TEXT,
  preparation_type TEXT,
  school_name TEXT,
  school_logo_url TEXT,
  default_lesson_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK(default_lesson_duration_minutes > 0),
  default_plan_type TEXT NOT NULL DEFAULT 'traditional' CHECK(default_plan_type IN ('traditional', 'active_learning')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Columns:**

| Column                            | Type    | Constraints                   | Purpose                                      |
| --------------------------------- | ------- | ----------------------------- | -------------------------------------------- |
| `user_id`                         | INTEGER | PK FK                         | 1:1 reference to Users                       |
| `language`                        | TEXT    | NOT NULL CHECK                | 'ar' or 'en'; affects all UI text            |
| `subject`                         | TEXT    | NULL                          | Teacher's primary subject (e.g., الرياضيات)  |
| `preparation_type`                | TEXT    | NULL                          | How teacher prepares (daily/weekly/other)    |
| `school_name`                     | TEXT    | NULL                          | School name; used in exports                 |
| `school_logo_url`                 | TEXT    | NULL                          | URL to school logo (for PDF exports)         |
| `default_lesson_duration_minutes` | INTEGER | > 0 DEFAULT 45                | Default class period length; pre-fills forms |
| `default_plan_type`               | TEXT    | IN(...) DEFAULT 'traditional' | Teacher's preferred plan template            |

**Used For:**

- Pre-filling lesson creator form
- Setting UI language
- Including school branding in exports
- Tracking teacher's subject specialization

---

### TABLE: Classes

**Purpose:** Class definitions; organizing lessons by grade, semester, section

**Schema:**

```sql
CREATE TABLE Classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_label TEXT NOT NULL,
  semester TEXT,
  section_label TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'أ',
  academic_year TEXT NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 45,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_classes_teacher_unique_semester_key
  ON Classes(teacher_id, academic_year, semester, grade_label, section_label)
  WHERE semester IS NOT NULL;
```

**Key Columns:**

| Column          | Type    | Purpose                                  |
| --------------- | ------- | ---------------------------------------- |
| `grade_label`   | TEXT    | Grade (e.g., الأول، الثاني، الأول ثانوي) |
| `semester`      | TEXT    | الأول or الثاني; NULL if year-long       |
| `section_label` | TEXT    | Section name (e.g., الأولى، الثانية)     |
| `section`       | TEXT    | Letter/code (أ، ب، ج)                    |
| `academic_year` | TEXT    | Year (e.g., 2025 - 2026)                 |
| `teacher_id`    | INTEGER | Teacher who owns this class              |

**Hierarchy:**

```
Class (Grade 1, Semester 1, Section A)
  └─ Subjects (Qur'an, Arabic, Math, Science, ...)
     └─ Units (Unit 1, Unit 2, ...)
        └─ Lessons (Lesson 1, Lesson 2, ...)
```

**Unique Constraint:** One class per teacher per year/semester/grade/section combo

---

### TABLE: Subjects

**Purpose:** Subject definitions (e.g., Math, Arabic, Science) within classes

**Schema:**

```sql
CREATE TABLE Subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Columns:**

| Column        | Type    | Purpose                                       |
| ------------- | ------- | --------------------------------------------- |
| `class_id`    | INTEGER | Which class this subject is for               |
| `teacher_id`  | INTEGER | Teacher who created it                        |
| `name`        | TEXT    | Subject name (الرياضيات، اللغة العربية، etc.) |
| `description` | TEXT    | Optional subject notes                        |

**Relationships:**

- One class can have multiple subjects
- Subjects are created per class (not shared across classes)
- Exams are per subject

---

### TABLE: Units

**Purpose:** Units of study within a subject

**Schema:**

```sql
CREATE TABLE Units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Columns:**

| Column       | Type    | Purpose                            |
| ------------ | ------- | ---------------------------------- |
| `subject_id` | INTEGER | Parent subject                     |
| `teacher_id` | INTEGER | Teacher who owns it                |
| `name`       | TEXT    | Unit name (e.g., الأعداد الطبيعية) |

**Example Structure:**

```
Subject: الرياضيات (Math)
  ├─ Unit 1: الأعداد والعمليات
  ├─ Unit 2: الكسور
  ├─ Unit 3: الهندسة
  └─ Unit 4: الإحصاء
```

---

### TABLE: Lessons

**Purpose:** Individual lessons with content and period info

**Schema:**

```sql
CREATE TABLE Lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  period_number INTEGER,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Columns:**

| Column                  | Type    | Purpose                                      |
| ----------------------- | ------- | -------------------------------------------- |
| `unit_id`               | INTEGER | Parent unit                                  |
| `teacher_id`            | INTEGER | Teacher who owns it                          |
| `name`                  | TEXT    | Lesson title                                 |
| `content`               | TEXT    | Lesson material (used by LLM for generation) |
| `period_number`         | INTEGER | Which period within unit (1, 2, 3, ...)      |
| **`number_of_periods`** | INTEGER | **How many class periods this lesson spans** |

**CRITICAL:** `number_of_periods`

- Used in exam blueprint calculation
- Determines topic weight: `topic_weight = number_of_periods / total_periods`
- Example: If exam includes lessons with 3, 4, 3 periods → weights 0.30, 0.40, 0.30

---

### TABLE: TraditionalLessonPlans

**Purpose:** Lesson plans following traditional pedagogy template

**Schema:**

```sql
CREATE TABLE TraditionalLessonPlans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons(id) ON DELETE CASCADE,
  lesson_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  retry_occurred INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_traditional_lesson_plans_teacher_lesson_created_at
  ON TraditionalLessonPlans(teacher_id, lesson_id, created_at DESC);
```

**Key Columns:**

| Column              | Type    | Purpose                                         |
| ------------------- | ------- | ----------------------------------------------- |
| `public_id`         | TEXT    | Public API ID (UUIDs in URLs)                   |
| `plan_json`         | TEXT    | **Full lesson plan JSON structure (see below)** |
| `validation_status` | TEXT    | 'passed' or 'passed_with_fixes'                 |
| `retry_occurred`    | INTEGER | 1 if generation retry needed, else 0            |

**`plan_json` Structure:**

```json
{
  "intro": {
    "duration_minutes": 4.5,
    "content": "تحية الطلاب والتعريف بموضوع الدرس..."
  },
  "objectives": [
    {
      "id": "obj_1",
      "objective_text": "أن يكتب الطالب الأعداد من 1 إلى 100 بشكل صحيح",
      "bloom_level": "remember",
      "domain": "معرفي",
      "linked_activities": ["act_1", "act_2"],
      "linked_assessment": ["assess_1"]
    }
  ],
  "presentation": {
    "duration_minutes": 27,
    "strategies": [
      {
        "name": "الشرح المباشر",
        "duration": 15,
        "description": "شرح القاعدة من السبورة..."
      }
    ]
  },
  "activities": [
    {
      "id": "act_1",
      "activity_text": "يكتب الطالب الأعداد من 10 إلى 50 على السبورة",
      "duration_minutes": 5,
      "learning_method": "نشاط فردي",
      "linked_objectives": ["obj_1"]
    }
  ],
  "assessment": [
    {
      "id": "assess_1",
      "question_text": "اكتب الأعداد 25، 47، 83 بالكلمات",
      "question_type": "essay",
      "bloom_level": "remember",
      "linked_objective": "obj_1"
    }
  ],
  "homework": [
    {
      "id": "hw_1",
      "homework_text": "اكتب الأعداد من 1 إلى 20 على دفترك",
      "estimated_duration_minutes": 10,
      "linked_objective": "obj_1"
    }
  ],
  "resources": [
    {
      "type": "كتاب",
      "title": "كتاب الطالب",
      "page_reference": "ص. 25-30"
    }
  ],
  "time_distribution": {
    "intro_percent": 10,
    "intro_minutes": 4.5,
    "presentation_percent": 60,
    "presentation_minutes": 27,
    "activity_percent": 20,
    "activity_minutes": 9,
    "assessment_percent": 10,
    "assessment_minutes": 4.5,
    "total_minutes": 45
  }
}
```

---

### TABLE: ActiveLearningLessonPlans

**Purpose:** Lesson plans using active learning pedagogy

**Schema:** Identical to TraditionalLessonPlans (same structure, different plan_json content)

**Difference:** `plan_json` emphasizes:

- Collaborative activities
- Student discovery
- Problem-solving
- Peer teaching
- Less direct instruction

---

### TABLE: AssignmentGroups

**Purpose:** Groups multiple assignments related to one lesson plan

**Schema:**

```sql
CREATE TABLE AssignmentGroups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignment_groups_teacher_lesson_plan
  ON AssignmentGroups(teacher_id, lesson_plan_public_id, lesson_id, created_at DESC);
```

**Purpose:** Allows batch refinement of all assignments for a lesson at once

---

### TABLE: Assignments

**Purpose:** Individual assignment/homework definitions

**Schema:**

```sql
CREATE TABLE Assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  assignment_group_id INTEGER REFERENCES AssignmentGroups(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('written', 'varied', 'practical')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignments_lesson_plan_public_id ON Assignments(lesson_plan_public_id);
CREATE INDEX idx_assignments_lesson_id ON Assignments(lesson_id);
CREATE INDEX idx_assignments_group_id ON Assignments(assignment_group_id);
```

**Assignment Types:**

1. **written** (واجبات كتابية)
   - Essays, short answers
   - Subjectively graded
   - Requires student composition

2. **varied** (أسئلة تقويم متنوعة)
   - Multiple choice, T/F, fill-blank
   - Objectively graded
   - Auto-gradable

3. **practical** (أنشطة تطبيقية)
   - Lab work, hands-on projects
   - Real-world application
   - May require physical activity

---

### TABLE: Exams

**Purpose:** Exam/quiz definitions with questions and blueprint

**Schema:**

```sql
CREATE TABLE Exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL CHECK(total_questions > 0),
  total_marks REAL NOT NULL CHECK(total_marks > 0),
  blueprint_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exams_teacher_id ON Exams(teacher_id);
CREATE INDEX idx_exams_subject_id ON Exams(subject_id);
CREATE INDEX idx_exams_class_id ON Exams(class_id);
CREATE INDEX idx_exams_created_at ON Exams(created_at DESC);
```

**Key Columns:**

| Column            | Type    | Purpose                                     |
| ----------------- | ------- | ------------------------------------------- |
| `total_questions` | INTEGER | Total Q count (teacher input)               |
| `total_marks`     | REAL    | Total marks (teacher input, can be decimal) |
| `blueprint_json`  | TEXT    | **Table of Specifications (ToS)**           |
| `questions_json`  | TEXT    | **Array of generated questions**            |

**`blueprint_json` Structure:**

```json
{
  "lessons": [
    {
      "lesson_id": 101,
      "lesson_name": "الضرب والقسمة",
      "number_of_periods": 3,
      "topic_weight": 0.3,
      "objectives_count": 4
    }
  ],
  "levels": [
    {
      "level": "remember",
      "level_label": "التذكر",
      "objectives_count": 5,
      "level_weight": 0.2
    }
  ],
  "cells": [
    {
      "lesson_id": 101,
      "level": "remember",
      "topic_weight": 0.3,
      "level_weight": 0.2,
      "cell_weight": 0.06,
      "question_count": 1,
      "cell_marks": 1.5,
      "per_question_marks": [1.5]
    }
  ],
  "totals": {
    "total_lessons": 3,
    "total_objectives": 12,
    "total_periods": 10,
    "total_questions": 20,
    "total_marks": 25
  }
}
```

**`questions_json` Structure:**

```json
[
  {
    "slot_id": "cell_1_remember_q1",
    "question_number": 1,
    "lesson_id": 101,
    "lesson_name": "الضرب والقسمة",
    "bloom_level": "remember",
    "bloom_level_label": "التذكر",
    "question_type": "multiple_choice",
    "marks": 1.5,
    "question_text": "ما هو ناتج 5 × 4؟",
    "options": ["18", "20", "22", "25"],
    "correct_option_index": 1,
    "answer_text": "20"
  }
]
```

---

### TABLE: ExamLessons

**Purpose:** Many-to-many relationship between Exams and Lessons

**Schema:**

```sql
CREATE TABLE ExamLessons (
  exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  position INTEGER,
  PRIMARY KEY (exam_id, lesson_id)
);

CREATE INDEX idx_exam_lessons_lesson_id ON ExamLessons(lesson_id);
```

**Purpose:** One exam can cover multiple lessons; one lesson can be covered by multiple exams

---

### TABLE: ArtifactRevisions

**Purpose:** Version history for all artifacts (plans, assignments, exams)

**Schema:**

```sql
CREATE TABLE ArtifactRevisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('lesson_plan', 'assignment', 'exam')),
  artifact_public_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK(revision_number > 0),
  parent_revision_id INTEGER REFERENCES ArtifactRevisions(id),
  payload_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
  source TEXT NOT NULL CHECK(source IN ('seed', 'refinement_approval', 'revert')),
  refinement_request_id INTEGER REFERENCES RefinementRequests(id),
  created_by_user_id INTEGER NOT NULL REFERENCES Users(id),
  created_by_role TEXT NOT NULL CHECK(created_by_role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

UNIQUE INDEX idx_artifact_revisions_unique_rev
  ON ArtifactRevisions(artifact_type, artifact_public_id, revision_number);

UNIQUE INDEX idx_artifact_revisions_current_unique
  ON ArtifactRevisions(artifact_type, artifact_public_id)
  WHERE is_current = 1;
```

**Example Timeline:**

```
Revision 1: source='seed', is_current=1
  → Teacher generates plan

Revision 2: source='refinement_approval', is_current=1
  → Teacher approves AI suggestions → Creates revision 2

Revision 3: source='revert', is_current=1
  → Teacher reverts to revision 1 (manually)
```

---

### TABLE: RefinementRequests

**Purpose:** Track AI refinement requests and approval workflow

**Schema:**

```sql
CREATE TABLE RefinementRequests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  target_key TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('lesson_plan', 'assignment', 'exam')),
  target_mode TEXT NOT NULL CHECK(target_mode IN ('single', 'batch')),
  artifact_public_id TEXT,
  assignment_group_public_id TEXT,
  base_revision_ids_json TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  target_selector TEXT,
  include_alternatives INTEGER NOT NULL DEFAULT 0 CHECK(include_alternatives IN (0, 1)),
  status TEXT NOT NULL CHECK(status IN ('processing', 'pending_approval', 'failed', 'blocked', 'rejected', 'approved', 'no_changes')),
  reason_summary TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  decision TEXT CHECK(decision IN ('approve', 'reject')),
  decision_note TEXT,
  decision_by_user_id INTEGER REFERENCES Users(id),
  decision_by_role TEXT CHECK(decision_by_role IN ('teacher', 'admin')),
  decision_at DATETIME,
  created_by_user_id INTEGER NOT NULL REFERENCES Users(id),
  created_by_role TEXT NOT NULL CHECK(created_by_role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refinement_requests_target_key ON RefinementRequests(target_key, created_at DESC);
UNIQUE INDEX idx_refinement_requests_one_pending_per_target
  ON RefinementRequests(target_key)
  WHERE status = 'pending_approval';
```

**Status Transitions:**

```
REQUEST INITIATED
    ↓
processing (LLM working)
    ↓
├─ pending_approval (teacher can review)
│  ├─ approve → ArtifactRevision created
│  ├─ reject → stops
│  └─ no_changes (no improvements generated)
├─ failed (LLM error)
├─ blocked (system constraints)
└─ (other statuses)
```

---

### TABLE: RefinementAttempts

**Purpose:** Audit trail of each LLM attempt during refinement

**Schema:**

```sql
CREATE TABLE RefinementAttempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refinement_request_id INTEGER NOT NULL REFERENCES RefinementRequests(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'blocked', 'no_changes')),
  model_name TEXT,
  rules_hash TEXT,
  system_prompt TEXT,
  user_prompt TEXT,
  raw_output TEXT,
  candidate_payload_json TEXT,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  alternatives_json TEXT,
  validation_json TEXT,
  error_json TEXT,
  reason_summary TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

UNIQUE INDEX idx_refinement_attempt_unique_number
  ON RefinementAttempts(refinement_request_id, attempt_number);
```

**Usage:** Full audit trail of every LLM call (prompts, outputs, validation results)

---

## 3.4 Normalization & Relationships

### Normalization Level: 3NF (Third Normal Form)

✅ **No repeated groups** — All arrays stored as JSON (plan_json, questions_json)  
✅ **All non-key attributes depend on full key** — No partial dependencies  
✅ **No transitive dependencies** — No attribute depends on non-key attribute

### Foreign Key Constraints

```
Users ← UserProfiles (ON DELETE CASCADE)
Users ← Classes (teacher_id)
Users ← Subjects (teacher_id)
Users ← Units (teacher_id)
Users ← Lessons (teacher_id)
Users ← TraditionalLessonPlans (teacher_id)
Users ← ActiveLearningLessonPlans (teacher_id)
Users ← Assignments (teacher_id)
Users ← Exams (teacher_id)
Users ← ArtifactRevisions (created_by_user_id)
Users ← RefinementRequests (created_by_user_id, decision_by_user_id)

Classes ← Subjects (ON DELETE CASCADE)
Classes ← Exams (ON DELETE CASCADE)

Subjects ← Units (ON DELETE CASCADE)
Subjects ← Exams (ON DELETE CASCADE)

Units ← Lessons (ON DELETE CASCADE)

Lessons ← TraditionalLessonPlans (ON DELETE CASCADE, nullable)
Lessons ← ActiveLearningLessonPlans (ON DELETE CASCADE, nullable)
Lessons ← Assignments (ON DELETE CASCADE)
Lessons ← ExamLessons (ON DELETE CASCADE)

AssignmentGroups ← Assignments (ON DELETE CASCADE)

RefinementRequests ← RefinementAttempts (ON DELETE CASCADE)
```

---

## 3.5 Indexes for Performance

### Query Optimization Strategy

**High-Volume Queries (indexed):**

```sql
-- Find all plans by teacher
CREATE INDEX idx_traditional_lesson_plans_teacher_lesson_created_at
  ON TraditionalLessonPlans(teacher_id, lesson_id, created_at DESC);

-- Find all exams by teacher
CREATE INDEX idx_exams_teacher_id ON Exams(teacher_id);

-- Find assignments by lesson plan
CREATE INDEX idx_assignments_lesson_plan_public_id ON Assignments(lesson_plan_public_id);

-- Find refinement requests by target
CREATE INDEX idx_refinement_requests_target_key ON RefinementRequests(target_key, created_at DESC);
```

---

## Summary

The database design is:

- **Normalized** — 3NF compliance ensures data integrity
- **Flexible** — JSON fields allow storing complex structures without schema changes
- **Indexed** — Key queries have dedicated indexes for performance
- **Relational** — Clear relationships enable complex queries
- **Auditable** — Full revision history + refinement attempt logs

---

**Next:** Read **04_BACKEND_ARCHITECTURE.md** to understand backend implementation.
