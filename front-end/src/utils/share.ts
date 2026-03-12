/**
 * Use native share when available (e.g. mobile/desktop share sheet), otherwise trigger download.
 * For file sharing: pass blob + filename. If navigator.share supports files, share; else download.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title?: string
): Promise<void> {
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
  } catch (_) {
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
