# 12. DESIGN DECISIONS & TRADEOFFS

## 12.1 Technology Choices

### Why Groq LLM Instead of OpenAI / Azure OpenAI?

| Aspect           | Groq                          | OpenAI          | Azure           |
| ---------------- | ----------------------------- | --------------- | --------------- |
| **Cost**         | $0.02/M input, $0.06/M output | $0.50-$1.50/M   | $3-$4/M         |
| **Speed**        | 100+ tok/sec                  | 20-30 tok/sec   | 20-30 tok/sec   |
| **Latency**      | 30ms-500ms                    | 500ms-2s        | 500ms-2s        |
| **Context**      | 32k tokens                    | 128k tokens     | 128k tokens     |
| **Availability** | Direct API                    | API + Azure     | Azure only      |
| **Arabic**       | llama-3.3 good                | GPT-4 excellent | GPT-4 excellent |

**Decision:** Groq chosen for **speed** (30s timeout requirement) + **cost** (budget constraints for Yemen market) + **availability** (no Azure credit required).

**Tradeoff:** Slightly lower Arabic performance vs. 5-10x speed improvement & 25x cost reduction.

---

### Why Turso/SQLite Instead of PostgreSQL / MongoDB?

| Aspect               | Turso               | PostgreSQL              | MongoDB                 |
| -------------------- | ------------------- | ----------------------- | ----------------------- |
| **Setup**            | 1-click deploy      | Requires infrastructure | Requires infrastructure |
| **Cost**             | Free tier: 3GB      | $15-100/month           | $15-100/month           |
| **Scalability**      | Replicated globally | Vertical scaling        | Horizontal sharding     |
| **Reliability**      | 99.9% SLA           | Need ops team           | Need ops team           |
| **Offline-first**    | Native sync         | Requires custom         | Requires custom         |
| **Query complexity** | SQL (mature)        | SQL (mature)            | Aggregation pipeline    |

**Decision:** Turso chosen for **simplicity** + **low cost** + **offline-first design** (SQLite replication) + **managed service** (no DevOps).

**Tradeoff:** Lower write scaling vs. <1 minute schema deployment, built-in disaster recovery, global edge caching.

---

### Why React + Vite Instead of Next.js / Vue / Svelte?

| Aspect              | React                    | Next.js            | Vue          | Svelte    |
| ------------------- | ------------------------ | ------------------ | ------------ | --------- |
| **Learning curve**  | Medium                   | High (SSR+SSG+ISR) | Low          | Very low  |
| **Ecosystem**       | Largest (npm packages)   | Next-specific      | Vue-specific | Tiny      |
| **Performance**     | Good (SPA)               | Excellent (SSR)    | Good (SPA)   | Excellent |
| **Offline support** | Custom (Service Workers) | Custom             | Custom       | Custom    |
| **Bundle size**     | ~40KB                    | ~100KB             | ~35KB        | ~20KB     |
| **Job market**      | Highest                  | High               | Medium       | Low       |

**Decision:** React chosen for **ecosystem** (all libraries work) + **job market** (easier hiring) + **team familiarity** (existing React knowledge).

**Vite** chosen over Create React App for **build speed** (50ms vs 5000ms) + **ESM-native** (better for modern browsers).

**Tradeoff:** Larger bundle size vs. mature ecosystem, faster development iteration.

---

## 12.2 Architectural Decisions

### Why Repository Pattern?

```
Question: Why abstract database queries into repositories?

Answer:
✅ Simplifies testing (mock repository easily)
✅ Centralizes query logic (DRY principle)
✅ Easy to swap databases (swap repository implementation)
✅ Type safety (repository defines interface)
```

### Why Two-Stage LLM Pipeline (Prompt 1 + 2)?

```
Question: Why not single LLM call for plan generation?

Answer:
✅ Prompt 1 (Draft): Fast, creative, explores possibilities
✅ Prompt 2 (Tuning): Ensures pedagogical compliance

Benefit: Best of both worlds
- Creativity from unconstrained Prompt 1
- Quality assurance from Prompt 2 validation

Single-stage tradeoff:
❌ Single constrained prompt = less creative output
❌ Single unconstrained prompt = lower pedagogical quality
```

### Why Artifact Revisions (Version Control)?

```
Question: Why track all revisions of lesson plans?

Answer:
✅ Teacher can revert to previous version
✅ Refinement approval creates new revision
✅ Audit trail for admin (compliance)
✅ Undo/redo functionality
✅ Compare versions (diff view)

Alternative (not chosen):
❌ Just store current version
❌ No revert capability
❌ No audit trail
```

### Why IndexedDB Instead of LocalStorage?

```
LocalStorage:  5-10MB limit, synchronous (blocks UI)
IndexedDB:     Gigabytes limit, asynchronous, faster

For offline-first app with lesson plans (large JSON):
✅ IndexedDB necessary
❌ LocalStorage would be bottleneck
```

---

## 12.3 Database Schema Decisions

### Why 14 Separate Tables Instead of Document-per-Teacher?

```
✗ One collection per teacher:
  - Huge document sizes (100MB+)
  - Slow queries (must scan entire document)
  - No transaction support

✓ 14 normalized tables:
  - Fast queries (indexed lookups)
  - Small query results
  - Proper ACID transactions
  - Query statistics per teacher easily
```

### Why Not Store Plans as Binary?

```
✗ Store as binary (encrypted):
  - Cannot query plan contents
  - Cannot search by subject/grade
  - Cannot calculate statistics

✓ Store as searchable JSON:
  - Admin can search "all plans on Math"
  - System can calculate quality metrics
  - Teachers can find past plans
  - Analytics queries possible
```

---

## 12.4 Frontend State Management Decisions

### Why Context API Instead of Redux?

```
Redux Benefits:
+ Centralized store
+ DevTools for debugging
+ Time-travel debugging

Context API Benefits (chosen):
+ No extra dependency
+ Built into React 19
+ <5 context providers needed
+ Simpler learning curve

For this app scale:
- 5 contexts (Auth, API, Offline, Notifications) is manageable
- Redux would be over-engineering
```

### Why Custom Hooks Instead of React Query / SWR?

```
React Query provides:
+ Automatic caching
+ Stale-while-revalidate strategy
+ Refetch on focus
+ Parallel queries

Custom hooks chosen because:
- Offline-first app (custom sync logic needed)
- IndexedDB + Service Worker strategy custom
- React Query assumes online-first architecture
- Simpler learning curve for Yemen team
```

---

## 12.5 Why Not Include These Features (Yet)?

### ❌ WhatsApp Integration

```
Requirement: "Share lesson plans via WhatsApp"

Why not implemented:
1. WhatsApp Business API:
   - $0.04 per message (cost at scale)
   - Requires business account + approval
   - Message templates limited

2. Teacher workflow:
   - Can export PDF + share manually (works)
   - WhatsApp link generation complex
   - Spam/security concerns

3. Prioritization:
   - Core generation works
   - Manual export sufficient for now
   - Can add later if demand

Roadmap: Q2 2025 (low priority)
```

### ❌ Bluetooth File Sharing

```
Requirement: "Share via Bluetooth"

Why not implemented:
1. Web Bluetooth API:
   - Limited browser support (Chrome, Edge only)
   - Complex pairing UI/UX
   - Security considerations

2. Alternative:
   - QR code + Bluetooth less necessary
   - File export + email sufficient
   - NFC is better but rare in Yemen

3. Tech debt:
   - Not worth complexity now

Roadmap: Post-MVP (if demand)
```

### ⚠️ Exam Duration Field

```
Implemented in DB: exam.duration_minutes (exists!)
Missing in UI: Exam creation form doesn't expose field

Why partially done:
1. Database ready for feature
2. LLM can infer from question count
3. UI not yet implemented

Fix: Add duration_input to ExamCreator.tsx component
Effort: 1-2 hours

Roadmap: Sprint 2 (next 2 weeks)
```

---

### ⚠️ Student Integration

```
Requirement: "Students take tests, see results"

Why not implemented:
1. Architecture designed for teachers only
2. Student portal would require:
   - Student authentication
   - Result recording DB tables
   - Answer submission API
   - Grading/scoring logic

3. Complexity:
   - Additional 2-3 months of dev work
   - New security considerations
   - Testing complexity increases

Expected: Phase 2 (2025 H2)
```

---

## 12.6 Performance Optimization Decisions

### Why Lazy Routing Instead of Code Splitting?

```
Current approach:
- All components bundled
- React Router lazy loading routes
- Chunk per major page

Benefits:
+ Simple to implement
+ Sufficient for current load (<1000 teachers)
+ No complex chunk management

When to upgrade:
- If user base > 10,000
- If bundle size > 500KB (gzipped)
```

### Why No Service Worker Cache for API?

```
API Endpoints: Network-first strategy
(Try network, fallback to old cached response)

Why not aggressive caching:
+ Data freshness critical for teachers
+ Stale data = wrong lesson plans
+ Network-first ensures latest version

Exception:
✅ Dropdown lists (subjects, grades) heavily cached
✅ Doesn't change during session
✅ Safe to cache aggressively
```

---

## Summary

**Key Design Decisions:**

1. **Groq LLM** - 5x cheaper, 5x faster than alternatives
2. **Turso/SQLite** - Managed, offline-first, cheap
3. **React + Vite** - Ecosystem + build speed
4. **Two-Stage Pipeline** - Creativity + quality assurance
5. **IndexedDB** - Offline-first architecture
6. **Repository Pattern** - Testability + flexibility
7. **Context API** - Simplicity vs. Redux overkill
8. **Normalize Schema** - Query flexibility + statistics

**Intentional Non-Included Features:**

- WhatsApp: Manual export sufficient
- Bluetooth: QR sufficient
- Student portal: Phase 2
- Exam duration UI: DB ready, just missing UI

---

**Next:** Read **13_LIMITATIONS_FUTURE.md** for known issues and roadmap.
