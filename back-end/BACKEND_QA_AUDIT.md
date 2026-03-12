# Backend QA Audit – Controllers, Routes, SQL, Relations

**Date:** 2026-03-12  
**Scope:** Routes, controllers, DB usage (turso/repos), table/column alignment with SQL schema.  
**Excluded:** Unit/integration tests (code audit only).

---

## 1. Route → Controller Wiring

| Mount | Route | Method | Handler | Status |
|-------|--------|--------|---------|--------|
| `/api/auth` | `/login` | POST | login | OK |
| `/api/auth` | `/logout` | POST | logout | OK |
| `/api/classes` | `/` | GET | getAllClassesInTheSystem | OK (order fixed) |
| `/api/classes` | `/` | POST | createClass | OK |
| `/api/classes` | `/mine` | GET | getClassesByTeacherId | OK |
| `/api/classes` | `/:classId` | GET/PUT/DELETE | get/update/delete by id | OK |
| `/api/subjects` | `/`, `/mine`, `/class/:classId`, `/:subjectId` | various | subject.controller | OK (order fixed) |
| `/api/units` | `/`, `/mine`, `/subject/:subjectId`, `/:unitId` | various | units.controller | OK (order fixed) |
| `/api/lessons` | `/`, `/mine`, `/unit/:unitId`, `/:lessonId` | various | lessons.controller | OK (order fixed) |
| `/api/generate-plan` | `/` | POST | generatePlan | OK (wired to generation service) |
| `/api/plans` | `/` | GET | listPlans | OK |
| `/api/plans` | `/:id` | GET | getPlanById | OK |
| `/api/plans` | `/:id/export` | GET | exportPlanHandler | OK (defined before `/:id`) |
| `/api/plans` | `/:id` | PUT | updatePlanById | OK |
| `/api/assignments` | `/`, `/:id`, `/:id/export`, PUT | various | assignments.controller + export | OK |
| `/api/exams` | `/`, `/generate`, `/:id`, etc. | various | exams.controller + export | OK |
| `/api/users` | `/me/profile`, `/teachers`, etc. | various | users.controller | OK |
| `/api/refinements` | `/`, `/history`, `/revisions`, `/:id`, etc. | various | refinements.controller | OK |
| `/api/stats` | `/summary`, `/export` | GET | stats.controller | OK |

All routes resolve to existing controller methods; no orphan or missing handlers.

---

## 2. SQL Table / Column Alignment

### 2.1 Schema source

- **Base schema:** `sql/master.sql` (Users, UserProfiles, Classes, Subjects, Units, Lessons, TraditionalLessonPlans, ActiveLearningLessonPlans, AssignmentGroups, Assignments, Exams, ExamLessons, ArtifactRevisions, RefinementRequests, RefinementAttempts).
- **Migrations:** `sql/migrations/` (e.g. 010 exam duration, 011 assignments due_date/whatsapp_message_text, 012 AuditLog, 013 ArtifactRevisions `manual_edit` source).

### 2.2 Table name consistency (fixes applied)

- **auth.controller.js:** `users` → `Users` (login query).
- **lessons.controller.js:** `units` → `Units`, `lessons` → `Lessons` (all SELECT/INSERT/UPDATE/DELETE).
- **seed.js:** `users` → `Users`; INSERT now includes `role` (required by schema).
- **middleware/auth.js:** Already uses `Users`.
- **Repositories / other controllers:** Already use PascalCase table names (Classes, Subjects, Units, Lessons, Users, UserProfiles, etc.).

SQLite treats unquoted identifiers as case-insensitive; normalization to schema casing (PascalCase) avoids ambiguity and matches migrations.

### 2.3 Tables and columns used in code

- **Users:** id, username, password, role, created_at. Used in auth, middleware, users repo, seed. Matches schema.
- **UserProfiles:** user_id, language, educational_stage, subject, preparation_type, default_lesson_duration_minutes, default_plan_type, updated_at. Used in users repo. Matches schema (and migrations if any extend it).
- **Classes:** id, name, description, grade_label, section_label, section, academic_year, default_duration_minutes, teacher_id. classes.controller and repos. Matches schema.
- **Subjects:** id, name, description, teacher_id, class_id. subject.controller. Matches schema.
- **Units:** id, name, description, subject_id, teacher_id. units.controller. Matches schema.
- **Lessons:** id, name, description, unit_id, teacher_id, content, number_of_periods. lessons.controller, lessonPlans.controller, assignment/exam generation, refinement.service. Matches schema.
- **TraditionalLessonPlans / ActiveLearningLessonPlans:** id, public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit, duration_minutes, plan_json, validation_status, retry_occurred, created_at, updated_at. lessonPlans.repository and generation service. Matches schema.
- **AssignmentGroups:** id, public_id, teacher_id, lesson_plan_public_id, lesson_id. assignmentGroups.repository. Matches schema.
- **Assignments:** id, public_id, assignment_group_id, teacher_id, lesson_plan_public_id, lesson_id, name, description, type, content, due_date, whatsapp_message_text, created_at, updated_at. assignments.repository (migration 011 columns used). Matches schema + migrations.
- **Exams:** id, public_id, teacher_id, class_id, subject_id, title, total_questions, total_marks, duration_minutes, blueprint_json, questions_json, created_at, updated_at. exams.repository (migration 010 duration_minutes). Matches schema + migrations.
- **ExamLessons:** exam_id, lesson_id, position. exams.repository. Matches schema.
- **ArtifactRevisions:** artifact_type, artifact_public_id, revision_number, parent_revision_id, payload_json, is_current, source, refinement_request_id, created_by_user_id, created_by_role, created_at. artifactRevisions.repository. After migration 013, `source` includes `manual_edit`. Matches schema + migrations.
- **RefinementRequests / RefinementAttempts:** Used by refinements repos. Column usage matches schema.
- **AuditLog:** action, user_id, details, created_at (migration 012). auditLog.js. Matches migration.

No mismatched or missing columns found for the code paths audited.

---

## 3. Foreign Key and Relation Usage

- **Classes.teacher_id** → Users(id). Enforced in schema; code passes teacher_id from body or req.user.
- **Subjects.class_id** → Classes(id), **Subjects.teacher_id** → Users(id). subject.controller checks class ownership before create/update.
- **Units.subject_id** → Subjects(id), **Units.teacher_id** → Users(id). units.controller checks subject ownership.
- **Lessons.unit_id** → Units(id), **Lessons.teacher_id** → Users(id). lessons.controller checks unit ownership.
- **TraditionalLessonPlans / ActiveLearningLessonPlans.teacher_id** → Users(id), **lesson_id** → Lessons(id). Repo and generation service set teacher_id and lesson_id correctly.
- **AssignmentGroups.teacher_id** → Users(id), **lesson_id** → Lessons(id). assignmentGroups.repository.
- **Assignments.assignment_group_id** → AssignmentGroups(id), **teacher_id** → Users(id), **lesson_id** → Lessons(id). assignments.repository.
- **Exams.teacher_id** → Users(id), **class_id** → Classes(id), **subject_id** → Subjects(id). exams.repository.
- **ExamLessons.exam_id** → Exams(id), **lesson_id** → Lessons(id). exams.repository.
- **ArtifactRevisions.parent_revision_id** → ArtifactRevisions(id), **refinement_request_id** → RefinementRequests(id), **created_by_user_id** → Users(id). artifactRevisions.repository.
- **RefinementAttempts.refinement_request_id** → RefinementRequests(id). refinementAttempts.repository.
- **UserProfiles.user_id** → Users(id). users.repository.
- **AuditLog.user_id** → Users(id) (migration 012). auditLog.js.

Access control (admin vs teacher) is applied in controllers/repos (e.g. lessonPlans getByPublicId/list use accessContext.role and accessContext.userId). No FK violations or missing relation checks identified in the audited flow.

---

## 4. Route Order (fixes applied)

Express matches routes in definition order. If `GET /` is defined after `GET /:id`, then a request to `GET /api/lessons` can be matched by `/:id` with an empty id, leading to wrong handler or 400/404.

- **lessons.routes.js:** `GET "/"` (getAllLessonsInTheSystem) moved **before** `GET "/:lessonId"`.
- **subjects.routes.js:** `GET "/"` (getAllSubjectsInTheSystem) moved **before** `GET "/:subjectId"`.
- **units.routes.js:** `GET "/"` (getAllUnitsInTheSystem) moved **before** `GET "/:unitId"`.
- **classes.routes.js:** `GET "/"` (getAllClassesInTheSystem) moved **before** `GET "/:classId"`.

**plans.routes.js** was already correct: `GET "/:id/export"` is defined before `GET "/:id"`.

---

## 5. Controller → Repository / Service Wiring

- **lessonPlans.controller:** Uses lessonPlansRepository, revisionsRepository, knowledgeLoader, normalizer, validator, loadLessonContent; generatePlan uses createLessonPlanGenerationService(). accessContext shape: `{ userId, role }`; repo expects `accessContext.userId` and `accessContext.role`. Aligned.
- **export.controller:** Uses lessonPlansRepository, assignmentsRepository, examsRepository, enrichPlan/enrichAssignment/enrichExam, exportPlan/exportAssignment/exportExam. Passes `{ userId, role }` for enrichment. Aligned.
- **users.controller:** Uses users.repository (createUser, getProfileByUserId, listTeachersWithUsage, updateProfile, etc.). Aligned.
- **assignments.controller / exams.controller:** Use respective repositories and export handlers; call insertAuditLog on edit. Aligned.
- **refinements.controller:** Uses refinement.service and artifactRevisions repository. Aligned.
- **stats.controller:** Uses stats.service (which uses lesson plans, exams, assignments, users repos). Aligned.

No missing or incorrect controller → repo/service wiring found.

---

## 6. Migrations and Deployment

- **Migration 013** (ArtifactRevisions `manual_edit`): Must be applied for manual plan/assignment/exam updates to succeed (revision INSERT uses source `manual_edit`). If only master.sql is applied, ArtifactRevisions.source CHECK does not include `manual_edit` and those INSERTs will fail.
- **Migrations 010, 011, 012:** Add exam duration, assignment due_date/whatsapp_message_text, and AuditLog. Code assumes these are applied when using duration_minutes (exams), due_date/whatsapp_message_text (assignments), and insertAuditLog.

Ensure all migrations are run in order on every environment (local, Render, etc.).

---

## 7. Summary of Code Changes Made During Audit

1. **auth.controller.js:** Query table name `users` → `Users`.
2. **lessons.controller.js:** All raw SQL table names `units` → `Units`, `lessons` → `Lessons`.
3. **seed.js:** Table name `users` → `Users`; INSERT extended with `role` = `'admin'`.
4. **lessons.routes.js:** `GET "/"` placed before `GET "/:lessonId"`.
5. **subjects.routes.js:** `GET "/"` placed before `GET "/:subjectId"`.
6. **units.routes.js:** `GET "/"` placed before `GET "/:unitId"`.
7. **classes.routes.js:** `GET "/"` placed before `GET "/:classId"`.

---

## 8. Conclusion

- **Routes:** All mounted routes have corresponding controller handlers; no orphan or missing routes.
- **SQL:** Table and column names used in code match the schema (and migrations). Consistency fixes were applied for auth, lessons, and seed.
- **Relations:** FK and access control usage are consistent with the schema and business rules.
- **Route order:** GET list-all routes are defined before GET-by-id so list endpoints are matched correctly.
- **Migrations:** Code assumes migrations 010–013 (and 012 for AuditLog) are applied; ensure they run in deployment.

No remaining issues identified in the audited backend code paths.
