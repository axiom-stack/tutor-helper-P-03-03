function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function openPdfPrintDialog(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (w) {
    w.onload = () => {
      try {
        w.print();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    };
  } else {
    URL.revokeObjectURL(url);
  }
}

/**
 * Use native share when available (e.g. mobile/desktop share sheet), otherwise trigger download.
 * For PDF on non-mobile: open print dialog instead of download.
 * For file sharing: pass blob + filename. If navigator.share supports files, share; else download (or print for PDF on desktop).
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title?: string
): Promise<void> {
  const isPdf = blob.type === 'application/pdf';
  if (isPdf && !isMobile()) {
    openPdfPrintDialog(blob);
    return;
  }

  const text = title ?? filename;
  if (typeof navigator.share !== 'function') {
    triggerDownload(blob, filename);
    return;
  }
  try {
    const file = new File([blob], filename, {
      type: blob.type || 'application/octet-stream',
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: text,
        text,
      });
      return;
    }
  } catch {
    // User cancelled or share not supported for files
  }
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
