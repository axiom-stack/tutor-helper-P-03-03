# 4. BACKEND ARCHITECTURE & IMPLEMENTATION

## 4.1 Backend Stack & Technology

**Runtime:** Node.js (v16+)  
**Framework:** Express.js (v5.2.1)  
**Database:** Turso (SQLite-compatible cloud)  
**Auth:** JWT (using jose library)  
**LLM:** Groq API (llama-3.3-70b)  
**Export:** Puppeteer-core + Chromium (PDF), DOCX library (Word)  
**Logging:** Pino with pino-pretty (structured logging)  
**Security:** Helmet (HTTP headers), CORS, bcryptjs (password hashing)

---

## 4.2 Backend Module Structure

```
back-end/src/
├── app.js                          # Express app setup (middleware, CORS, logging)
├── server.js                       # HTTP server startup
│
├── routes/                         # URL routing
│   ├── index.js                    # Route aggregator (all routes mounted here)
│   ├── auth.routes.js              # POST /auth/login, /auth/logout
│   ├── classes.routes.js           # CRUD classes
│   ├── subjects.routes.js          # CRUD subjects
│   ├── units.routes.js             # CRUD units
│   ├── lessons.routes.js           # CRUD lessons
│   ├── generatePlan.routes.js       # POST /generate-plan (LLM generation)
│   ├── lessonPlans.routes.js       # GET/POST/PUT /plans
│   ├── assignments.routes.js       # CRUD /assignments
│   ├── exams.routes.js             # CRUD /exams (includes blueprint calc)
│   ├── refinements.routes.js       # POST /refinements (AI suggestions)
│   ├── export.routes.js            # /export (PDF/Word generation)
│   ├── admin.routes.js             # /admin/* (stats, teachers, curriculum)
│   └── users.routes.js             # /users/profile, settings
│
├── controllers/                    # Request handlers (business logic entry points)
│   ├── auth.controller.js          # Login logic, JWT generation
│   ├── classes.controller.js       # Class CRUD handlers
│   ├── subjects.controller.js      # Subject CRUD handlers
│   ├── units.controller.js         # Unit CRUD handlers
│   ├── lessons.controller.js       # Lesson CRUD handlers
│   ├── lessonPlans.controller.js   # Plan retrieval, listing, deletion
│   ├── generatePlan.controller.js  # Entry point for plan generation
│   ├── assignments.controller.js   # Assignment CRUD
│   ├── exams.controller.js         # Exam CRUD, blueprint calc
│   ├── refinements.controller.js   # Suggestion workflow
│   ├── export.controller.js        # PDF/Word generation dispatch
│   ├── admin.controller.js         # Statistics, teacher management
│   └── users.controller.js         # Profile, settings updates
│
├── services/                       # Business logic & orchestration
│   ├── generatePlan.service.js     # Orchestrates Prompt 1 + 2 + validation
│   ├── lesson-plans/
│   │   ├── llm/
│   │   │   ├── prompt1Builder.js   # Builds draft generation prompt
│   │   │   ├── prompt2Builder.js   # Builds tuning prompt
│   │   │   ├── groqClient.js       # Groq API integration
│   │   │   └── promptExecutor.js   # Handles retries
│   │   ├── validators/
│   │   │   ├── lessonPlanValidator.js  # Validates against pedagog. rules
│   │   │   ├── bloomValidator.js       # Bloom taxonomy checks
│   │   │   ├── timeDistributionValidator.js
│   │   │   ├── objectiveValidator.js   # Measurability checks
│   │   │   └── timeDistributionCalculator.js
│   │   ├── normalizers/
│   │   │   └── lessonPlanNormalizer.js # Fixes time distribution
│   │   └── knowledgeLoader.js           # Loads Bloom verbs + rules
│   │
│   ├── assignments/
│   │   ├── assignmentGenerator.js  # Generates written, varied, practical
│   │   └── validators/
│   │       └── assignmentValidator.js
│   │
│   ├── exams/
│   │   ├── examBlueprintCalculator.js    # ToS + distribution
│   │   ├── examGeneration.service.js     # Full pipeline
│   │   ├── examObjectiveClassifier.js    # Bloom level assignment
│   │   ├── examOutputValidator.js        # Validates exam output
│   │   └── examSelectors.js              # Selects questions/lessons
│   │
│   ├── refinements/
│   │   ├── refinement.service.js        # Request orchestration
│   │   └── promptBuilders.js             # Refinement-specific prompts
│   │
│   ├── export/
│   │   ├── exportService.js             # PDF/Word generation (dispatch)
│   │   ├── htmlBuilders.js              # Convert plan to HTML
│   │   ├── docxBuilders.js              # Convert plan to DOCX
│   │   ├── pdfService.js                # Puppeteer PDF generation
│   │   └── examDocxBuilders.js, examHtmlBuilders.js
│   │
│   └── stats/
│       ├── stats.service.js             # Statistics calculation
│       ├── qualityRubric.js             # Quality scoring algorithm
│       └── stats.repository.js          # Statistics queries
│
├── repositories/                   # Database abstraction layer
│   ├── classes.repository.js       # Class queries
│   ├── subjects.repository.js      # Subject queries
│   ├── units.repository.js         # Unit queries
│   ├── lessons.repository.js       # Lesson queries
│   ├── lessonPlans.repository.js   # Lesson plans (Traditional + Active)
│   ├── assignments.repository.js   # Assignment queries
│   ├── exams.repository.js         # Exam queries
│   ├── artifactRevisions.repository.js  # Revision history queries
│   ├── refinements.repository.js   # RefinementRequest queries
│   ├── users.repository.js         # User/Profile queries
│   └── stats.repository.js         # Aggregation queries
│
├── middleware/
│   ├── auth.js                     # JWT verification + user loading
│   ├── errorHandler.js             # Global error handling
│   ├── validation.js               # Request validation
│   └── logging.js                  # Request/response logging (Pino)
│
├── constants/
│   └── promptsHelper.js            # Pedagogical knowledge base
│                                   # (Bloom verbs, rules, methods)
│
├── utils/
│   ├── database.js                 # Turso/libSQL client initialization
│   ├── jwt.utils.js                # JWT encode/decode (jose)
│   ├── passwordHash.utils.js       # bcrypt hashing
│   ├── timeHelper.js               # Time distribution logic
│   ├── jsonHelper.js               # JSON parsing utilities
│   ├── promptHelper.js             # Prompt building helpers
│   ├── validationHelper.js         # Re-usable validators
│   └── exportHelper.js             # PDF/Word export utilities
│
└── scripts/
    ├── seed.js                     # Database seeding (initial data)
    └── migrations/                 # Database migrations
        ├── 001_initial.sql
        ├── 002_assignments.sql
        ├── 003_exams_and_lesson_periods.sql
        ├── 004_user_profiles.sql
        └── 005_refinements.sql
```

---

## 4.3 Key Controllers & Entry Points

### generatePlan.controller.js

```javascript
/**
 * POST /api/generate-plan
 * Main entry point for lesson plan generation
 */
export async function generatePlan(req, res, next) {
  try {
    // 1. Extract + validate input
    const {
      lesson_title,
      lesson_content,
      subject,
      grade,
      duration_minutes,
      plan_type,
      lesson_id,
    } = req.body;

    validateGeneratePlanRequest({
      lesson_title,
      lesson_content,
      subject,
      grade,
      duration_minutes,
      plan_type,
    });

    const teacher_id = req.user.id;

    // 2. Call service layer
    const result = await generatePlanService.generate({
      lesson_title,
      lesson_content,
      subject,
      grade,
      duration_minutes,
      plan_type,
      lesson_id,
      teacher_id,
    });

    // 3. Return response
    res.status(201).json({
      id: result.id,
      public_id: result.public_id,
      plan_type: result.plan_type,
      plan_json: result.plan_json,
      validation_status: result.validation_status,
      retry_occurred: result.retry_occurred,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  } catch (error) {
    next(error);
  }
}
```

### exams.controller.js (Create Exam with Blueprint)

```javascript
/**
 * POST /api/exams
 * Create exam with Table of Specifications
 */
export async function createExam(req, res, next) {
  try {
    const {
      class_id,
      subject_id,
      lesson_ids,
      total_questions,
      total_marks,
      title,
    } = req.body;
    const teacher_id = req.user.id;

    // 1. Load lesson data
    const lessons = await lessonsRepository.getByIds(lesson_ids);

    // 2. Calculate Table of Specifications
    const blueprint = await examBlueprintCalculator.calculate({
      lessons,
      total_questions,
      total_marks,
    });

    // 3. Generate questions using LLM
    const questions = await examGeneration.generateQuestions({
      blueprint,
      lessons,
      total_questions,
      total_marks,
    });

    // 4. Validate
    validateExamOutput({ blueprint, questions, total_questions, total_marks });

    // 5. Store in DB
    const exam = await examsRepository.create({
      teacher_id,
      class_id,
      subject_id,
      title,
      total_questions,
      total_marks,
      blueprint_json: JSON.stringify(blueprint),
      questions_json: JSON.stringify(questions),
    });

    // 6. Create revision record
    await artifactRevisionsRepository.create({
      artifact_type: "exam",
      artifact_public_id: exam.public_id,
      revision_number: 1,
      source: "seed",
      is_current: 1,
      payload_json: JSON.stringify(exam),
      created_by_user_id: teacher_id,
      created_by_role: "teacher",
    });

    res.status(201).json(exam);
  } catch (error) {
    next(error);
  }
}
```

### refinements.controller.js (AI Suggestions)

```javascript
/**
 * POST /api/refinements
 * Request AI suggestions for plan improvement
 */
export async function requestRefinement(req, res, next) {
  try {
    const { artifact_public_id, target_key, feedback_text, include_alternatives } = req.body;
    const teacher_id = req.user.id;

    // 1. Create refinement request (status='processing')
    const refRequest = await refinementRequestsRepository.create({
      public_id: generateUUID(),
      target_key,
      artifact_type: 'lesson_plan',
      target_mode: 'single',
      artifact_public_id,
      base_revision_ids_json: JSON.stringify([...]),
      feedback_text,
      include_alternatives,
      status: 'processing',
      created_by_user_id: teacher_id,
      created_by_role: 'teacher'
    });

    // 2. Load current artifact
    const currentRevision = await artifactRevisionsRepository.getCurrent(
      'lesson_plan',
      artifact_public_id
    );
    const artifact = JSON.parse(currentRevision.payload_json);

    // 3. Build refinement prompt (context-specific)
    const prompt = buildRefinementPrompt({
      artifact,
      target_key,
      feedback_text,
      pedagogicalRules
    });

    // 4. Call LLM
    const refinementResult = await groqClient.call({
      systemPrompt: refinementSystemPrompt,
      userPrompt: prompt.userPrompt,
      modelName: GROQ_PROMPT2_MODEL
    });

    // 5. Create attempt record
    const attempt = await refinementAttemptsRepository.create({
      refinement_request_id: refRequest.id,
      attempt_number: 1,
      status: refinementResult.ok ? 'success' : 'failed',
      model_name: GROQ_PROMPT2_MODEL,
      system_prompt: prompt.systemPrompt,
      user_prompt: prompt.userPrompt,
      raw_output: refinementResult.rawOutput,
      candidate_payload_json: refinementResult.candidatePayload,
      changed_fields_json: JSON.stringify(refinementResult.changedFields)
    });

    // 6. Update refinement request status
    await refinementRequestsRepository.update(refRequest.id, {
      status: 'pending_approval',
      reason_summary: `Suggested improvements to ${target_key}`
    });

    // 7. Return to frontend (for side-by-side comparison)
    res.status(200).json({
      refinement_public_id: refRequest.public_id,
      status: 'pending_approval',
      target_key,
      current_section: artifact[target_key],
      proposed_section: refinementResult.proposedSection,
      changed_fields: refinementResult.changedFields,
      alternatives: refinementResult.alternatives
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/refinements/:id/approve
 * Teacher approves refinement suggestions
 */
export async function approveRefinement(req, res, next) {
  try {
    const { id } = req.params;
    const teacher_id = req.user.id;

    // 1. Load refinement request + attempt
    const refRequest = await refinementRequestsRepository.getById(id);
    const attempt = await refinementAttemptsRepository.getByRequest(refRequest.id);
    const candidatePayload = JSON.parse(attempt.candidate_payload_json);

    // 2. Create new ArtifactRevision with improvements
    const newRevision = await artifactRevisionsRepository.create({
      artifact_type: refRequest.artifact_type,
      artifact_public_id: refRequest.artifact_public_id,
      revision_number: prevRevision.revision_number + 1,
      parent_revision_id: prevRevision.id,
      payload_json: JSON.stringify(candidatePayload),
      is_current: 1,
      source: 'refinement_approval',
      refinement_request_id: refRequest.id,
      created_by_user_id: teacher_id,
      created_by_role: 'teacher'
    });

    // 3. Update original plan/assignment/exam with new payload
    await updateArtifactPayload(
      refRequest.artifact_type,
      refRequest.artifact_public_id,
      candidatePayload
    );

    // 4. Update refinement request status
    await refinementRequestsRepository.update(refRequest.id, {
      status: 'approved',
      decision: 'approve',
      decision_by_user_id: teacher_id,
      decision_at: NOW
    });

    res.status(200).json({ success: true, message: 'Refinement approved' });
  } catch (error) {
    next(error);
  }
}
```

---

## 4.4 Service Layer (Core Business Logic)

### generatePlan.service.js (Full Orchestration)

```javascript
export class GeneratePlanService {
  async generate(params) {
    const {
      lesson_title,
      lesson_content,
      subject,
      grade,
      duration_minutes,
      plan_type,
      teacher_id,
    } = params;

    // 1. Load pedogogical knowledge base
    const knowledge = loadPedagogicalRules();

    // 2. Build Prompt 1 (Draft Generation)
    const prompt1 = buildPrompt1({
      lessonTitle: lesson_title,
      lessonContent: lesson_content,
      subject,
      grade,
      durationMinutes: duration_minutes,
      planType: plan_type,
      bloomVerbs: knowledge.bloom_verbs_generation,
      pedagogicalRules: knowledge.pedagogical_rules,
      teachingMethods: knowledge.teaching_methods,
    });

    // 3. Call Groq LLM (Prompt 1) - Attempt 1
    let draftResult;
    try {
      draftResult = await this.groqClient.call({
        systemPrompt: prompt1.systemPrompt,
        userPrompt: prompt1.userPrompt,
        modelName: GROQ_PROMPT1_MODEL,
        timeout: GROQ_TIMEOUT_MS,
      });
    } catch (error) {
      // Attempt 2 with fallback model
      draftResult = await this.groqClient.call({
        systemPrompt: prompt1.systemPrompt,
        userPrompt: prompt1.userPrompt,
        modelName: GROQ_PROMPT1_MODEL_RETRY,
        timeout: GROQ_TIMEOUT_MS,
      });
    }

    // 4. Validate JSON + structure
    const draftJson = JSON.parse(draftResult.output);
    validateLessonPlanStructure(draftJson);

    // 5. Build Prompt 2 (Pedagogical Tuning)
    const prompt2 = buildPrompt2({
      draftJson,
      pedagogicalRules: knowledge.pedagogical_rules,
      bloomVerbs: knowledge.bloom_verbs_generation,
    });

    // 6. Call Groq LLM (Prompt 2) - Attempt 1
    let tuningResult;
    try {
      tuningResult = await this.groqClient.call({
        systemPrompt: prompt2.systemPrompt,
        userPrompt: prompt2.userPrompt,
        modelName: GROQ_PROMPT2_MODEL,
      });
    } catch (error) {
      // Attempt 2 with fallback
      tuningResult = await this.groqClient.call({
        systemPrompt: prompt2.systemPrompt,
        userPrompt: prompt2.userPrompt,
        modelName: GROQ_PROMPT2_MODEL_RETRY,
      });
    }

    const tuningJson = JSON.parse(tuningResult.output);

    // 7. Validate against pedagogical rules
    const validationResult = this.validator.validatePlan(tuningJson);

    // 8. If validation fails: Guided Retry
    if (!validationResult.passed) {
      const guidedRetryResult = await this.attemptGuidedRetry(
        tuningJson,
        validationResult.failures,
        prompt2,
      );
      if (guidedRetryResult.ok) {
        tuningJson = guidedRetryResult.correctedPlan;
      }
    }

    // 9. Normalize time distribution
    const normalized = this.timeNormalizer.normalize(
      tuningJson,
      duration_minutes,
    );

    // 10. Store in database
    const saved = await this.plansRepository.create({
      teacher_id,
      lesson_title,
      subject,
      grade,
      unit: params.unit,
      duration_minutes,
      plan_type,
      plan_json: JSON.stringify(normalized),
      validation_status: validationResult.passed
        ? "passed"
        : "passed_with_fixes",
      retry_occurred: false, // (would be true if Prompt 2 retried)
    });

    // 11. Create artifact revision
    await this.artifactRevisionsRepository.create({
      artifact_type: "lesson_plan",
      artifact_public_id: saved.public_id,
      revision_number: 1,
      source: "seed",
      is_current: 1,
      payload_json: JSON.stringify(normalized),
      created_by_user_id: teacher_id,
      created_by_role: "teacher",
    });

    return {
      id: saved.id,
      public_id: saved.public_id,
      plan_type: saved.plan_type,
      plan_json: normalized,
      validation_status: saved.validation_status,
      retry_occurred: false,
      created_at: saved.created_at,
    };
  }
}
```

---

## 4.5 Error Handling

### Global Error Handler Middleware

```javascript
export function errorHandler(err, req, res, next) {
  const logger = req.log || console;

  // Log error
  logger.error({
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    method: req.method,
    url: req.url,
  });

  // Determine response
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: "Validation Error",
      details: err.details,
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      error: "Authentication Failed",
      message: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى",
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(403).json({
      error: "Access Denied",
      message: "ليس لديك صلاحيات كافية",
    });
  }

  if (err instanceof LLMError) {
    return res.status(502).json({
      error: "LLM Generation Failed",
      message: "حدث خطأ أثناء توليد المحتوى، يرجى المحاولة لاحقاً",
    });
  }

  // Default error
  res.status(500).json({
    error: "Internal Server Error",
    message: "حدث خطأ غير متوقع",
  });
}
```

---

## 4.6 Authentication Flow

### JWT-Based Authentication

```javascript
import { SignJWT, jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

export async function generateToken(userId, userRole) {
  return new SignJWT({ sub: String(userId), role: userRole })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET_KEY);
}

export async function verifyToken(token) {
  try {
    const verified = await jwtVerify(token, SECRET_KEY);
    return verified.payload;
  } catch (error) {
    if (error.name === "JWTExpired") {
      throw new Error("Token expired");
    }
    throw new Error("Invalid token");
  }
}
```

---

## Summary

The backend is:

- **Modular** — Clear separation of routes, controllers, services, repositories
- **Business Logic Heavy** — Service layer contains core generation + validation
- **Well-Tested** — 50+ unit tests covering core workflows
- **Error-Resilient** — Retry mechanisms for LLM calls
- **Logged** — Structured logging (Pino) for debugging
- **Secure** — JWT auth, password hashing, SQL injection prevention via parameterized queries

---

**Next:** Read **05_FRONTEND_ARCHITECTURE.md** to understand the frontend implementation.
