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

function inferMimeType(filename: string, blobType: string): string {
  if (blobType && blobType !== 'application/octet-stream') return blobType;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  return blobType || 'application/octet-stream';
}

/**
 * Share a document (PDF/Word) with optional text via the system share sheet when possible
 * (so user can pick WhatsApp and get the file attached), then open WhatsApp with the text.
 *
 * Attaching a file to WhatsApp is ONLY possible via the Web Share API (navigator.share).
 * WhatsApp deep links (wa.me, whatsapp://, intent://) only support text.
 * If the Web Share API isn't available or doesn't support files, we fall back to
 * downloading the file and opening WhatsApp with the text message only.
 */
export async function shareDocumentWithWhatsApp(
  blob: Blob,
  filename: string,
  text: string
): Promise<void> {
  const mimeType = inferMimeType(filename, blob.type);
  const file = new File([blob], filename, { type: mimeType });

  if (typeof navigator.share === 'function') {
    try {
      const shareData: ShareData = { files: [file], text };
      // Don't gate strictly on canShare — some browsers support file sharing
      // without implementing canShare (or return false for certain MIME types).
      const canTry = !navigator.canShare || navigator.canShare(shareData);
      if (canTry) {
        await navigator.share(shareData);
        return;
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }

    // navigator.share exists but file sharing failed/unsupported.
    // Try once more without files so the user at least gets the native share
    // sheet (they can pick WhatsApp for the text and attach the file manually).
    try {
      const textOnly: ShareData = { text, title: filename };
      const canTryText = !navigator.canShare || navigator.canShare(textOnly);
      if (canTryText) {
        triggerDownload(blob, filename);
        await navigator.share(textOnly);
        return;
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }

  // Final fallback: download the file, then open WhatsApp with text only.
  triggerDownload(blob, filename);
  await new Promise((resolve) => setTimeout(resolve, 800));
  openWhatsApp(text);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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
