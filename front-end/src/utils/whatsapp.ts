/**
 * Build WhatsApp share link with pre-filled text (direct link handoff, no API).
 * Opens in WhatsApp when user taps the link.
 */
export function buildWhatsAppLink(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Build homework message for guardian: lesson title + homework content + due date.
 */
export function buildHomeworkMessage(options: {
  lessonTitle: string;
  content: string;
  dueDate?: string | null;
  customMessageText?: string | null;
}): string {
  if (options.customMessageText?.trim()) {
    return options.customMessageText.trim();
  }
  const dueLabel = options.dueDate?.trim() ? options.dueDate.trim() : 'غير محدد';
  return [
    `عنوان الدرس: ${options.lessonTitle.trim()}`,
    `الواجب: ${options.content.trim()}`,
    `موعد التسليم: ${dueLabel}`,
  ].join('\n');
}
