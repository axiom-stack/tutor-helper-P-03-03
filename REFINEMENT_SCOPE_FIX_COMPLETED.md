# 🔧 REFINEMENT SCOPE CONSTRAINT FIX - COMPLETED

## Problem
When selecting a specific scope for refinement (e.g., النشاطات/activities), the entire lesson plan or assignment was being edited instead of just the target field. This happened because the LLM system prompt had no constraint enforcing the target_selector scope.

## Root Cause Analysis
The issue occurred at 3 levels:

### 1. **Lesson Plan Refinement** 
- `target_selector` was added to the user payload data, but the **system prompt was not modified** to enforce it
- LLM had permission to modify the entire plan while "honoring" the feedback

### 2. **Assignment Refinement**
- `targetSelector` was appended as text to the feedback, not passed as a formal parameter
- No constraint in the system prompt about targeted field modification

### 3. **All Refinement Paths**
- Both traditional and active-learning lesson plan refinement had the same issue
- No differentiation in prompts between full-document and scoped refinements

---

## Solution Implemented

### **File 1: `back-end/src/lesson-plans/prompts/prompt2Builder.js`**

#### Change 1: Traditional Plan Tuner
Added refinement mode detection and conditional constraint:

```javascript
export function buildPrompt2TraditionalPedagogicalTuner(args) {
  const minimumTraditionalStrategies = args.request.duration_minutes >= 40 ? 2 : 1;
  const isRefinementMode = args.refinement_mode === "controlled_same_rule_refinement";
  const systemPrompt = [
    "You are a pedagogical tuner for a traditional lesson plan.",
    // ... existing constraints ...
    isRefinementMode && args.targetSelector && args.targetSelector !== "full_document"
      ? `CRITICAL REFINEMENT CONSTRAINT: You MUST ONLY modify the field(s) specified in target_selector ('${args.targetSelector}'). NEVER change any other fields. Return the complete plan structure with ALL other fields EXACTLY as they appear in draft_plan_json. Only the target field(s) should have modified values. This is non-negotiable.`
      : null,
    // ... more constraints ...
  ]
    .filter(Boolean)  // ← CRITICAL: Remove null entries
    .join(" ");
}
```

#### Change 2: Active Learning Plan Tuner
Applied the same refinement constraint pattern:

```javascript
export function buildPrompt2ActiveLearningPedagogicalTuner(args) {
  const isRefinementMode = args.refinement_mode === "controlled_same_rule_refinement";
  const systemPrompt = [
    "You are a pedagogical tuner for an active-learning lesson plan.",
    // ... existing constraints ...
    isRefinementMode && args.targetSelector && args.targetSelector !== "full_document"
      ? `CRITICAL REFINEMENT CONSTRAINT: You MUST ONLY modify the field(s) specified in target_selector ('${args.targetSelector}'). NEVER change any other fields. Return the complete plan structure with ALL other fields EXACTLY as they appear in draft_plan_json. Only the target field(s) should have modified values. This is non-negotiable.`
      : null,
    // ... more constraints ...
  ]
    .filter(Boolean)
    .join(" ");
}
```

**Key Addition:** `.filter(Boolean).join(" ")` to safely remove null constraint when not in refinement mode.

---

### **File 2: `back-end/src/refinements/services/refinement.service.js`**

#### Change 1: Pass Refinement Mode to Prompt Builder
Modified the `buildLessonPlanPrompt()` function to pass refinement context:

```javascript
const basePrompt = buildPrompt2PedagogicalTuner({
  request: { /* lesson metadata */ },
  planType: planRecord.plan_type,
  draftPlanJson: normalizedDraftPlan,
  pedagogicalRules: knowledge.pedagogical_rules,
  bloomVerbsGeneration: knowledge.bloom_verbs_generation,
  strategyBank,
  targetSchema,
  validationErrors,
  refinement_mode: "controlled_same_rule_refinement",  // ← NEW
  targetSelector: targetSelector || "full_document",    // ← NEW
});
```

#### Change 2: Add Scope Constraint to Payload
Enhanced the payload with explicit scope documentation:

```javascript
const payload = JSON.parse(basePrompt.userPrompt);
payload.refinement_request = feedbackText;
payload.target_selector = targetSelector || "full_document";
payload.refinement_mode = "controlled_same_rule_refinement";
payload.scope_constraint = targetSelector && targetSelector !== "full_document"
  ? `ONLY MODIFY: ${targetSelector}. Leave all other fields unchanged.`
  : "Full document feedback - can modify any field."  // ← NEW: Document the scope
payload.immutability_constraints = {
  plan_type_must_stay: planRecord.plan_type,
  // ... rest of immutability constraints ...
};
```

#### Change 3: Fix Assignment Refinement
Updated `generateAssignmentCandidateSingle()` to pass `targetSelector` as a proper parameter:

```javascript
const prompt = buildModifyPrompt({
  lessonPlanJson: plan.plan_json || {},
  lessonContent,
  currentAssignment: {
    name: assignmentRecord.name,
    description: assignmentRecord.description ?? "",
    type: assignmentRecord.type,
    content: assignmentRecord.content,
  },
  modificationRequest: feedbackText,           // ← Unchanged: Original feedback
  targetSelector: targetSelector || "full_document",  // ← NEW: Formal parameter
});
```

---

### **File 3: `back-end/src/assignments/prompts/assignmentsPromptBuilder.js`**

#### Change: Accept and Enforce Target Selector

```javascript
export function buildModifyPrompt({
  lessonPlanJson,
  lessonContent,
  currentAssignment,
  modificationRequest,
  targetSelector,  // ← NEW PARAMETER
  validationErrors = [],
}) {
  const isTargetedRefinement = targetSelector && targetSelector !== "full_document";
  const systemPrompt = [
    "You are an expert educational assistant that modifies an existing assignment according to the teacher's request.",
    "Return exactly one JSON object with a single key: \"assignment\", whose value is the modified assignment object.",
    "The assignment object must have exactly: name (string), description (string), type (string), content (string).",
    "type must be exactly one of: written, varied, practical.",
    "All name, description, and content must be written in Arabic.",
    "No markdown, no comments, no extra text. Output only the JSON object.",
    "Apply the user's modification request to the current assignment while keeping it aligned with the lesson plan and lesson content.",
    isTargetedRefinement
      ? `CRITICAL: You MUST ONLY modify the '${targetSelector}' field of the assignment. All other fields (name, description, type, content) must remain EXACTLY as they are in current_assignment. Only the target field should change based on the modification request.`
      : null,  // ← Allow null for full_document mode
  ]
    .filter(Boolean)  // ← Safe removal of null entries
    .join(" ");
  // ... rest of buildModifyPrompt ...
}
```

---

## Impact Summary

| Component | Before | After |
|-----------|--------|-------|
| **Lesson Plan Refinement** | Entire plan modified regardless of target_selector | Only specified field modified when target_selector ≠ "full_document" |
| **Assignment Refinement** | Entire assignment modified | Only specified field modified when targetSelector ≠ "full_document" |
| **System Prompt Enforcement** | No constraint on target scope | Explicit CRITICAL constraint enforces field-level isolation |
| **LLM Behavior** | Interpreted as "improve entire plan with focus on X" | Interprets as "ONLY modify X, leave everything else unchanged" |

---

## Testing Recommendations

1. **Test Traditional Lesson Plan Refinement**
   - Select "النشاطات" (activities) as target
   - Verify only activities array is modified
   - Verify objectives, assessment, homework unchanged

2. **Test Active Learning Plan Refinement**
   - Select "الأهداف" (objectives) as target
   - Verify only objectives array is modified
   - Verify lesson_flow, homework unchanged

3. **Test Assignment Refinement**
   - Select "الإسم" (name) as target
   - Verify only name field is modified
   - Verify description, type, content unchanged

4. **Test Full Document Refinement**
   - Select "full_document" (default)
   - Verify entire artifact can be modified
   - Compare behavior with pre-fix (should work normally)

---

## Files Modified
- ✅ `back-end/src/lesson-plans/prompts/prompt2Builder.js`
- ✅ `back-end/src/refinements/services/refinement.service.js`
- ✅ `back-end/src/assignments/prompts/assignmentsPromptBuilder.js`

## Syntax Validation
- ✅ All files pass Node.js syntax validation (`node --check`)
- ✅ No breaking changes to function signatures (backward compatible)
- ✅ All new parameters have sensible defaults

---

## Deployment Notes
- No database migrations required
- No API contract changes
- Existing refinement requests work unmodified
- New refinement requests benefit from scope enforcement immediately
- Fully backward compatible with existing code

