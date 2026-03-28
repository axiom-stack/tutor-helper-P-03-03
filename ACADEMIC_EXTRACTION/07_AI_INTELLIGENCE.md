# 7. AI INTELLIGENCE SYSTEM (LLM INTEGRATION)

## 7.1 Groq API Integration

### Groq Client Setup

```typescript
import Groq from "groq-sdk";

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 1,
});

// Model Configuration
export const GROQ_PROMPT1_MODEL = "llama-3.3-70b-versatile"; // Draft generation
export const GROQ_PROMPT1_MODEL_RETRY = "mixtral-8x7b-32768"; // Fallback model
export const GROQ_PROMPT2_MODEL = "llama-3.3-70b-versatile"; // Tuning
export const GROQ_PROMPT2_MODEL_RETRY = "mixtral-8x7b-32768"; // Fallback

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
) {
  try {
    const response = await groqClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7, // For creativity in generation
      max_tokens: 4000,
      top_p: 0.9,
      stop: null,
    });

    return {
      success: true,
      output: response.choices[0].message.content,
      usage: {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
      },
    };
  } catch (error) {
    if (error.code === "RATE_LIMIT_EXCEEDED") {
      throw new Error("Groq API rate limit exceeded");
    }
    if (error.code === "TIMEOUT") {
      throw new Error("Groq API timeout (30s)");
    }
    throw error;
  }
}
```

---

## 7.2 Two-Stage Prompt Pipeline

### Prompt 1: Draft Generation (Creativity Phase)

**Purpose:** Generate initial, creative lesson plan structure

**System Prompt:**

```
أنت مصمم تعليمي متخصص في مناهج التعليم الأساسي بالجمهورية اليمنية.
مهمتك: إنشاء خطط دروس تعليمية فعالة ومبتكرة.

المتطلبات:
1. استخدم صيغة أهداف عملية واضحة (SMART)
2. اتبع توزيع الوقت: 10% مقدمة، 60% نشاط رئيسي، 20% إغلاق، 10% تقييم
3. استخدم أفعال بلوم في الأهداف (تذكر، فهم، تطبيق، تحليل، تقييم، إبداع)
4. النتيجة: يجب أن تكون JSON صحيح ومنسق

الشروط:
- استخدم أفعال من قائمة بلوم فقط
- لا تستخدم: "يعرف"، "يفهم"، "يحب" (محظورة)
- جميع الأهداف يجب أن تكون قابلة للقياس
- استخدم 3 مجالات تعليمية: معرفي، وجداني، مهاري
```

**User Prompt Template:**

```
إنشاء خطة درس لمقرر تعليمي:

المعلومات:
- العنوان: [LESSON_TITLE]
- المحتوى: [LESSON_CONTENT]
- المادة: [SUBJECT]
- الصف: [GRADE]
- المدة: [DURATION_MINUTES] دقيقة
- نوع الخطة: [PLAN_TYPE]

الأهداف المطلوبة:
- 3-5 أهداف تعليمية (موزعة على مستويات بلوم)
- 7-10 أنشطة تعليمية متنوعة
- طرق تقييم متعددة (2+)
- موارد تعليمية (3+)

أفعال بلوم المسموحة:
- الذاكرة: تذكر، حدد، اذكر، اختر، ألخص
- الفهم: شرح، وصف، ترجم، فسر، أعط أمثلة
- التطبيق: استخدم، طبق، حل، أنظم، اختبر
- التحليل: حلل، ميز، صنف، ربط، قارن
- التقييم: قيم، انقد، حكم، ناقش، برر
- الإبداع: ابتكر، صمم، اقترح، أنشئ، طور

الصيغة المطلوبة (JSON):
{
  "objectives": [
    {
      "description": "...",
      "bloom_level": "Remember|Understand|Apply|Analyze|Evaluate|Create",
      "domain": "معرفي|وجداني|مهاري"
    }
  ],
  "activities": [
    {
      "title": "...",
      "description": "...",
      "duration_minutes": 10,
      "teaching_method": "..."
    }
  ],
  "assessment": {
    "methods": ["طريقة 1", "طريقة 2"],
    "timing": "..."
  },
  "resources": ["مورد 1", "مورد 2", "مورد 3"],
  "timing_breakdown": {
    "intro_minutes": [INTRO_MINS],
    "main_minutes": [MAIN_MINS],
    "closing_minutes": [CLOSING_MINS],
    "assessment_minutes": [ASSESSMENT_MINS]
  }
}

تذكر: الرد يجب أن يكون JSON صحيح فقط، بدون نص إضافي.
```

### Prompt 2: Pedagogical Tuning (Quality Assurance Phase)

**Purpose:** Validate & refine draft against pedagogical rules

**System Prompt:**

```
أنت خبير تربوي متخصص في تقييم وتحسين خطط الدروس.
مهمتك: مراجعة خطة درس ضمان امتثالها للمعايير التربوية.

معايير التقييم الأساسية:
1. صحة أفعال بلوم (من القائمة المعتمدة فقط)
2. توزيع الوقت (10-60-20-10%)
3. قابلية قياس الأهداف (SMART)
4. تنوع الأنشطة التعليمية
5. ملاءمة العمر والمستوى الدراسي
6. توازن المجالات التعليمية الثلاثة

مهام التحسين:
- صحح أي أفعال غير صحيحة
- اضبط توزيع الوقت إذا لم يطابق النسب
- حسّن صيغة الأهداف لتكون أكثر وضوحاً
- أضف أنشطة إضافية إذا كانت ناقصة
- حقق من توازن المجالات

ملاحظة مهمة:
- لا تحذف أي أقسام من الخطة
- لا تغير الهيكل الأساسي
- حسّن المحتوى فقط
```

**User Prompt Template:**

```
راجع وحسّن خطة الدرس التالية:

[FULL_DRAFT_JSON]

معايير الامتثال:

1. أفعال بلوم:
   - المسموح: تذكر، فهم، تطبيق، تحليل، تقييم، إبداع
   - المحظور: يعرف، يفهم، يحب، يجب أن يعرف
   ✓ تحقق من كل هدف

2. توزيع الوقت (للمدة: [DURATION] دقيقة):
   - مقدمة: 10%
   - النشاط الرئيسي: 60%
   - الإغلاق: 20%
   - التقييم: 10%
   ✓ اضبط إذا لزم

3. معايير الأهداف:
   - محدد: يصف نتاجاً واضحاً
   - قابل للقياس: يتضمن فعل قابل للملاحظة
   - الصلة: يرتبط بمحتوى الدرس
   ✓ حسّن وضوح كل هدف

4. الأنشطة:
   - العدد: 7+ أنشطة
   - التنوع: استخدم 3+ طرق تدريس
   ✓ تحقق من التنوع

5. التقييم:
   - الطرق: 2+ طرق تقييم
   - التوقيت: موضح بوضوح
   ✓ تأكد من الوجود

6. المجالات:
   - معرفي: 40-50%
   - وجداني: 20-30%
   - مهاري: 20-30%
   ✓ حقق التوازن

أعد JSON محسّن، مع الحفاظ على البنية الأصلية.
```

---

## 7.3 Validation & Error Handling

### LLM Output Validation

```typescript
export function validatePrompt1Output(rawOutput: string): LessonPlanJSON {
  // 1. Extract JSON
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  // 2. Parse
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error("Invalid JSON: " + error.message);
  }

  // 3. Validate structure
  if (!parsed.objectives || !Array.isArray(parsed.objectives)) {
    throw new Error("Missing or invalid objectives array");
  }

  if (!parsed.activities || !Array.isArray(parsed.activities)) {
    throw new Error("Missing or invalid activities array");
  }

  if (!parsed.assessment || typeof parsed.assessment !== "object") {
    throw new Error("Missing or invalid assessment object");
  }

  if (!parsed.resources || !Array.isArray(parsed.resources)) {
    throw new Error("Missing or invalid resources array");
  }

  // 4. Validate objectives
  for (const obj of parsed.objectives) {
    if (!obj.description || typeof obj.description !== "string") {
      throw new Error("Invalid objective description");
    }

    if (!VALID_BLOOM_LEVELS.includes(obj.bloom_level)) {
      throw new Error(`Invalid Bloom level: ${obj.bloom_level}`);
    }

    if (!["معرفي", "وجداني", "مهاري"].includes(obj.domain)) {
      throw new Error(`Invalid domain: ${obj.domain}`);
    }
  }

  // 5. Validate activities
  if (parsed.activities.length < 7) {
    throw new Error(
      `Insufficient activities (${parsed.activities.length} < 7)`,
    );
  }

  // 6. Validate assessment
  if (parsed.assessment.methods.length < 2) {
    throw new Error("At least 2 assessment methods required");
  }

  return parsed;
}
```

### Retry Strategy

```typescript
export async function generatePlanWithRetries(params: GeneratePlanParams) {
  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Prompt 1
      const draftResult = await callGroq(
        PROMPT1_SYSTEM,
        buildPrompt1User(params),
        attempt === 1 ? GROQ_PROMPT1_MODEL : GROQ_PROMPT1_MODEL_RETRY,
      );

      const draftJSON = validatePrompt1Output(draftResult.output);

      // Prompt 2
      const tuningResult = await callGroq(
        PROMPT2_SYSTEM,
        buildPrompt2User(draftJSON, params),
        GROQ_PROMPT2_MODEL,
      );

      const tuningJSON = validatePrompt2Output(tuningResult.output);

      // Validation
      const validationResult = validatePlan(tuningJSON);
      if (validationResult.passed) {
        return tuningJSON;
      }

      // Guided retry for validation failures
      if (attempt < maxRetries) {
        const guidedResult = await callGroq(
          GUIDED_RETRY_SYSTEM,
          buildGuidedRetryPrompt(tuningJSON, validationResult.violations),
          GROQ_PROMPT2_MODEL,
        );
        const fixedJSON = validatePrompt1Output(guidedResult.output);
        return fixedJSON;
      }

      return tuningJSON; // Best effort
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw new Error(
          `Plan generation failed after ${maxRetries} attempts: ${lastError.message}`,
        );
      }

      // Wait before retry
      await sleep(2000);
    }
  }

  throw lastError;
}
```

---

## 7.4 Knowledge Base Integration

### Embedded Pedagogical Rules

**Source:** `back-end/src/constants/promptsHelper.js`

```typescript
export const PEDAGOGICAL_RULES = {
  // 1. Objectives Rules
  objectives: {
    bloomVerbs: {
      Remember: ['تذكر', 'حدد', 'اذكر', 'اختر', 'الصق', 'أكمل'],
      Understand: ['شرح', 'وصف', 'ترجم', 'فسر', 'أعط أمثلة', 'اقترح'],
      Apply: ['استخدم', 'طبق', 'حل', 'أنظم', 'اختبر', 'بنِ'],
      Analyze: ['حلل', 'ميز', 'صنف', 'ربط', 'قارن', 'فصل'],
      Evaluate: ['قيم', 'انقد', 'حكم', 'ناقش', 'برر', 'نظم'],
      Create: ['ابتكر', 'صمم', 'اقترح', 'أنشئ', 'طور', 'ركب']
    },
    forbiddenVerbs: ['يعرف', 'يفهم', 'يحب', 'يجب، 'يتعلم'],
    minWords: 5,
    maxWords: 20,
    requiredProperties: ['description', 'bloom_level', 'domain']
  },

  // 2. Time Distribution
  timing: {
    intro: { target: 10, range: [8, 12] },
    main: { target: 60, range: [57, 63] },
    closing: { target: 20, range: [18, 22] },
    assessment: { target: 10, range: [8, 12] },
    minLessonDuration: 30,
    maxLessonDuration: 120
  },

  // 3. Activities
  activities: {
    minimum: 7,
    teachingMethods: [
      'النقاش',
      'السؤال والجواب',
      'العمل الجماعي',
      'الألعاب التعليمية',
      'العروض العملية',
      'البحث والاستكشاف',
      'المشاريع'
    ]
  },

  // 4. Assessment
  assessment: {
    minimumMethods: 2,
    validMethods: [
      'ملاحظة',
      'تفاعل شفهي',
      'اختبار قصير',
      'عمل جماعي',
      'ملف الإنجاز',
      'تقييم ذاتي'
    ]
  },

  // 5. Domain Distribution
  domains: {
    معرفي: { min: 35, max: 50 },
    وجداني: { min: 20, max: 35 },
    مهاري: { min: 20, max: 35 }
  },

  // 6. Education Context
  context: {
    country: 'Yemen',
    language: 'Arabic',
    ageGroups: [
      'الأول الابتدائي (6-7 سنوات)',
      'الثاني الابتدائي (7-8 سنوات)',
      '... إلخ'
    ],
    subjects: ['القرآن', 'العربية', 'الإنجليزية', 'الرياضيات', 'العلوم', '...']
  }
};
```

---

## 7.5 Prompt Optimization Techniques

### Semantic Segmentation

```typescript
// Break lesson content into semantic chunks for better LLM processing
export function segmentLessonContent(content: string): string[] {
  const sentences = content.split(/[.!?]+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length < 300) {
      currentChunk += sentence + ". ";
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence + ". ";
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}
```

### Few-Shot Examples in Prompts

```typescript
// Include working examples in prompts (improves quality)
const EXAMPLE_OBJECTIVE = {
  description: "يصنّف الطالب أنواع المثلثات حسب الزوايا",
  bloom_level: "Analyze",
  domain: "معرفي",
};

const EXAMPLE_ACTIVITY = {
  title: "نشاط جماعي: تصنيف المثلثات",
  description: "يعمل الطلاب في مجموعات لتصنيف صور مثلثات مختلفة",
  duration_minutes: 15,
  teaching_method: "العمل الجماعي",
};
```

---

## 7.6 Cost & Performance Optimization

### Token Budget Management

```typescript
// Estimate tokens before sending to LLM
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 Arabic characters
  return Math.ceil(text.length / 4);
}

// Dynamic model selection based on content size
export function selectModel(contentSize: number): string {
  if (contentSize < 500) {
    return GROQ_PROMPT2_MODEL; // Faster model for small inputs
  } else if (contentSize < 1500) {
    return GROQ_PROMPT1_MODEL; // Standard model
  } else {
    return GROQ_PROMPT1_MODEL; // Fallback (same model)
  }
}
```

### Caching Strategy

```typescript
// Cache identical requests to avoid redundant LLM calls
const promptCache = new Map<string, CachedResponse>();

export async function callGroqWithCache(
  systemPrompt: string,
  userPrompt: string,
): Promise<GroqResponse> {
  const cacheKey = `${systemPrompt}:${userPrompt}`;

  if (promptCache.has(cacheKey)) {
    const cached = promptCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      // 24 hours
      return cached.response;
    }
  }

  const response = await callGroq(systemPrompt, userPrompt, GROQ_PROMPT1_MODEL);
  promptCache.set(cacheKey, {
    response,
    timestamp: Date.now(),
  });

  return response;
}
```

---

## Summary

The AI Intelligence system:

- **Two-Stage Pipeline:** Draft generation → Pedagogical tuning
- **Groq Integration:** Using llama-3.3-70b with fallback models
- **Comprehensive Validation:** Structure, Bloom taxonomy, time distribution
- **Guided Retries:** Automatic fixing of validation issues
- **Knowledge-Based:** 14 pedagogical rules embedded in prompts
- **Optimized:** Token management, caching, cost-aware model selection

---

**Next:** Read **08_EXPORT_SYSTEM.md** for PDF/Word generation.
