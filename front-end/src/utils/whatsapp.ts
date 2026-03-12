/**
 * Build WhatsApp share link with pre-filled text (direct link handoff, no API).
 * Opens in WhatsApp when user taps the link.
 */
export function buildWhatsAppLink(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Share a document (PDF/Word) with optional text via the system share sheet when possible
 * (so user can pick WhatsApp and get the file attached), then open WhatsApp with the text.
 * If sharing with file is not supported, triggers download and opens wa.me so user can attach manually.
 */
export async function shareDocumentWithWhatsApp(
  blob: Blob,
  filename: string,
  text: string
): Promise<void> {
  const file = new File([blob], filename, {
    type: blob.type || 'application/octet-stream',
  });
  if (
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file], text })
  ) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch {
      // User cancelled or share failed; fall back to download + wa.me
    }
  }
  // Fallback: download file and open WhatsApp with pre-filled text
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.open(buildWhatsAppLink(text), '_blank', 'noopener,noreferrer');
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
