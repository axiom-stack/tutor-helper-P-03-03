/**
 * Single place for user-facing Arabic error wording.
 * Every message should say what happened and what the user can do next.
 * The backend still answers many requests in English; those are translated here.
 */

export const NETWORK_ERROR_MESSAGE =
  'تعذر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة. إذا كان الاتصال يعمل، فانتظر دقيقة لأن الخادم قد يكون متوقفًا مؤقتًا.';

export const SESSION_EXPIRED_MESSAGE =
  'انتهت جلسة العمل. سجّل الدخول مرة أخرى للمتابعة.';

const NO_ACCESS_MESSAGE =
  'ليس لديك صلاحية للوصول إلى هذا العنصر. تأكد أنه يخص حسابك.';

export const SERVER_ERROR_MESSAGE =
  'حدث خطأ داخل الخادم. أعد المحاولة بعد قليل، وإذا تكرر الخطأ فتواصل مع مسؤول النظام.';

const SERVICE_UNAVAILABLE_MESSAGE =
  'الخادم غير متاح مؤقتًا (ربما يعيد التشغيل). انتظر دقيقة ثم أعد المحاولة.';

export const STATUS_MESSAGES: Record<number, string> = {
  400: 'بعض البيانات المرسلة غير صحيحة. راجع الحقول ثم أعد المحاولة.',
  401: SESSION_EXPIRED_MESSAGE,
  403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء. تواصل مع مسؤول النظام إذا كنت تحتاج إليها.',
  404: 'العنصر المطلوب غير موجود، وربما حُذف. حدّث الصفحة ثم أعد المحاولة.',
  408: 'استغرق الطلب وقتًا طويلًا. أعد المحاولة.',
  409: 'تعذر تنفيذ العملية لأنها تتعارض مع بيانات محفوظة. حدّث الصفحة وراجع البيانات.',
  413: 'حجم الملف أو البيانات المرسلة كبير جدًا. استخدم ملفًا أصغر.',
  415: 'نوع الملف غير مدعوم.',
  422: 'تعذر إكمال الطلب بالبيانات الحالية. راجع البيانات ثم أعد المحاولة.',
  429: 'أرسلت طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.',
  500: SERVER_ERROR_MESSAGE,
  502: SERVICE_UNAVAILABLE_MESSAGE,
  503: SERVICE_UNAVAILABLE_MESSAGE,
  504: 'استغرق الخادم وقتًا أطول من المسموح. حدّث الصفحة للتأكد من عدم حفظ النتيجة، ثم أعد المحاولة.',
};

export const AI_RATE_LIMIT_MESSAGE =
  'وصلت خدمة الذكاء الاصطناعي إلى حد الاستخدام المؤقت. انتظر قليلًا ثم أعد المحاولة.';

export function isArabicText(value: string): boolean {
  return /[؀-ۿ]/.test(value);
}

export interface RawDetail {
  code?: unknown;
  path?: unknown;
  field?: unknown;
  message?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/* ------------------------------ AI failures ------------------------------ */

function formatWait(seconds: number): string {
  if (seconds === 1) return 'ثانية واحدة';
  if (seconds === 2) return 'ثانيتين';
  return seconds <= 10 ? `${seconds} ثوانٍ` : `${seconds} ثانية`;
}

/**
 * Explains an `llm_generation_failed` response. The backend sends the failure
 * kind as the first detail code, plus optional status / retry-after entries.
 */
export function describeAiFailure(details: RawDetail[]): string {
  const find = (code: string) =>
    text(details.find((item) => item?.code === code)?.message);
  const has = (code: string) => details.some((item) => item?.code === code);

  const status = Number(/\d{3}/.exec(find('llm_http_status'))?.[0] ?? 0);
  const apiMessage = find('api_error');

  if (has('truncated_output')) {
    return 'النتيجة المطلوبة أطول من أن تُولَّد دفعة واحدة. قلّل حجم الطلب (عدد الأسئلة أو الدروس أو طول المحتوى) ثم أعد المحاولة.';
  }
  if (has('timeout')) {
    return 'استغرقت خدمة الذكاء الاصطناعي وقتًا أطول من المسموح. أعد المحاولة، وإذا تكرر ذلك فقلّل المطلوب.';
  }
  if (has('malformed_json')) {
    return 'أرسلت خدمة الذكاء الاصطناعي ردًا غير مكتمل أو غير صالح. أعد المحاولة.';
  }
  // 413 is checked before 429: oversized requests also mention token limits.
  if (status === 413) {
    return 'الطلب كبير جدًا على خدمة الذكاء الاصطناعي. قلّل حجم الطلب (عدد الدروس أو طول المحتوى) ثم أعد المحاولة.';
  }
  if (status === 429) {
    const seconds = Number(/[\d.]+/.exec(find('llm_retry_after'))?.[0] ?? 0);
    if (seconds > 0) {
      return `وصلت خدمة الذكاء الاصطناعي إلى حد الاستخدام المؤقت. أعد المحاولة بعد ${formatWait(Math.ceil(seconds))} تقريبًا.`;
    }
    return AI_RATE_LIMIT_MESSAGE;
  }
  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    /GROQ_API_KEY|مفتاح/i.test(apiMessage)
  ) {
    return 'هناك خطأ في إعداد خدمة الذكاء الاصطناعي على الخادم. إعادة المحاولة لن تحل المشكلة، تواصل مع مسؤول النظام.';
  }
  if (status === 400) {
    return /json/i.test(apiMessage)
      ? 'أرسلت خدمة الذكاء الاصطناعي ردًا بصيغة غير صالحة. أعد المحاولة.'
      : 'رفضت خدمة الذكاء الاصطناعي الطلب. أعد المحاولة، وإذا تكرر ذلك فتواصل مع مسؤول النظام.';
  }
  if (status >= 500) {
    return 'خدمة الذكاء الاصطناعي متعطلة مؤقتًا. انتظر دقيقة ثم أعد المحاولة.';
  }
  if (/fetch failed|network|الاتصال/i.test(apiMessage)) {
    return 'تعذر على الخادم الاتصال بخدمة الذكاء الاصطناعي. انتظر دقيقة ثم أعد المحاولة.';
  }
  return 'تعذر التوليد بسبب خطأ في خدمة الذكاء الاصطناعي. أعد المحاولة بعد قليل.';
}

/** Short reference the user can send to support. */
export function aiSupportReference(details: RawDetail[]): string | null {
  const raw = text(details.find((item) => item?.code === 'llm_request_id')?.message);
  const id = /req_[\w-]+|[\w-]{8,}$/.exec(raw)?.[0];
  return id ? `رمز الطلب للدعم الفني: ${id}` : null;
}

/* ------------------------------ Error codes ------------------------------ */

export const CODE_MESSAGES: Record<string, string> = {
  invalid_request: 'بعض بيانات الطلب غير صحيحة. راجع الحقول ثم أعد المحاولة.',
  invalid_query: 'خيارات البحث أو التصفية غير صحيحة. غيّرها ثم أعد المحاولة.',
  invalid_id: 'رابط العنصر أو رقمه غير صحيح. ارجع إلى القائمة وافتحه من جديد.',
  invalid_format: 'صيغة التصدير غير مدعومة. اختر PDF أو Word.',
  invalid_type: 'نوع التصدير غير مدعوم. اختر نوعًا آخر.',
  invalid_plan_type: 'نوع الخطة غير صحيح. اختر الخطة التقليدية أو التعلم النشط.',
  invalid_teacher_id: 'تعذر تحديد حسابك. سجّل الخروج ثم الدخول مرة أخرى.',
  invalid_lesson_id: 'الدرس المختار غير صالح. اختره من جديد.',
  forbidden: NO_ACCESS_MESSAGE,
  forbidden_teacher_filter: 'التصفية حسب المعلم متاحة لمدير النظام فقط.',
  invalid_period: 'الفترة الزمنية المختارة غير صحيحة.',
  missing_custom_dates: 'حدّد تاريخ البداية وتاريخ النهاية للفترة المخصصة.',
  invalid_custom_dates: 'صيغة التاريخ غير صحيحة. اختر التاريخ من التقويم.',
  invalid_custom_range: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية أو مساويًا له.',

  internal_error: SERVER_ERROR_MESSAGE,
  export_failed: 'تعذر إنشاء ملف التصدير على الخادم. أعد المحاولة، أو جرّب صيغة أخرى.',

  plan_not_found: 'لم نعثر على الخطة، وربما حُذفت. حدّث الصفحة.',
  invalid_plan_document: 'لم تُحفظ الخطة لأن بعض حقولها ناقصة أو غير صحيحة. راجع الحقول ثم احفظ مرة أخرى.',
  plan_validation_failed: 'لم تنجح الخطة المولَّدة في التحقق رغم إعادة المحاولة. أعد التوليد، وتأكد أن محتوى الدرس واضح وكافٍ.',

  exam_not_found: 'لم نعثر على الاختبار، وربما حُذف. حدّث الصفحة.',
  subject_not_found: 'لم نعثر على المادة المختارة. حدّث الصفحة واخترها من جديد.',
  class_not_found: 'لم نعثر على صف هذه المادة. راجع بيانات المنهج.',
  lesson_not_found: 'لم نعثر على الدرس، وربما حُذف. حدّث الصفحة.',
  lessons_not_found: 'بعض الدروس المختارة غير موجودة ضمن هذه المادة. حدّث الصفحة واختر الدروس من جديد.',
  missing_lesson_plans: 'بعض الدروس المختارة ليس لها خطة بعد. ولّد خطة لكل درس منها ثم أعد توليد الاختبار.',
  missing_objectives: 'بعض خطط الدروس لا تحتوي على أهداف تعلم. أضف الأهداف إلى الخطة أو ولّدها من جديد.',
  objective_classification_failed: 'تعذر تصنيف أهداف أحد الدروس حسب مستويات بلوم. أعد المحاولة، وإذا تكرر ذلك فاجعل صياغة الأهداف في الخطة أوضح.',
  invalid_exam_blueprint: 'تعذر توزيع الأسئلة والدرجات بهذه الإعدادات. غيّر عدد الأسئلة أو الدرجة الكلية.',
  blueprint_question_mismatch: 'تعذر توزيع العدد المطلوب من الأسئلة على الدروس. غيّر عدد الأسئلة أو الدروس المختارة.',
  exam_validation_failed: 'لم تستوفِ الأسئلة المولَّدة الشروط رغم إعادة المحاولة. أعد التوليد، ويمكنك تقليل عدد الأسئلة.',
  invalid_question_grading: 'تعذر توزيع الدرجات بالتساوي على الأسئلة المولَّدة. غيّر الدرجة الكلية أو عدد الأسئلة ثم أعد التوليد.',
  invalid_exam_questions: 'لم تُحفظ التعديلات لأن بعض الأسئلة ناقصة أو غير صحيحة. صحّحها ثم احفظ مرة أخرى.',

  assignment_not_found: 'لم نعثر على الواجب، وربما حُذف. حدّث الصفحة.',
  assignments_validation_failed: 'لم تستوفِ الواجبات المولَّدة الشروط رغم إعادة المحاولة. أعد التوليد.',
  assignment_validation_failed: 'لم يستوفِ الواجب المعدَّل الشروط رغم إعادة المحاولة. وضّح طلب التعديل ثم أعد المحاولة.',

  artifact_not_found: 'لم نعثر على العنصر المراد تحسينه، وربما حُذف.',
  assignment_group_not_found: 'لم نعثر على مجموعة الواجبات.',
  assignment_group_empty: 'مجموعة الواجبات المختارة فارغة.',
  refinement_not_found: 'لم نعثر على طلب التحسين. حدّث الصفحة.',
  revision_not_found: 'لم نعثر على النسخة المطلوبة. حدّث الصفحة.',
  revision_mismatch: 'هذه النسخة لا تخص المستند المفتوح. حدّث الصفحة.',
  stale_request: 'تغيّر المستند بعد إنشاء هذا المقترح. حدّث الصفحة ثم أنشئ طلب تحسين جديدًا.',
  pending_request_exists: 'يوجد طلب تحسين ينتظر قرارك لهذا العنصر. اعتمده أو ارفضه قبل إنشاء طلب جديد.',
  invalid_request_state: 'لا يمكن تنفيذ هذا الإجراء لأن حالة الطلب تغيّرت. حدّث الصفحة.',
  invalid_attempt_state: 'لا يوجد مقترح صالح لاعتماده. أعد محاولة التحسين.',
  candidate_revalidation_failed: 'لم يعد المقترح صالحًا للاعتماد. أعد محاولة التحسين.',
  batch_candidate_missing_item: 'المقترح لا يشمل جميع واجبات المجموعة. أعد محاولة التحسين.',
};

/* --------------------------- English messages ---------------------------- */

const FIELD_LABELS: Record<string, string> = {
  subject_id: 'المادة',
  subject: 'المادة',
  class_id: 'الصف',
  classId: 'الصف',
  unit_id: 'الوحدة',
  unit: 'الوحدة',
  lesson_id: 'الدرس',
  lesson_ids: 'الدروس المختارة',
  lesson_title: 'عنوان الدرس',
  lesson_content: 'محتوى الدرس',
  lesson_plan_public_id: 'خطة الدرس',
  teacher_id: 'المعلم',
  teacherId: 'المعلم',
  'Teacher id': 'المعلم',
  name: 'الاسم',
  title: 'العنوان',
  description: 'الوصف',
  content: 'المحتوى',
  content_type: 'نوع المحتوى',
  grade: 'الصف',
  grade_label: 'الصف',
  semester: 'الفصل الدراسي',
  section_label: 'الشعبة',
  academic_year: 'العام الدراسي',
  default_duration_minutes: 'مدة الحصة',
  default_lesson_duration_minutes: 'مدة الحصة الافتراضية',
  default_plan_type: 'نوع الخطة الافتراضي',
  duration_minutes: 'المدة بالدقائق',
  period_number: 'ترتيب الحصة',
  number_of_periods: 'عدد الحصص',
  period_order: 'ترتيب الحصة',
  plan_type: 'نوع الخطة',
  total_questions: 'عدد الأسئلة',
  total_marks: 'الدرجة الكلية',
  questions: 'الأسئلة',
  assignments: 'الواجبات',
  type: 'النوع',
  due_date: 'تاريخ التسليم',
  date_from: 'تاريخ البداية',
  date_to: 'تاريخ النهاية',
  username: 'اسم المستخدم',
  display_name: 'الاسم الظاهر',
  new_password: 'كلمة المرور الجديدة',
  language: 'اللغة',
  preparation_type: 'نوع التحضير',
  school_name: 'اسم المدرسة',
  school_logo_url: 'شعار المدرسة',
  feedback_text: 'ملاحظة التحسين',
  modification_request: 'طلب التعديل',
  artifact_id: 'العنصر المراد تحسينه',
  artifact_type: 'نوع العنصر',
  target_mode: 'نطاق التحسين',
  target_selector: 'الجزء المراد تحسينه',
  assignment_id: 'الواجب',
  assignment_group_id: 'مجموعة الواجبات',
  expected_base_revision_ids: 'مرجع النسخة الحالية',
  target_revision_id: 'النسخة المطلوبة',
  plan_json: 'محتوى الخطة',
};

const FIELD_RULES: Array<[RegExp, (label: string, match: RegExpExecArray) => string]> = [
  [/^(?:field )?is required.*$/i, (label) => `${label}: هذا الحقل مطلوب.`],
  [/^cannot be empty$/i, (label) => `${label}: لا يمكن تركه فارغًا.`],
  [/^must be a positive integer$/i, (label) => `${label}: أدخل رقمًا صحيحًا أكبر من صفر.`],
  [/^must be a valid number$/i, (label) => `${label}: أدخل رقمًا صحيحًا.`],
  [/^must be a string.*$/i, (label) => `${label}: القيمة يجب أن تكون نصًا.`],
  [/^must be at least (\d+) characters(?: long)?$/i, (label, m) => `${label}: يجب ألا يقل عن ${m[1]} أحرف.`],
  [/^must be at most (\d+) characters$/i, (label, m) => `${label}: يجب ألا يزيد على ${m[1]} حرفًا.`],
  [/^must (?:be YYYY-MM-DD|be in YYYY-MM-DD).*$/i, (label) => `${label}: صيغة التاريخ غير صحيحة.`],
  [/^must be one of: .+$/i, (label) => `${label}: اختر قيمة من القيم المتاحة.`],
  [/^(?:must|has to) .+$/i, (label) => `${label}: القيمة غير صحيحة.`],
];

const EXACT_MESSAGES: Record<string, string> = {
  'Request body required': 'لم تصل أي بيانات إلى الخادم. املأ الحقول ثم أعد المحاولة.',
  'Internal server error': SERVER_ERROR_MESSAGE,
  Unauthorized: NO_ACCESS_MESSAGE,
  'Unauthorized: You can only create subjects for your own account': 'يمكنك إضافة مواد لحسابك فقط.',
  'Unauthorized: You can only create units for your own account': 'يمكنك إضافة وحدات لحسابك فقط.',
  'Unauthorized: You can only create units for your own subjects': 'يمكنك إضافة وحدات إلى موادك فقط.',
  'Unauthorized: You can only move units to your own subjects': 'يمكنك نقل الوحدة إلى موادك فقط.',
  'Unauthorized: You can only create subjects in your own classes': 'يمكنك إضافة مواد إلى صفوفك فقط.',
  'Unauthorized: You can only move subjects to your own classes': 'يمكنك نقل المادة إلى صفوفك فقط.',
  'Unauthorized: You can only create classes for your own account': 'يمكنك إضافة صفوف لحسابك فقط.',
  'Unauthorized: You can only create lessons for your own account': 'يمكنك إضافة دروس لحسابك فقط.',
  'Unauthorized: You can only create lessons for your own units': 'يمكنك إضافة دروس إلى وحداتك فقط.',
  'Unauthorized: You can only move lessons to your own units': 'يمكنك نقل الدرس إلى وحداتك فقط.',
  'Cannot move unit to a subject owned by a different teacher': 'لا يمكن نقل الوحدة إلى مادة تخص معلمًا آخر.',
  'Cannot move subject to a class owned by a different teacher': 'لا يمكن نقل المادة إلى صف يخص معلمًا آخر.',
  'Cannot move lesson to a unit owned by a different teacher': 'لا يمكن نقل الدرس إلى وحدة تخص معلمًا آخر.',
  'teacher_id must match the class owner': 'المعلم المحدد لا يطابق معلم هذا الصف.',
  'Cannot delete this unit because it still contains lessons. Delete lessons first.':
    'لا يمكن حذف الوحدة لأنها تحتوي على دروس. احذف دروسها أولًا.',
  'Subject not found': 'لم نعثر على المادة. حدّث الصفحة.',
  'Class not found': 'لم نعثر على الصف. حدّث الصفحة.',
  'Unit not found': 'لم نعثر على الوحدة. حدّث الصفحة.',
  'Lesson not found': 'لم نعثر على الدرس. حدّث الصفحة.',
  'User not found': 'لم نعثر على المستخدم.',
  'Teacher not found': 'لم نعثر على المعلم. حدّث الصفحة.',
  'Provided user is not a teacher': 'المستخدم المحدد ليس معلمًا.',
  'Username already exists': 'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.',
  'Username and password are required': 'أدخل اسم المستخدم وكلمة المرور.',
  'Username must be at least 4 characters long': 'اسم المستخدم يجب ألا يقل عن 4 أحرف.',
  'Password must be at least 6 characters long': 'كلمة المرور يجب ألا تقل عن 6 أحرف.',
  'At least one valid profile field is required': 'لا يوجد تغيير لحفظه. عدّل حقلًا واحدًا على الأقل.',
  'At least one valid field is required (username, display_name or profile fields)':
    'لا يوجد تغيير لحفظه. عدّل حقلًا واحدًا على الأقل.',

  // Lesson file uploads and text extraction
  'pdf file is required': 'أرفق ملف PDF للدرس.',
  'word file is required': 'أرفق ملف Word بصيغة DOCX للدرس.',
  'File size exceeds the 25MB limit.': 'حجم الملف أكبر من 25 ميجابايت. اضغط الملف أو قسّمه.',
  'File upload failed.': 'تعذر رفع الملف. أعد اختياره ثم حاول مرة أخرى.',
  'File type does not match content_type. Expected a PDF file.': 'الملف المرفق ليس PDF. اختر ملف PDF أو غيّر نوع المحتوى.',
  'File type does not match content_type. Expected a DOCX file.': 'الملف المرفق ليس DOCX. اختر ملف DOCX أو غيّر نوع المحتوى.',
  'Legacy DOC files are not supported. Please convert the file to DOCX first.':
    'صيغة DOC القديمة غير مدعومة. احفظ الملف بصيغة DOCX ثم ارفعه.',
  'This PDF is password protected and cannot be processed.': 'ملف PDF محمي بكلمة مرور. أزل الحماية ثم ارفعه.',
  'This PDF file is corrupted or invalid.': 'ملف PDF تالف أو غير صالح. صدّره من جديد ثم ارفعه.',
  'Failed to extract text from the file.': 'تعذر استخراج النص من الملف. جرّب ملفًا آخر أو الصق النص يدويًا.',
  'Failed to extract text from the PDF file.': 'تعذر استخراج النص من ملف PDF. جرّب ملفًا آخر أو الصق النص يدويًا.',
  'No readable text could be extracted from the PDF file.': 'لم نجد نصًا مقروءًا في ملف PDF. استخدم نسخة أوضح أو الصق النص يدويًا.',
  'No readable text could be extracted from the uploaded file.': 'لم نجد نصًا مقروءًا في الملف. استخدم نسخة أوضح أو الصق النص يدويًا.',
  'Content field is required for text lessons': 'اكتب محتوى الدرس.',
  'Content cannot be null': 'محتوى الدرس لا يمكن أن يكون فارغًا.',
  'file upload is not allowed for text content_type': 'لا يمكن إرفاق ملف عند اختيار المحتوى النصي. غيّر نوع المحتوى.',
  "Invalid content_type. Must be 'text', 'pdf', or 'word'": 'نوع المحتوى غير صحيح. اختر نصًا أو PDF أو Word.',

  'Only admin users can filter by teacher_id': 'التصفية حسب المعلم متاحة لمدير النظام فقط.',
  'total_marks must allocate at least 1 mark per question':
    'الدرجة الكلية أقل من عدد الأسئلة. يحتاج كل سؤال إلى درجة واحدة على الأقل، فزد الدرجة أو قلّل الأسئلة.',
  'lesson_ids must contain at least one lesson id': 'اختر درسًا واحدًا على الأقل.',
  'lesson_ids must not contain duplicates': 'أحد الدروس مختار أكثر من مرة.',
};

/** Translates one English backend message; returns null when it is unknown. */
export function translateMessage(rawMessage: string): string | null {
  const message = rawMessage.trim();
  if (!message) return null;
  if (EXACT_MESSAGES[message]) return EXACT_MESSAGES[message];
  if (isArabicText(message) && !/^[A-Za-z_]/.test(message)) return message;

  if (message.startsWith('school_logo_url contains unreadable image data')) {
    return 'تعذرت قراءة صورة الشعار. اختر صورة PNG أو JPG سليمة.';
  }

  // Controllers may join several field errors with ", ".
  const parts = message.split(/, (?=[A-Za-z]+_?\w* (?:is|must) )/);
  const translated = parts.map((part) => {
    if (EXACT_MESSAGES[part]) return EXACT_MESSAGES[part];
    const field = Object.keys(FIELD_LABELS).find(
      (key) => part.toLowerCase().startsWith(`${key.toLowerCase()} `)
    );
    if (!field) return null;
    const rest = part.slice(field.length + 1);
    for (const [pattern, build] of FIELD_RULES) {
      const match = pattern.exec(rest);
      if (match) return build(FIELD_LABELS[field], match);
    }
    return null;
  });

  return translated.every(Boolean) ? translated.join(' ') : null;
}

/* ----------------------------- Detail lines ------------------------------ */

const QUESTION_FIELD_LABELS: Record<string, string> = {
  question_type: 'نوع السؤال',
  marks: 'الدرجة',
  question_text: 'نص السؤال',
  options: 'الخيارات',
  correct_option_index: 'الخيار الصحيح',
  correct_answer: 'الإجابة الصحيحة',
  answer_text: 'الإجابة النموذجية',
  rubric: 'معيار التصحيح',
  lesson_id: 'الدرس',
  lesson_name: 'عنوان الدرس',
  bloom_level: 'مستوى بلوم',
  bloom_level_label: 'اسم مستوى بلوم',
  slot_id: 'معرّف السؤال',
};

function translateDetail(detail: RawDetail): string | null {
  const message = text(detail.message);
  const code = text(detail.code);

  const missingPlan = /^Missing plan for lesson \d+ \((.*)\)$/.exec(message);
  if (missingPlan) return `الدرس «${missingPlan[1]}» ليس له خطة.`;

  const noObjectives = /^No objectives found for lesson \d+ \((.*)\), plan /.exec(message);
  if (noObjectives) return `خطة الدرس «${noObjectives[1]}» لا تحتوي على أهداف.`;

  const question = /^(?:\$\.)?questions[.[](\d+)\]?(?:\.(\w+))?/.exec(
    text(detail.path)
  );
  if (question) {
    const label = QUESTION_FIELD_LABELS[question[2] ?? ''];
    const where = `السؤال ${Number(question[1]) + 1}${label ? ` (${label})` : ''}`;
    return isArabicText(message)
      ? `${where}: ${message}`
      : `${where}: القيمة ناقصة أو غير صحيحة.`;
  }

  const translated = translateMessage(message);
  if (translated) return translated;

  const field = text(detail.field) || code;
  return FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: القيمة غير صحيحة.` : null;
}

/**
 * Keeps code/path/field (screens use them) and swaps in Arabic wording.
 * Details that cannot be explained are dropped rather than shown in English.
 */
export function translateDetails(details: RawDetail[]) {
  const seen = new Set<string>();
  return details
    .flatMap((detail) => {
      if (!detail || typeof detail !== 'object') return [];
      const message = translateDetail(detail);
      if (!message || seen.has(message)) return [];
      seen.add(message);
      return [{ ...detail, message }];
    })
    .slice(0, 8);
}
