# Exam Export Logo Debug Runbook

## What is instrumented
- Shared resolver: `src/export/schoolLogoResolver.js`
- Exam export diagnostics headers:
  - `X-Exam-Logo-Status`
  - `X-Exam-Logo-Source`
  - `X-Exam-Logo-Reason`
  - `X-Exam-Logo-Recovered`
  - `X-Exam-Logo-Fallback`

## Status meanings
- `ok`: logo was already valid and rendered.
- `recovered`: logo was repaired/normalized (for example converted to PNG).
- `missing`: no logo value was present.
- `invalid`: a logo value existed but could not be decoded/parsed as image data.

## Fast production checks
1. Call any exam export endpoint and inspect response headers.
2. If `X-Exam-Logo-Fallback=1`, check `X-Exam-Logo-Reason`.
3. Confirm the exporting exam belongs to the expected teacher (`teacher_id`) and that teacher has a profile logo.

## Data audit and cleanup
- Audit only:
```bash
npm run logo:audit
```

- Apply normalization/cleanup:
```bash
npm run logo:cleanup
```

Notes:
- Recoverable logos are normalized to canonical PNG data URLs.
- Invalid logos are reported and left unchanged.
- Empty string values are normalized to `NULL`.

## Template validation
- DOCX template logo placeholder is checked automatically in `renderExamDocxFromTemplate`.
- Supported school-logo tags include:
  - `{{school_logo}}`
  - `{{%school_logo}}`
  - `{{%%school_logo}}`
  - `{{school_logo%%}}`
- The parser tolerates extra whitespace and bidi control chars around the token.
- Optional strict mode:
```bash
EXAM_DOCX_STRICT_LOGO_PLACEHOLDER=1
```
When enabled, export fails fast if no school-logo placeholder is present in the template.

## Question overflow behavior (DOCX paper)
- If the template uses fixed slots (for example `tf_1_text`, `tf_2_text`, `tf_3_text`) and the exam has more questions than slots, the system automatically falls back to the dynamic JS DOCX builder so no questions are dropped.
- If you want unlimited questions while staying fully template-driven, use loop tags in the template such as:
  - `{{#true_false_questions}} ... {{/true_false_questions}}`
  - `{{#mcq_questions}} ... {{/mcq_questions}}`
  - `{{#fill_blank_questions}} ... {{/fill_blank_questions}}`
  - `{{#written_questions}} ... {{/written_questions}}`

## Python DOCX path
- Python generator now supports embedding logo from `examMeta.schoolLogoUrl`.
- If image decode fails, Python output shows text placeholder (`شعار المدرسة`) instead of crashing export.
