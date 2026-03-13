import type {
  ApiErrorDetail,
  RefinementArtifactType,
  RefinementProposal,
  RefinementRequestRecord,
  RefinementStatus,
} from '../../types';
import {
  getLocalizedAiLimitMessage,
  type NormalizedApiError,
} from '../../utils/apiErrors';

export type SelectorOption = {
  value: string;
  label: string;
};

export type DiffChangeType = 'added' | 'removed' | 'updated';

export interface DiffItem {
  key: string;
  path: string;
  label: string;
  hint: string | null;
  before: unknown;
  after: unknown;
  changeType: DiffChangeType;
}

export interface DiffGroup {
  key: string;
  label: string;
  description: string | null;
  items: DiffItem[];
}

export interface ProposalViewModel {
  scopeLabel: string;
  summary: string;
  changeCountLabel: string;
  groups: DiffGroup[];
  warnings: string[];
  validationErrors: string[];
}

type PathToken = string | number;

type GroupMeta = {
  key: string;
  label: string;
  description: string | null;
  itemLabel: string;
  hint: string | null;
};

const EMPTY_TEXT = 'لا توجد قيمة';

const GENERIC_FIELD_LABELS: Record<string, string> = {
  id: 'الحقل',
  title: 'العنوان',
  name: 'الاسم',
  text: 'النص',
  value: 'القيمة',
  objective: 'الهدف',
  question: 'السؤال',
  description: 'الوصف',
  type: 'النوع',
  content: 'المحتوى',
  instructions: 'التعليمات',
  plan_type: 'نوع الخطة',
  lesson_title: 'عنوان الدرس',
  subject: 'المادة',
  grade: 'الصف',
  unit: 'الوحدة',
  duration_minutes: 'مدة الحصة',
  plan_json: 'محتوى الخطة',
  header: 'بيانات الحصة',
  date: 'التاريخ',
  day: 'اليوم',
  section: 'الشعبة',
  duration: 'المدة',
  intro: 'التمهيد',
  concepts: 'المفاهيم',
  learning_outcomes: 'نواتج التعلم',
  objectives: 'الأهداف التعليمية',
  teaching_strategies: 'استراتيجيات التدريس',
  activities: 'الأنشطة',
  lesson_flow: 'تدفق الدرس',
  assessment: 'التقويم',
  homework: 'الواجب',
  source: 'المصدر',
  learning_resources: 'الوسائل التعليمية',
  time: 'الزمن',
  teacher_activity: 'دور المعلم',
  student_activity: 'دور الطالب',
  activity_type: 'نوع النشاط',
  assignment_id: 'رقم الواجب',
  assignments: 'الواجبات',
  assignment_group_id: 'مجموعة الواجبات',
  questions: 'الأسئلة',
  question_text: 'نص السؤال',
  answer_text: 'الإجابة النموذجية',
  options: 'الخيارات',
  correct_option_index: 'الخيار الصحيح',
  correct_answer: 'الإجابة الصحيحة',
  rubric: 'معيار التصحيح',
  total_questions: 'عدد الأسئلة',
  total_marks: 'الدرجة الكلية',
  lesson_ids: 'الدروس المرتبطة',
  blueprint: 'خريطة الاختبار',
  feedback_text: 'نص الملاحظة',
  target_selector: 'نطاق التعديل',
  expected_base_revision_ids: 'مرجع النسخة الحالية',
};

const TARGET_SELECTOR_LABELS: Record<RefinementArtifactType, Record<string, string>> = {
  lesson_plan: {
    full_document: 'كامل الخطة',
    intro: 'التمهيد',
    learning_outcomes: 'نواتج التعلم',
    objectives: 'الأهداف التعليمية',
    teaching_strategies: 'استراتيجيات التدريس',
    activities: 'الأنشطة',
    lesson_flow: 'تدفق الدرس',
    assessment: 'التقويم',
    homework: 'الواجب',
  },
  assignment: {
    full_document: 'كامل الواجب',
    name: 'العنوان',
    description: 'الوصف',
    content: 'المحتوى',
    instructions: 'التعليمات',
  },
  exam: {
    full_document: 'كامل الاختبار',
    questions: 'الأسئلة',
    question_text: 'صياغة الأسئلة',
    answer_text: 'الإجابات',
    clarity: 'الوضوح اللغوي',
  },
};

const REVISION_SOURCE_LABELS: Record<string, string> = {
  seed: 'نسخة أولية',
  refinement_approval: 'اعتماد تحسين',
  manual_edit: 'تعديل يدوي',
  revert: 'استرجاع',
};

const STATUS_LABELS: Record<RefinementStatus, string> = {
  processing: 'قيد المعالجة',
  pending_approval: 'بانتظار الاعتماد',
  approved: 'معتمد',
  rejected: 'مرفوض',
  failed: 'فشل',
  blocked: 'محجوب',
  no_changes: 'بدون تغييرات',
};

const MESSAGE_CODE_LABELS: Record<string, string> = {
  low_intent_confidence: 'الملاحظة عامة؛ تم تطبيق أفضل تحسين ممكن ضمن القيود الحالية.',
  no_changes: 'لم ينتج عن الملاحظة تغييرات فعلية قابلة للاعتماد.',
  conflicting_intent: 'الملاحظة تحتوي على توجيهات متعارضة. عدّل الطلب وحدد المطلوب بدقة أكبر.',
  immutable_field_changed: 'حاول المقترح تعديل حقل ثابت غير قابل للتغيير ضمن هذا النوع من التحسين.',
  immutable_exam_metadata: 'لا يمكن تعديل إجماليات الاختبار أو بياناته الثابتة أثناء التحسين.',
  validation_failed: 'فشل التحقق من المقترح الحالي، لذا لا يمكن عرضه كنسخة قابلة للاعتماد.',
  candidate_missing: 'تعذر إنشاء نسخة مقترحة صالحة للعرض.',
  artifact_not_found: 'تعذر العثور على العنصر المطلوب للتحسين.',
  assignment_group_not_found: 'تعذر العثور على مجموعة الواجبات المطلوبة.',
  assignment_group_empty: 'مجموعة الواجبات المحددة لا تحتوي على عناصر.',
  plan_not_found: 'تعذر العثور على الخطة المرتبطة بهذا العنصر.',
  refinement_not_found: 'تعذر العثور على طلب التحسين.',
  revision_not_found: 'تعذر العثور على النسخة المطلوبة.',
  invalid_request_state: 'لا يمكن تنفيذ هذا الإجراء على حالة الطلب الحالية.',
  llm_generation_failed: 'تعذر على النظام توليد المقترح حالياً. حاول مرة أخرى بعد قليل.',
  llm_http_status: 'حدثت مشكلة أثناء الاتصال بخدمة التوليد.',
  forbidden: 'لا تملك صلاحية الوصول إلى هذا الطلب.',
  invalid_teacher_id: 'تعذر تحديد هوية المستخدم الحالية.',
  invalid_refinement_id: 'معرف طلب التحسين غير صالح.',
  invalid_request_body: 'البيانات المرسلة غير صالحة لتنفيذ هذا الطلب.',
  invalid_query: 'المدخلات المستخدمة في هذا الطلب غير صالحة.',
  expected_base_revision_ids: 'مرجع النسخة الحالية غير صالح.',
};

function parsePath(path: string): PathToken[] {
  if (!path || path === 'full_document') {
    return [];
  }

  const tokens: PathToken[] = [];
  const matcher = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(path)) !== null) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      tokens.push(Number(match[2]));
    }
  }

  return tokens;
}

function formatArabicNumber(value: number): string {
  return new Intl.NumberFormat('ar-SA').format(value);
}

function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(',')}}`;
}

function isMeaningfullyEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function getDiffChangeType(before: unknown, after: unknown): DiffChangeType {
  if (before === undefined && after !== undefined) {
    return 'added';
  }

  if (before !== undefined && after === undefined) {
    return 'removed';
  }

  return 'updated';
}

function getValueAtPath(source: unknown, path: string): unknown {
  if (!path || path === 'full_document') {
    return source;
  }

  const tokens = parsePath(path);
  let current: unknown = source;

  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token >= current.length) {
        return undefined;
      }
      current = current[token];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

function getFieldLabel(field: string): string {
  return GENERIC_FIELD_LABELS[field] ?? 'تفصيل إضافي';
}

function getPathLabel(path: string): string {
  const tokens = parsePath(path);
  const lastString = [...tokens].reverse().find((item): item is string => typeof item === 'string');
  return lastString ? getFieldLabel(lastString) : 'المحتوى بالكامل';
}

function localizeScalarValue(path: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  if (typeof value === 'boolean') {
    return value ? 'نعم' : 'لا';
  }

  if (typeof value === 'number') {
    return formatArabicNumber(value);
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const normalized = value.trim();
  if (!normalized) {
    return EMPTY_TEXT;
  }

  const lower = normalized.toLowerCase();

  if (path.endsWith('plan_type')) {
    if (lower === 'traditional') return 'تقليدية';
    if (lower === 'active_learning') return 'تعلم نشط';
  }

  if (path.endsWith('activity_type')) {
    if (lower === 'intro') return 'تمهيد';
    if (lower === 'presentation') return 'عرض';
    if (lower === 'activity') return 'نشاط';
    if (lower === 'assessment') return 'تقويم';
  }

  if (path.endsWith('type')) {
    if (lower === 'written') return 'كتابي';
    if (lower === 'varied') return 'متنوع';
    if (lower === 'practical') return 'عملي';
  }

  if (path.endsWith('validation_status')) {
    if (lower === 'passed') return 'ناجح';
    if (lower === 'failed') return 'فشل';
  }

  return normalized;
}

function getTargetLabel(
  artifactType: RefinementArtifactType,
  targetSelector: string | null | undefined,
  targetSelectors: SelectorOption[]
): string {
  if (!targetSelector) {
    return 'كامل المحتوى';
  }

  const fromProps = targetSelectors.find((item) => item.value === targetSelector)?.label;
  if (fromProps) {
    return fromProps;
  }

  return (
    TARGET_SELECTOR_LABELS[artifactType][targetSelector] ??
    GENERIC_FIELD_LABELS[targetSelector] ??
    'النطاق المحدد'
  );
}

export function getTargetSelectorLabel(
  artifactType: RefinementArtifactType,
  targetSelector: string | null | undefined,
  targetSelectors: SelectorOption[]
): string {
  return getTargetLabel(artifactType, targetSelector, targetSelectors);
}

function buildLessonPlanMeta(tokens: PathToken[], path: string): GroupMeta {
  if (path === 'full_document' || tokens.length === 0) {
    return {
      key: 'lesson_plan.full_document',
      label: 'الخطة بالكامل',
      description: 'تغيير عام على المحتوى كاملًا',
      itemLabel: 'المحتوى بالكامل',
      hint: null,
    };
  }

  if (tokens[0] !== 'plan_json') {
    return {
      key: 'lesson_plan.meta',
      label: 'بيانات الخطة',
      description: 'الحقول التعريفية الثابتة للخطة',
      itemLabel: getPathLabel(path),
      hint: null,
    };
  }

  const section = tokens[1];
  const index = typeof tokens[2] === 'number' ? tokens[2] : null;
  const nestedField = tokens.find((token, idx): token is string => idx >= 2 && typeof token === 'string');

  switch (section) {
    case 'header':
      return {
        key: 'plan_json.header',
        label: 'بيانات الحصة',
        description: 'المعلومات الأساسية أعلى الخطة',
        itemLabel: nestedField ? getFieldLabel(nestedField) : 'بيانات الحصة',
        hint: null,
      };
    case 'intro':
      return {
        key: 'plan_json.intro',
        label: 'التمهيد',
        description: 'النص التمهيدي لبداية الدرس',
        itemLabel: 'نص التمهيد',
        hint: null,
      };
    case 'concepts':
      return {
        key: 'plan_json.concepts',
        label: 'المفاهيم',
        description: 'المفاهيم الرئيسة المرتبطة بالدرس',
        itemLabel: index != null ? `المفهوم ${formatArabicNumber(index + 1)}` : 'المفاهيم',
        hint: null,
      };
    case 'learning_outcomes':
      return {
        key: 'plan_json.learning_outcomes',
        label: 'نواتج التعلم',
        description: 'المخرجات أو النواتج التعليمية',
        itemLabel: index != null ? `الناتج ${formatArabicNumber(index + 1)}` : 'نواتج التعلم',
        hint: null,
      };
    case 'objectives':
      return {
        key: 'plan_json.objectives',
        label: 'الأهداف التعليمية',
        description: 'الأهداف التفصيلية للحصة',
        itemLabel: index != null ? `الهدف ${formatArabicNumber(index + 1)}` : 'الأهداف التعليمية',
        hint: null,
      };
    case 'teaching_strategies':
      return {
        key: 'plan_json.teaching_strategies',
        label: 'استراتيجيات التدريس',
        description: 'الطرائق والاستراتيجيات المستخدمة',
        itemLabel:
          index != null ? `الاستراتيجية ${formatArabicNumber(index + 1)}` : 'استراتيجيات التدريس',
        hint: null,
      };
    case 'activities':
      return {
        key: 'plan_json.activities',
        label: 'الأنشطة',
        description: 'الأنشطة المقترحة داخل الحصة',
        itemLabel: index != null ? `النشاط ${formatArabicNumber(index + 1)}` : 'الأنشطة',
        hint: nestedField ? getFieldLabel(nestedField) : null,
      };
    case 'lesson_flow':
      return {
        key: 'plan_json.lesson_flow',
        label: 'تدفق الدرس',
        description: 'خطوات التنفيذ داخل الحصة',
        itemLabel: index != null ? `الخطوة ${formatArabicNumber(index + 1)}` : 'تدفق الدرس',
        hint: nestedField ? getFieldLabel(nestedField) : null,
      };
    case 'assessment':
      return {
        key: 'plan_json.assessment',
        label: 'التقويم',
        description: 'أساليب التقويم المستخدمة',
        itemLabel: index != null ? `أداة التقويم ${formatArabicNumber(index + 1)}` : 'التقويم',
        hint: null,
      };
    case 'homework':
      return {
        key: 'plan_json.homework',
        label: 'الواجب',
        description: 'تكليفات ما بعد الحصة',
        itemLabel: 'الواجب',
        hint: null,
      };
    case 'learning_resources':
      return {
        key: 'plan_json.learning_resources',
        label: 'الوسائل التعليمية',
        description: 'المصادر والوسائل المستخدمة',
        itemLabel: index != null ? `الوسيلة ${formatArabicNumber(index + 1)}` : 'الوسائل التعليمية',
        hint: null,
      };
    case 'source':
      return {
        key: 'plan_json.source',
        label: 'المصدر',
        description: 'مصدر المحتوى المستخدم',
        itemLabel: 'المصدر',
        hint: null,
      };
    default:
      return {
        key: `plan_json.${String(section ?? 'other')}`,
        label: getFieldLabel(String(section ?? 'plan_json')),
        description: null,
        itemLabel: getPathLabel(path),
        hint: null,
      };
  }
}

function buildAssignmentMeta(tokens: PathToken[], path: string): GroupMeta {
  if (path === 'full_document' || tokens.length === 0) {
    return {
      key: 'assignment.full_document',
      label: 'الواجب بالكامل',
      description: 'تغيير عام على الواجب',
      itemLabel: 'المحتوى بالكامل',
      hint: null,
    };
  }

  if (tokens[0] === 'assignments') {
    const index = typeof tokens[1] === 'number' ? tokens[1] : null;
    const nestedField = tokens.find((token, idx): token is string => idx >= 2 && typeof token === 'string');

    return {
      key: 'assignments',
      label: 'مجموعة الواجبات',
      description: 'تغييرات على عناصر المجموعة',
      itemLabel: index != null ? `الواجب ${formatArabicNumber(index + 1)}` : 'الواجبات',
      hint: nestedField ? getFieldLabel(nestedField) : null,
    };
  }

  return {
    key: String(tokens[0]),
    label: getFieldLabel(String(tokens[0])),
    description: null,
    itemLabel: getPathLabel(path),
    hint: null,
  };
}

function buildExamMeta(tokens: PathToken[], path: string): GroupMeta {
  if (path === 'full_document' || tokens.length === 0) {
    return {
      key: 'exam.full_document',
      label: 'الاختبار بالكامل',
      description: 'تغيير عام على محتوى الاختبار',
      itemLabel: 'المحتوى بالكامل',
      hint: null,
    };
  }

  if (tokens[0] === 'questions') {
    const index = typeof tokens[1] === 'number' ? tokens[1] : null;
    const nestedField = tokens.find((token, idx): token is string => idx >= 2 && typeof token === 'string');

    return {
      key: 'questions',
      label: 'الأسئلة',
      description: 'تغييرات على أسئلة الاختبار',
      itemLabel: index != null ? `السؤال ${formatArabicNumber(index + 1)}` : 'الأسئلة',
      hint: nestedField ? getFieldLabel(nestedField) : null,
    };
  }

  return {
    key: String(tokens[0]),
    label: getFieldLabel(String(tokens[0])),
    description: null,
    itemLabel: getPathLabel(path),
    hint: null,
  };
}

function getGroupMeta(artifactType: RefinementArtifactType, path: string): GroupMeta {
  const tokens = parsePath(path);

  if (artifactType === 'lesson_plan') {
    return buildLessonPlanMeta(tokens, path);
  }

  if (artifactType === 'assignment') {
    return buildAssignmentMeta(tokens, path);
  }

  return buildExamMeta(tokens, path);
}

function buildFallbackMessage(
  artifactType: RefinementArtifactType,
  path: string | undefined,
  tone: 'error' | 'warning'
): string {
  const fieldText = path ? ` في حقل ${getPathLabel(path)}` : '';
  if (tone === 'warning') {
    return `هناك ملاحظة تحتاج إلى مراجعة${fieldText}.`;
  }

  if (artifactType === 'lesson_plan') {
    return `تعذر اعتماد المقترح الحالي للخطة${fieldText}.`;
  }

  if (artifactType === 'assignment') {
    return `تعذر اعتماد المقترح الحالي للواجب${fieldText}.`;
  }

  return `تعذر اعتماد المقترح الحالي للاختبار${fieldText}.`;
}

function normalizeMessageCode(detail: Partial<ApiErrorDetail>): string {
  if (detail.code === 'candidate.missing') {
    return 'candidate_missing';
  }

  if (detail.code === 'expected_base_revision_ids') {
    return 'expected_base_revision_ids';
  }

  return detail.code ?? '';
}

function localizeDetailMessage(
  artifactType: RefinementArtifactType,
  detail: Partial<ApiErrorDetail>,
  tone: 'error' | 'warning'
): string {
  const code = normalizeMessageCode(detail);
  if (code && MESSAGE_CODE_LABELS[code]) {
    const base = MESSAGE_CODE_LABELS[code];
    if (detail.path) {
      const fieldLabel = getPathLabel(detail.path);
      if (
        code === 'immutable_field_changed' ||
        code === 'candidate_missing' ||
        code === 'expected_base_revision_ids'
      ) {
        return `${base} الحقل المعني: ${fieldLabel}.`;
      }
    }
    return base;
  }

  if (typeof detail.message === 'string' && isArabicText(detail.message)) {
    return detail.message.trim();
  }

  return buildFallbackMessage(artifactType, detail.path, tone);
}

function dedupeMessages(messages: string[]): string[] {
  return [...new Set(messages.filter((item) => item.trim().length > 0))];
}

export function getStatusLabel(status: RefinementStatus): string {
  return STATUS_LABELS[status] ?? 'غير معروف';
}

export function getRevisionSourceLabel(source: string): string {
  return REVISION_SOURCE_LABELS[source] ?? 'نسخة محفوظة';
}

export function formatDateTimeAr(value: string): string {
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function buildRequestSummary(params: {
  artifactType: RefinementArtifactType;
  request: RefinementRequestRecord;
  proposal: RefinementProposal | null;
  targetSelectors: SelectorOption[];
}): string {
  const { artifactType, request, proposal, targetSelectors } = params;
  const scopeLabel = getTargetLabel(artifactType, request.target_selector, targetSelectors);
  const changedCount = proposal?.changed_fields?.length ?? 0;

  switch (request.status) {
    case 'processing':
      return `يجري تجهيز مقترح التحسين الآن ضمن نطاق ${scopeLabel}.`;
    case 'pending_approval':
      return `تم تجهيز مقترح يتضمن ${formatArabicNumber(changedCount)} تغييرات ضمن ${scopeLabel}.`;
    case 'approved':
      return 'تم اعتماد المقترح وتحديث المستند بنجاح.';
    case 'rejected':
      return 'تم رفض المقترح والإبقاء على النسخة الحالية من المستند.';
    case 'failed':
      return `تعذر تجهيز مقترح صالح للاعتماد ضمن ${scopeLabel}.`;
    case 'blocked':
      return 'تم إيقاف الطلب لأن الملاحظة تحتاج إلى توضيح أدق قبل إعادة المحاولة.';
    case 'no_changes':
      return 'لم تنتج عن الملاحظة تغييرات فعلية يمكن اعتمادها.';
    default:
      return 'تم تحديث حالة الطلب.';
  }
}

export function buildProposalViewModel(params: {
  artifactType: RefinementArtifactType;
  request: RefinementRequestRecord | null;
  proposal: RefinementProposal;
  baseArtifact: Record<string, unknown> | null;
  targetSelectors: SelectorOption[];
}): ProposalViewModel {
  const { artifactType, request, proposal, baseArtifact, targetSelectors } = params;
  const candidateArtifact = proposal.candidate_artifact ?? {};
  const pathList = proposal.changed_fields?.length > 0 ? proposal.changed_fields : [];
  const groupMap = new Map<string, DiffGroup>();

  for (const path of pathList) {
    const before = getValueAtPath(baseArtifact ?? {}, path);
    const after = getValueAtPath(candidateArtifact, path);

    if (isMeaningfullyEqual(before, after)) {
      continue;
    }

    const meta = getGroupMeta(artifactType, path);
    const currentGroup = groupMap.get(meta.key) ?? {
      key: meta.key,
      label: meta.label,
      description: meta.description,
      items: [],
    };

    currentGroup.items.push({
      key: path,
      path,
      label: meta.itemLabel,
      hint: meta.hint,
      before,
      after,
      changeType: getDiffChangeType(before, after),
    });

    groupMap.set(meta.key, currentGroup);
  }

  const groups = [...groupMap.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ar'));

  const scopeLabel = getTargetLabel(artifactType, request?.target_selector, targetSelectors);
  const changeCount = groups.reduce((count, group) => count + group.items.length, 0);
  const summary =
    changeCount > 0
      ? `تم رصد ${formatArabicNumber(changeCount)} تغييرات مقترحة ضمن ${scopeLabel}.`
      : `لا توجد تغييرات قابلة للعرض ضمن ${scopeLabel}.`;

  return {
    scopeLabel,
    summary,
    changeCountLabel: `${formatArabicNumber(changeCount)} تغييرات`,
    groups,
    warnings: localizeDetails(artifactType, proposal.warnings ?? [], 'warning'),
    validationErrors: localizeDetails(
      artifactType,
      proposal.validation_result?.errors ?? [],
      'error'
    ),
  };
}

export function localizeDetails(
  artifactType: RefinementArtifactType,
  details: Array<Partial<ApiErrorDetail>>,
  tone: 'error' | 'warning'
): string[] {
  return dedupeMessages(details.map((detail) => localizeDetailMessage(artifactType, detail, tone)));
}

export function localizeApiError(
  artifactType: RefinementArtifactType,
  error: NormalizedApiError | null
): string[] {
  if (!error) {
    return [];
  }

  const localizedAiLimitMessage = getLocalizedAiLimitMessage(error);
  if (localizedAiLimitMessage) {
    return [localizedAiLimitMessage];
  }

  const detailMessages = Array.isArray(error.details)
    ? localizeDetails(artifactType, error.details as Array<Partial<ApiErrorDetail>>, 'error')
    : [];

  if (detailMessages.length > 0) {
    return detailMessages;
  }

  if (error.code && MESSAGE_CODE_LABELS[error.code]) {
    return [MESSAGE_CODE_LABELS[error.code]];
  }

  if (typeof error.message === 'string' && isArabicText(error.message)) {
    return [error.message.trim()];
  }

  return [buildFallbackMessage(artifactType, undefined, 'error')];
}

export function localizeSuccessMessage(message: string | null): string | null {
  if (!message) {
    return null;
  }

  return isArabicText(message) ? message : 'تم تنفيذ الإجراء بنجاح.';
}

export function getDisplayValueLabel(path: string): string {
  return getPathLabel(path);
}

export function formatInlineValue(path: string, value: unknown): string {
  return localizeScalarValue(path, value);
}
