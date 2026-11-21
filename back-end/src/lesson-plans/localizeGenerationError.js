const REQUEST_FIELDS = {
  lesson_id: "معرّف الدرس غير صالح.",
  lesson_title: "عنوان الدرس مطلوب.",
  lesson_content: "محتوى الدرس مطلوب.",
  subject: "المادة مطلوبة.",
  grade: "الصف مطلوب.",
  unit: "الوحدة مطلوبة.",
  duration_minutes: "مدة الحصة يجب أن تكون رقماً صحيحاً موجباً.",
  plan_type: "نوع الخطة غير صالح.",
  period_order: "ترتيب الحصة غير صالح.",
};

const STEP_NAMES = {
  "Prompt 1 draft generation": "توليد مسودة التحضير",
  "Prompt 1 draft generation fallback retry": "إعادة توليد مسودة التحضير بالنموذج البديل",
  "Prompt 2 pedagogical tuning": "تحسين التحضير تربوياً",
  "Prompt 2 pedagogical tuning fallback retry": "إعادة تحسين التحضير بالنموذج البديل",
  "Prompt 2 retry with validation errors": "إعادة تحسين التحضير بعد أخطاء التحقق",
};

function localizeLlmDetail(detail, details) {
  const message = String(detail.message || "");
  const status = details.find((item) => item?.code === "llm_http_status")?.message || "";
  switch (detail.code) {
    case "malformed_json":
      return /structure/i.test(message)
        ? "استجابة الذكاء الاصطناعي لا تطابق بنية التحضير المطلوبة."
        : "استجابة الذكاء الاصطناعي ليست بصيغة JSON صالحة.";
    case "truncated_output": return "توقفت استجابة الذكاء الاصطناعي قبل اكتمالها بسبب حد طول المخرجات.";
    case "timeout": return "انتهت مهلة انتظار استجابة الذكاء الاصطناعي.";
    case "api_error":
      if (/429/.test(status)) return "تم تجاوز حد استخدام خدمة الذكاء الاصطناعي. حاول مرة أخرى بعد قليل.";
      if (/GROQ_API_KEY/i.test(message)) return "مفتاح خدمة الذكاء الاصطناعي غير مُعدّ على الخادم.";
      if (/401|403/.test(status)) return "تعذر التحقق من صلاحية مفتاح خدمة الذكاء الاصطناعي أو الوصول إلى النموذج.";
      if (/fetch failed|network/i.test(message)) return "تعذر الاتصال بخدمة الذكاء الاصطناعي.";
      return "أعادت خدمة الذكاء الاصطناعي خطأ أثناء معالجة الطلب.";
    case "llm_error": return "حدث خطأ غير معروف أثناء توليد التحضير.";
    case "llm_step": {
      const step = message.replace(/^Step:\s*/, "");
      return `المرحلة: ${STEP_NAMES[step] || "توليد التحضير"}.`;
    }
    case "llm_provider": return message.replace(/^Provider:/, "مزود الخدمة:");
    case "llm_model": return message.replace(/^Model:/, "النموذج:");
    case "llm_timeout_ms": return message.replace(/^Timeout:/, "المهلة:");
    case "llm_http_status": return message.replace(/^Groq API status:/, "رمز حالة خدمة Groq:");
    case "llm_request_id": return message.replace(/^Request id:/, "معرّف الطلب:");
    case "llm_retry_after": return message.replace(/^Retry-After:/, "إعادة المحاولة بعد:");
    case "llm_upstream_error_type": return message.replace(/^Upstream error type:/, "نوع خطأ الخدمة:");
    case "llm_upstream_error_code": return message.replace(/^Upstream error code:/, "رمز خطأ الخدمة:");
    default: return "حدث خطأ أثناء توليد التحضير.";
  }
}

function localizeValidationDetail(detail) {
  const code = String(detail.code || "");
  let message = "تعذر التحقق من أحد متطلبات التحضير.";
  if (code.startsWith("business.alignment.")) message = "يجب أن تتوافق الأهداف والأنشطة والتقويم مع بعضها.";
  else if (code.startsWith("business.duration.") || code === "business.lesson_flow.time.unparseable") message = "مدد الحصة أو توزيعها غير صالح أو لا يطابق المدة المحددة.";
  else if (code.startsWith("business.objectives.")) message = "أحد الأهداف التعليمية لا يحقق متطلبات الصياغة أو الارتباط بالدرس.";
  else if (code.startsWith("business.assessment.")) message = "التقويم غير مكتمل أو لا يحقق التنوع المطلوب.";
  else if (code.startsWith("business.homework.")) message = "الواجب غير مكتمل أو لا يرتبط بمحتوى الدرس بما يكفي.";
  else if (code.startsWith("business.lesson_flow.")) message = "تسلسل مراحل التعلم النشط أو نوع أحد الأنشطة غير صالح.";
  else if (code.startsWith("business.traditional.")) message = "أحد عناصر التحضير التقليدي أو استراتيجياته لا يحقق المتطلبات.";
  else if (code.startsWith("business.source.")) message = "مصدر التحضير مفقود أو لا يطابق بيانات الدرس.";
  else if (code.startsWith("business.arabic.")) message = "تحتوي الخطة على صياغة عربية تحتاج إلى تحسين.";
  else if (code.startsWith("schema.") || code === "json.object") message = "بنية التحضير الناتج أو نوع أحد حقوله غير صالح.";
  return { ...detail, message };
}

export function localizeGenerationError({ code, details = [] }) {
  const safeDetails = Array.isArray(details) ? details : [];
  if (code === "llm_generation_failed") {
    return { message: "تعذر توليد التحضير باستخدام الذكاء الاصطناعي.", details: safeDetails.map((detail) => ({ ...detail, message: localizeLlmDetail(detail, safeDetails) })) };
  }
  if (code === "plan_validation_failed") {
    return { message: "لم يجتز التحضير التحقق بعد إعادة المحاولة.", details: safeDetails.map(localizeValidationDetail) };
  }
  if (code === "invalid_request") {
    return { message: "بيانات طلب التحضير غير صالحة.", details: safeDetails.map((detail) => ({ ...detail, message: REQUEST_FIELDS[detail.field] || "بيانات الحقل غير صالحة." })) };
  }
  const messages = {
    invalid_teacher_id: "تعذر تحديد حساب المعلم.",
    invalid_lesson_id: "معرّف الدرس غير صالح.",
    internal_error: "حدث خطأ غير متوقع في الخادم أثناء توليد التحضير.",
  };
  return { message: messages[code] || "تعذر توليد التحضير بسبب خطأ غير متوقع.", details: safeDetails };
}
