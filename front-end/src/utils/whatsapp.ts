/**
 * Build WhatsApp share link with pre-filled text (direct link handoff, no API).
 * Opens in WhatsApp when user taps the link.
 */
export function buildWhatsAppLink(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Detect if the current device is mobile (iOS or Android).
 */
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if the current device is Android.
 */
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detect if the current device is iOS.
 */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Open WhatsApp with the given text using the most appropriate method for the device.
 */
function openWhatsApp(text: string): void {
  const encodedText = encodeURIComponent(text);

  if (isAndroid()) {
    // Android: Use intent scheme to open WhatsApp directly
    window.location.href = `intent://send?text=${encodedText}#Intent;package=com.whatsapp;scheme=whatsapp;end`;
  } else if (isIOS()) {
    // iOS: Use WhatsApp URL scheme
    window.location.href = `whatsapp://send?text=${encodedText}`;
  } else if (isMobileDevice()) {
    // Generic mobile fallback
    window.open(
      `https://wa.me/?text=${encodedText}`,
      '_blank',
      'noopener,noreferrer'
    );
  } else {
    // Desktop: Use web.whatsapp.com
    window.open(
      `https://web.whatsapp.com/send?text=${encodedText}`,
      '_blank',
      'noopener,noreferrer'
    );
  }
}

/**
 * Share a document (PDF/Word) with optional text via the system share sheet when possible
 * (so user can pick WhatsApp and get the file attached), then open WhatsApp with the text.
 * If sharing with file is not supported, triggers download and opens WhatsApp directly
 * using device-specific deep links for iOS/Android.
 */
export async function shareDocumentWithWhatsApp(
  blob: Blob,
  filename: string,
  text: string
): Promise<void> {
  const file = new File([blob], filename, {
    type: blob.type || 'application/octet-stream',
  });

  // Primary: Use native share API (works on mobile for both iOS and Android)
  // This allows the user to select WhatsApp from the native share sheet with file attached
  if (typeof navigator.share === 'function') {
    try {
      const shareData: ShareData = { files: [file], text };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // User cancelled or share failed; continue to fallback
    }
  }

  // Fallback: Download the file first, then open WhatsApp
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Small delay to ensure download starts before opening WhatsApp
  await new Promise((resolve) => setTimeout(resolve, 500));
  URL.revokeObjectURL(url);

  // Open WhatsApp using device-specific deep links
  openWhatsApp(text);
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
