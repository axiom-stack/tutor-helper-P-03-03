# 2. HIGH-LEVEL ARCHITECTURE

## 2.1 System Architecture Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER TIER                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │    Teachers      │  │    Admins        │  │    Browser   │  │
│  │  (Primary User)  │  │  (Secondary User)│  │   Device     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
└───────────┼──────────────────────┼──────────────────┼───────────┘
            │                      │                  │
            │ HTTP/HTTPS          │                  │
            └──────────┬───────────┴──────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                 FRONTEND TIER (React/Vite)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React Components (TypeScript)                             │ │
│  │  ├─ Authentication                                         │ │
│  │  ├─ Lesson Creator (Generate Plans)                       │ │
│  │  ├─ Assignments Manager                                  │ │
│  │  ├─ Quizzes/Exams Manager                                │ │
│  │  ├─ Plans Manager (Browse/View/Edit)                     │ │
│  │  ├─ Smart Refinement Panel (AI Suggestions)              │ │
│  │  ├─ Admin Dashboard (Stats, Teachers, Curriculum)        │ │
│  │  ├─ Settings & Profile Management                        │ │
│  │  └─ Control Curriculum (Classes, Subjects, Units)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ├─ State Management: React Context                             │
│  ├─ Routing: React Router v7                                    │
│  ├─ HTTP Client: Axios                                          │
│  ├─ Offline: IndexedDB + Service Worker                         │
│  └─ Notifications: React Hot Toast                              │
└───────────┬──────────────────────────────────────────────────────┘
            │
            │ REST API (JWT Bearer Token)
            │
┌───────────▼──────────────────────────────────────────────────────┐
│        API MIDDLEWARE & SECURITY                                  │
│  ├─ CORS (Cross-Origin Resource Sharing)                        │
│  ├─ Helmet (HTTP security headers)                              │
│  ├─ Authentication Middleware (JWT verification + user loading) │
│  └─ Logging (Pino with pino-pretty output)                      │
└───────────┬──────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────────┐
│        BACKEND API TIER (Express.js / Node.js)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  REST API Routes (50+ endpoints)                           │ │
│  │  ├─ /api/auth (login, logout)                             │ │
│  │  ├─ /api/classes (CRUD)                                  │ │
│  │  ├─ /api/subjects (CRUD)                                 │ │
│  │  ├─ /api/units (CRUD)                                    │ │
│  │  ├─ /api/lessons (CRUD)                                  │ │
│  │  ├─ /api/generate-plan (POST: LLM + validation)          │ │
│  │  ├─ /api/plans (GET, PUT, DELETE)                        │ │
│  │  ├─ /api/assignments (CRUD)                              │ │
│  │  ├─ /api/exams (CRUD + blueprint calc)                   │ │
│  │  ├─ /api/refinements (AI suggestions workflow)           │ │
│  │  ├─ /api/export (PDF/Word generation)                    │ │
│  │  ├─ /api/admin/* (statistics, teacher mgmt)              │ │
│  │  └─ /api/users/profile (settings)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ├─ Controllers (request handlers)                              │
│  ├─ Services (business logic)                                   │
│  ├─ Repositories (database queries)                             │
│  ├─ Middleware (auth, error, logging)                           │
│  └─ Utilities (validation, formatting, AI)                      │
└───────────┬──────────────────────────────────────────────────────┘
            │
    ┌───────┴────────────────────┬─────────────────┐
    │                            │                  │
┌───▼──────────────────┐  ┌────────▼──────────┐  ┌─▼──────────────┐
│  DATABASE TIER       │  │  LLM SERVICE      │  │ FILE STORAGE   │
│  (Turso/libSQL)      │  │  (Groq API)       │  │ (PDF/Word Exp) │
├──────────────────────┤  ├──────────────────┤  ├────────────────┤
│ ├─ Users             │  │ Model: llama-3.3 │  │ Puppeteer-core │
│ ├─ UserProfiles      │  │    -70b           │  │ Chromium       │
│ ├─ Classes           │  │ Timeout: 30s      │  │ DOCX library   │
│ ├─ Subjects          │  │ Prompt 1: Draft   │  │ Mammoth (parse)│
│ ├─ Units             │  │ Prompt 2: Tuning  │  │ PDF-parse      │
│ ├─ Lessons           │  │ Input: JSON       │  │ Multer (upload)│
│ ├─ TraditionalPlans  │  │ Output: JSON      │  └────────────────┘
│ ├─ ActivePlans       │  │ Retry: Fallback   │
│ ├─ Assignments       │  │ Models            │
│ ├─ Exams             │  └──────────────────┘
│ ├─ ArtifactRevisions │
│ ├─ RefinementRequest │
│ └─ RefinementAttempt │
└──────────────────────┘
```

---

## 2.2 Architectural Style

### Pattern Classification

- **Layered Architecture:** Clear separation (Routes → Controllers → Services → Repositories → DB)
- **API-Driven:** Everything exposed via REST endpoints
- **Modular:** Features organized as independent modules (lesson-plans, exams, assignments, etc.)
- **Service-Oriented:** Reusable business logic services
- **Repository Pattern:** Database abstraction layer
- **Middleware Pipeline:** Stacked middleware for concerns (auth, logging, error handling)

### Why This Design?

| Design Choice      | Benefit                                           |
| ------------------ | ------------------------------------------------- |
| Layered            | Easy to test, maintain, and extend                |
| API-Driven         | Frontend agnostic to backend tech                 |
| Modular            | Easy to add new features without affecting others |
| Repository Pattern | Database implementation is pluggable              |
| Middleware         | Cross-cutting concerns handled cleanly            |

---

## 2.3 Request Lifecycle (End-to-End Flow)

### Example: Generate Lesson Plan

```
1. USER ACTION (Frontend)
   └─ Teacher fills form:
      ├─ Lesson title, content, subject, grade
      ├─ Duration, unit, plan type
      └─ Clicks "Generate Plan"

2. FRONTEND PROCESSING
   ├─ Validate inputs (client-side)
   ├─ Show loading spinner
   ├─ POST /api/generate-plan with Bearer token
   └─ Store response in IndexedDB (offline persistence)

3. HTTP REQUEST
   ├─ Headers: Authorization: Bearer <JWT_TOKEN>
   ├─ Body: { lesson_title, lesson_content, ... }
   └─ Arrive at server

4. MIDDLEWARE STACK (Backend)
   ├─ CORS check: allow origin
   ├─ Helmet: set security headers
   ├─ Body parser: parse JSON
   ├─ Auth middleware:
   │  ├─ Extract token from header
   │  ├─ Verify JWT signature + expiry
   │  ├─ Load user from DB
   │  └─ Attach to req.user
   └─ Logging: log incoming request

5. ROUTE HANDLER (generatePlan.routes.js)
   └─ Match POST /api/generate-plan → generatePlan.controller.js

6. CONTROLLER (generatePlan.controller.js)
   ├─ Extract req.body + req.user
   ├─ Validate inputs
   ├─ Call service: generatePlanService.generate()
   └─ Return response

7. SERVICE LAYER (generatePlan.service.js)
   ├─ Load pedagogical rules + Bloom verbs
   ├─ Build Prompt 1 (draft generation)
   ├─ Call Groq LLM → receive response
   ├─ Parse JSON + validate structure
   ├─ Build Prompt 2 (pedagogical tuning)
   ├─ Call Groq LLM → receive improved JSON
   ├─ Validate against pedagogical rules:
   │  ├─ Check objectives are measurable
   │  ├─ Check time distribution (10/60/20/10)
   │  ├─ Check alignment (obj ↔ activity ↔ assessment)
   │  └─ Check activity diversity
   ├─ If validation fails: attempt guided retry
   ├─ Normalize time distribution (if needed)
   └─ Call repository to store

8. REPOSITORY LAYER (lessonPlans.repository.js)
   ├─ Insert into TraditionalLessonPlans (or ActiveLearningLessonPlans)
   ├─ Create ArtifactRevision (revision #1, source='seed')
   └─ Return saved plan with ID

9. RESPONSE PREPARATION
   ├─ HTTP 201 Created
   ├─ Return: { id, public_id, plan_json, validation_status, ... }
   └─ Add CORS headers

10. FRONTEND PROCESSING
    ├─ Receive response (HTTP 201)
    ├─ Store in state + IndexedDB
    ├─ Hide loading spinner
    ├─ Show success toast notification
    └─ Redirect to plan preview page

11. USER SEES
    ├─ Lesson plan displayed
    ├─ Can view, edit, export, refine
    └─ All happened in ~15-20 seconds (including LLM calls)
```

---

## 2.4 Core Subsystems

### Subsystem 1: Authentication & Authorization

**Purpose:** Identify users and control access

**Components:**

- JWT token generation (login)
- Token verification (all requests)
- Role-based access control (teacher vs admin)
- User loading into request context

**Flow:**

```
Login Credentials
    ↓
Verify (username + bcrypt password check)
    ↓
Generate JWT (signed with JOSE)
    ↓
Return token to client
    ↓
Client stores in localStorage
    ↓
Client sends in Authorization header on all requests
    ↓
Server verifies signature + expiry on every request
    ↓
If invalid: return 401 Unauthorized
```

### Subsystem 2: Lesson Plan Generation

**Purpose:** Create lesson plans using AI + validation

**Components:**

- LLM client (Groq API wrapper)
- Prompt builders (Prompt 1 + Prompt 2)
- Validators (pedagogical rules)
- Normalizers (fix time distribution)
- Repository (database storage)

**Flow:**

```
Input (lesson details)
    ↓
Prompt 1: Generate draft JSON
    ↓
Validate structure
    ↓
Prompt 2: Improve pedagogically
    ↓
Validate rules (Bloom, forbidden verbs, time, alignment)
    ↓
If fails: Guided retry (attempt to fix specific issues)
    ↓
Normalize time distribution
    ↓
Store in DB + return to user
```

### Subsystem 3: Smart Refinement

**Purpose:** Apply AI-powered improvements to existing plans

**Components:**

- Refinement controller & service
- LLM prompt builder (tuning prompts)
- Approval workflow
- Artifact revision tracking

**Flow:**

```
Teacher: "Improve objectives"
    ↓
Service: Build refinement prompt
    ↓
LLM: Generate suggestions
    ↓
Create RefinementRequest (status='pending_approval')
    ↓
Frontend: Show teacher suggestions side-by-side
    ↓
Teacher: Approve or Reject
    ↓
If Approve: Create new ArtifactRevision
If Reject: Mark request as 'rejected'
```

### Subsystem 4: Exam Generation

**Purpose:** Create exams with Table of Specifications

**Components:**

- Blueprint calculator (ToS)
- Question generator (LLM)
- Validators (questions, marks)
- Lesson selector

**Flow:**

```
Teacher selects: class, subject, lessons, total Q, total marks
    ↓
Load lessons → calculate topic weights (periods) + level weights (objectives)
    ↓
Build Table of Specifications (cell matrix)
    ↓
For each cell: generate questions with LLM
    ↓
Validate total questions + marks
    ↓
Store exam + create ExamLessons junction records
```

### Subsystem 5: Export (PDF/Word)

**Purpose:** Generate downloadable files

**Components:**

- HTML builders (convert plan to HTML)
- PDF service (Puppeteer → PDF)
- DOCX builders (Word format generation)
- File response handlers

**Flow:**

```
Teacher: "Export as PDF"
    ↓
Service: Build HTML from plan JSON
    ↓
Puppeteer: Launch Chrome, render HTML, capture PDF
    ↓
Return file: { buffer, mimeType, suggestedFilename }
    ↓
Frontend: Download file to user's device
```

### Subsystem 6: Statistics & Analytics

**Purpose:** Aggregate teacher performance + plan quality data

**Components:**

- Quality rubric (scorer)
- Stats calculator (aggregations)
- Stats repository (queries)
- Report builders

**Flow:**

```
Admin: "Show stats for past 30 days"
    ↓
Query: All plans, exams, assignments from DB
    ↓
For each plan: Calculate quality score (rubric)
    ↓
Aggregate: Count, average, trends by month
    ↓
Return: { plans_generated, avg_quality, first_pass_rate, ... }
```

### Subsystem 7: Offline Support

**Purpose:** Full functionality without internet

**Components:**

- IndexedDB database (browser storage)
- Service Worker (request interception)
- Queue system (defer operations)
- Sync service (push queued ops to server when online)

**Flow:**

```
Teacher offline: Uses app as normal
    ├─ Generate plan: saved to IndexedDB (not server)
    ├─ Edit plan: updated locally
    ├─ Export: PDF works (all resources cached)
    └─ Can't request AI suggestions (needs internet)

Teacher comes online:
    ├─ Service Worker detects online
    ├─ Process queue: POST generated plans to server
    ├─ Sync: Download latest data from server
    └─ Notify user: "Synced 3 plans"
```

---

## 2.5 Data Flow Across System

### Plan Generation Data Flow

```
┌─ Lesson Input ─────────────────────┐
│ lesson_title                        │
│ lesson_content                      │
│ subject, grade, duration, plan_type │
└──────────────────────┬──────────────┘
                       ↓
        ┌─ Knowledge Base loaded ──────────┐
        │ Pedagogical rules                │
        │ Bloom verbs (by level)           │
        │ Teaching methods                 │
        │ Question types                   │
        │ Domain labels (معرفي/وجداني/مهاري)│
        └──────────────┬────────────────────┘
                       ↓
         ┌─ Prompt 1 Built ──────────┐
         │ System: You are educator  │
         │ User: Generate plan JSON  │
         └────────────┬──────────────┘
                      ↓
              ┌─ Groq LLM Call ──┐
              │ llama-3.3-70b    │
              │ Timeout: 30s     │
              └────────┬─────────┘
                       ↓
           ┌─ Parse JSON Output  ──┐
           │ Validate structure    │
           │ (intro, objectives,   │
           │  activities,          │
           │  assessment, etc.)    │
           └──────────┬────────────┘
                      ↓
           ┌─ Prompt 2 Built ──────────┐
           │ Context: Draft JSON       │
           │ Instructions: Improve per │
           │ pedagogical rules         │
           └──────────┬────────────────┘
                      ↓
              ┌─ Groq LLM Call ──┐
              │ llama-3.3-70b    │
              └────────┬─────────┘
                       ↓
         ┌─ Validate Plan ────────────────────┐
         │ ✓ Objectives measurable            │
         │ ✓ No forbidden verbs               │
         │ ✓ Time: intro ~10% (range 8-12%)   │
         │ ✓ Time: present ~60% (range 58-62%)│
         │ ✓ Time: activity ~20% (range 18-22%)
         │ ✓ Time: assess ~10% (range 8-12%)  │
         │ ✓ Objectives linked to activities  │
         │ ✓ Objectives linked to assessment  │
         │ ✓ Activity diversity (≥2 methods)  │
         │ ✓ Assessment types varied          │
         └──────────┬───────────────────────┘
                    ↓
         ┌─ If validation fails ──────┐
         │ Attempt guided retry       │
         │ (specific error fixes)     │
         │ Build new Prompt 2 with    │
         │ error details              │
         │ Call LLM again             │
         └──────────┬─────────────────┘
                    ↓
      ┌─ Normalize Time Distribution ──┐
      │ If times don't add to exact    │
      │ duration: adjust proportionally │
      │ Recalculate percentages        │
      └──────────┬────────────────────┘
                 ↓
         ┌─ Store in Database ──────────┐
         │ INSERT TraditionalLessonPlans │
         │ (or ActiveLearningLessonPlans)│
         │ plan_json: final JSON         │
         │ validation_status: passed     │
         │ retry_occurred: true/false    │
         │ created_at: NOW               │
         │                               │
         │ INSERT ArtifactRevision       │
         │ (revision #1, source='seed')  │
         └──────────┬────────────────────┘
                    ↓
         ┌─ Return to Frontend ─────┐
         │ { id, public_id,         │
         │   plan_json, status,     │
         │   retry_occurred }       │
         └──────────┬───────────────┘
                    ↓
           ┌─ Frontend:         ┐
           │ Store in IndexedDB │
           │ Update UI          │
           │ Show success toast │
           └────────────────────┘
```

---

## 2.6 Key Architectural Decisions

| Decision              | Rationale                                 | Alternative Rejected                              |
| --------------------- | ----------------------------------------- | ------------------------------------------------- |
| JWT for auth          | Stateless, scalable, standard             | Sessions (requires state)                         |
| Two-stage LLM         | Quality assurance through dual validation | Single-stage (risky output)                       |
| Repository pattern    | DB implementation pluggable               | Direct model calls (tightly coupled)              |
| IndexedDB for offline | Purpose-built for browser local storage   | localStorage (limited size), Web SQL (deprecated) |
| Groq API              | Fast, affordable, good quality            | OpenAI (expensive), self-hosted (infrastructure)  |
| Layered architecture  | Clear separation of concerns              | MVC monolith (harder to scale)                    |

---

## Summary

The architecture is:

- **Scalable** — Layered design allows adding features without refactoring
- **Testable** — Clear boundaries make unit testing straightforward
- **Resilient** — Offline support + retry mechanisms handle failures
- **Transparent** — Clear data flow through all subsystems
- **Efficient** — Specialized tools for each job (Puppeteer for PDF, IDB for offline, etc.)

---

**Next:** Read **03_DATABASE_SCHEMA.md** to understand the data model.
