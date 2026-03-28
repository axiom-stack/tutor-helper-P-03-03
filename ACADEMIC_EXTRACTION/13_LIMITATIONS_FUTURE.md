# 13. LIMITATIONS & FUTURE ROADMAP

## 13.1 Known Limitations

### Current Limitations

#### 1. Language Support

```
Current: Arabic only (UI + backend)

Limitation:
- No English interface
- Non-Arabic speakers cannot use system
- International expansion blocked

Impact: Medium
- 80% of target users understand Arabic
- Teachers can still use without UI

Future: Q3 2025
- Implement i18n framework
- Translate all UI + prompts
- Support EN, AR, French (if needed)

Effort: 3-4 weeks
```

#### 2. LLM Quality Variations

```
Current: Groq llama-3.3-70b varies by content

Limitation:
- Some subjects/grades produce better output than others
- Science > Humanities (for Arabic)
- Primary grades > Secondary

Impact: Medium
- Most teachers get high-quality plans
- 5-10% require manual refinement

Possible fixes:
1. Fine-tune Groq model on verified lesson plans
2. Add feedback loop: Teachers rate quality → retrain
3. Use multiple LLMs per subject (GPT-4 for Humanities?)

Timeline: Q4 2025 (post-launch feedback needed)
```

#### 3. No Mobile App

```
Current: Web-only (PWA capable)

Limitation:
- Offline download not available on mobile web
- Service worker support limited on iOS
- App store discoverability missing

Impact: High
- ~40% of target users mobile-first
- iOS PWA install unreliable

Solution: React Native app (iOS + Android)
Timeline: 2025 H2
Effort: 8-12 weeks (shared API backend)
```

#### 4. No Real-Time Collaboration

```
Current: Single teacher per plan

Limitation:
- Cannot co-create lesson plans
- No multi-teacher curriculum planning
- No anonymous sharing of patterns

Impact: Low-Medium
- Most teachers work independently
- Some schools want curriculum committees

Solution: CRDT-based collaborative editing
Timeline: 2026 (nice-to-have)
Effort: 12+ weeks (complex infrastructure)
```

#### 5. Exam Generation Limited to Generated Questions

```
Current: Cannot import teacher's own questions

Limitation:
- Must use LLM-generated questions
- Teachers cannot build custom question banks
- No way to import from past exams

Impact: Medium
- Workaround: Export → Edit → Re-import
- Some teachers prefer instant exam creation

Solution: Question bank management UI
Timeline: Q2 2025
Effort: 3-4 weeks
```

#### 6. No Integration with School Management Systems

```
Current: Standalone application

Limitation:
- Duplicate data entry (class rosters)
- No sync with school database
- Cannot pull student lists

Impact: Low
- Teachers enter classes manually (fast)
- Only 30-50 classes per teacher

Solution: API integrations (Blackboard, Canvas, Moodle)
Timeline: 2026 (school-level feature)
Effort: 4-6 weeks per platform
```

#### 7. No Plagiarism Detection

```
Current: No check if plan is from other sources

Limitation:
- Cannot verify originality
- Potential for copying between teachers

Impact: Low
- Most teachers create original content
- Can add manually if needed

Solution: TurnitinAPI integration
Timeline: 2026 (low priority)
Effort: 1-2 weeks
```

#### 8. Limited Export Formats

```
Current: PDF + DOCX only

Missing:
- Google Classroom integration
- Microsoft Teams assignment creation
- Moodle upload
- Web-based shared link

Impact: Low-Medium
- Most teachers download + manage manually
- Would improve ease of use

Solution: Native cloud integrations
Timeline: 2026
Effort: 2-3 weeks per platform
```

---

## 13.2 Performance Limitations

### LLM API Timeouts

```
Current: 30-second timeout per request

Issue:
- 5-10% of requests timeout (slow network)
- Non-deterministic (some requests fail intermittently)
- Yemen bandwidth: 5-15 Mbps average

Solution implemented:
✅ Retry mechanism (2 attempts)
✅ Fallback to Mixtral model
✅ Aggressive prompt truncation

Remaining risk:
- 1-2% chance of failure after all retries

Roadmap: 2025
- Cache previous responses (same lesson)
- Streaming responses (show partial plan)
- Local LLM fallback (Ollama if available)
```

### Database Scalability

```
Current: Turso free tier (3GB)

At scale:
- 1,000 teachers × 50 plans/teacher × 50KB/plan = 2.5GB
- Approaching limit at 1,000 teachers
- Will hit limit at 5,000 teachers

Solution:
1. Upgrade to Turso paid tier ($39/month)
2. Archive old plans (retention policy)
3. Plan → ReadOnly after 1 year

Timeline: When hitting 2GB (estimated Q2 2025)
Cost impact: $500/year
```

### Image Storage (If Added)

```
Future feature: Teachers upload images for lesson content

Current: No image storage

Solution when needed:
1. Use Cloudinary (free tier 25GB)
2. Or AWS S3 ($1-10/month)
3. Compress on upload (ImageMagick)

Estimated effort: 1-2 weeks
Timeline: Post-launch (based on demand)
```

---

## 13.3 Technical Debt

### Code Duplication

```
Areas:
- Validator functions (3 similar files)
- Repository query patterns
- Form validation (frontend + backend)

Fix approach:
1. Extract shared validators to utils
2. Create base Repository class
3. Use zod/joi for schema validation

Effort: 2-3 weeks
Priority: Medium (after launch stabilization)
```

### Missing Tests for Export System

```
Current test coverage: ~70%

Not covered:
- PDF generation with special Arabic chars
- DOCX field merging
- Export with large plans (>1000 lines)

Impact: Low
- Export feature stable
- Limited edge cases

Fix: Add 15-20 integration tests (e2e)
Effort: 1 week
Timeline: Anytime (low priority)
```

### Inconsistent Error Messages

```
Current: Mix of English + Arabic in error responses

Issue:
- Backend returns English (developer-friendly)
- Frontend shows Arabic (user-friendly)
- Mobile inconsistency

Fix:
1. Define error code enum
2. Centralize error message translation
3. Consistent format everywhere

Effort: 2-3 days
Priority: Low (works now, just messy)
```

---

## 13.4 Future Roadmap

### Phase 1 (Current - Q1 2025)

✅ **MVP Features:**

- Lesson plan generation (2-stage pipeline)
- Manual refinement approval
- Export PDF/DOCX
- Basic admin stats
- Offline support
- Authentication

**Status:** Launching Q1 2025
**Go/No-Go criteria:**

- ✅ 80%+ users report "very useful"
- ✅ < 5% error rate on generation
- ✅ < 10 second average response time

---

### Phase 2 (Q2 2025)

```
New Features:
☐ Exam duration field UI (already in DB)
☐ Question bank management
☐ Bluetooth/QR sharing
☐ Multiple language support (EN, FR)
☐ Teacher feedback loop (rate quality)
☐ Analytics dashboard improvements

Bugs/Tech Debt:
☐ SMS notifications (WhatsApp lite alternative)
☐ Improved offline conflict resolution
☐ Code cleanup (reduce duplication)

Estimated effort: 8 weeks
Team: 2 developers
```

---

### Phase 3 (H2 2025)

```
Student-Facing Features:
☐ Student portal (take exams online)
☐ Student grade viewing
☐ Parent notifications (Telegram/SMS)
☐ Assignment submission & grading

Integration Layer:
☐ Google Classroom sync
☐ Microsoft Teams integration
☐ Moodle plugin

LLM Improvements:
☐ Fine-tuned model for Yemen curriculum
☐ Subject-specific prompts
☐ Feedback-driven quality improvement

Estimated effort: 16 weeks
Team: 3-4 developers
```

---

### Phase 4 (2026)

```
Advanced Features:
☐ Real-time collaborative planning (CRDT)
☐ Plagiarism detection
☐ Mobile native apps (iOS/Android)
☐ AI-assisted grading
☐ Curriculum standards alignment
☐ Parent portal

Infrastructure:
☐ Multi-region deployment (latency reduction)
☐ Advanced caching (Redis)
☐ Microservices split (if needed)
☐ GraphQL API (alongside REST)

Business:
☐ Premium features (VIP teacher tier)
☐ B2B school subscriptions
☐ Analytics + consulting services

Estimated effort: Open-ended
Team: 5+ developers
```

---

## 13.5 Known Bugs

### Minor Issues

| Bug                                                    | Severity | Workaround               | Fix ETA |
| ------------------------------------------------------ | -------- | ------------------------ | ------- |
| Time distribution rounding error (±1 min)              | Low      | Manual adjust            | Q2 2025 |
| Activity descriptions sometimes truncate at 2000 chars | Low      | Email admin to extend    | Q2 2025 |
| Plan PDF footer sometimes cut off on mobile print      | Low      | Use desktop browser      | Q3 2025 |
| Arabic characters in PDF sometimes misaligned          | Medium   | Re-export/adjust spacing | Q2 2025 |

### Potential Issues (Not Yet Reported)

```
1. Very large lesson content (>5000 chars):
   - Groq timeout risk
   - Solution: Truncate to 5000 chars before sending

2. Slow mobile networks (<1 Mbps):
   - Likely timeout
   - Solution: Progressive loading, streaming responses

3. Internet Explorer 11 users:
   - Not supported (uses ES6+)
   - Solution: Document IE11 not supported
```

---

## 13.6 Maintenance & Support Plan

### Monitoring

```
Tools:
- Sentry for error tracking
- DataDog for performance monitoring
- Status page (statuspage.io) for incidents

Alerts:
- Error rate > 5%
- Response time > 5 seconds
- API down (Groq or Turso)
- Database > 2.5GB
```

### Backup Strategy

```
Database:
- Automatic daily backups (Turso built-in)
- 30-day retention
- Test restore quarterly

User Data:
- Export all plans monthly (S3)
- Encrypt PII (teacher names)
- 1-year retention

Code:
- GitHub private repo
- 2-admin access only
- Monthly code audit
```

### SLA Targets

```
Uptime: 99.5%
Response time: < 3 seconds (p95)
Error rate: < 2%
Plan generation success: > 95%
```

---

## Summary

**Current Gaps:**

- ⚠️ No student portal (Phase 3)
- ⚠️ No exam duration UI (Phase 2)
- ⚠️ Single language (English coming Phase 2)
- ⚠️ No mobile app (Phase 3)
- ⚠️ No real-time collab (Phase 4)

**Mitigation:**

- Export → Email workaround for sharing
- Manual field entry suffices for now
- Arabic-only acceptable for MVP
- Web PWA works as mobile interim
- Teachers work independently

**Roadmap:**

- Q1: Launch MVP ✅
- Q2: Phase 2 (exams, languages)
- H2: Phase 3 (students, integrations)
- 2026: Phase 4 (enterprise, premium)

---

**Next:** Read **14_REAL_WORLD_SCENARIOS.md** for end-to-end user workflows.
