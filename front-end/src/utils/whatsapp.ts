export type ShareDocumentResult = 'shared' | 'downloaded' | 'cancelled';

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
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
 * Share a document via the device's native share sheet (mobile) or download it (desktop).
 *
 * On mobile (iOS / Android): opens the native share sheet so the user can pick
 * WhatsApp, Telegram, email, etc.
 * On desktop / unsupported browsers: downloads the file automatically.
 */
export async function shareDocument(
  blob: Blob,
  filename: string,
): Promise<ShareDocumentResult> {
  const mimeType = inferMimeType(filename, blob.type);
  const file = new File([blob], filename, { type: mimeType });

  if (typeof navigator.share === 'function') {
    try {
      const shareData: ShareData = { files: [file] };
      const canTry = !navigator.canShare || navigator.canShare(shareData);
      if (canTry) {
        await navigator.share(shareData);
        return 'shared';
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  triggerDownload(blob, filename);
  return 'downloaded';
}
