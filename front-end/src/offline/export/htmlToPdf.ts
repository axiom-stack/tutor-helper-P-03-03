import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface HtmlToPdfOptions {
  /** Lesson plans use landscape on the server; exams use portrait. */
  landscape?: boolean;
  /** Outer width for layout before capture (helps wide tables). */
  contentWidthPx?: number;
}

/**
 * Renders a full HTML document string to a multi-page PDF blob (offline export).
 */
export async function htmlDocumentToPdfBlob(
  fullHtmlDocument: string,
  options: HtmlToPdfOptions = {}
): Promise<Blob> {
  const landscape = options.landscape ?? false;
  const contentWidthPx = options.contentWidthPx ?? (landscape ? 1120 : 794);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'export-print');
  iframe.style.position = 'fixed';
  iframe.style.left = '-12000px';
  iframe.style.top = '0';
  iframe.style.width = `${contentWidthPx}px`;
  iframe.style.height = '12000px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error('تعذر إعداد إطار التصدير.');
  }

  doc.open();
  doc.write(fullHtmlDocument);
  doc.close();

  await new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => resolve());
  });

  const body = doc.body;
  await waitForImages(body);

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: contentWidthPx,
    scrollX: 0,
    scrollY: 0,
    backgroundColor: '#ffffff',
  });

  document.body.removeChild(iframe);

  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - 2 * margin;
  const usableHeight = pageHeight - 2 * margin;

  const imgWidthMm = usableWidth;

  const pageHeightPx = (usableHeight / imgWidthMm) * canvas.width;

  let sourceY = 0;
  let isFirst = true;

  while (sourceY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('تعذر رسم صفحة PDF.');
    }
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const sliceData = sliceCanvas.toDataURL('image/png');
    const sliceH = (sliceHeight * imgWidthMm) / canvas.width;

    if (!isFirst) {
      pdf.addPage();
    }
    isFirst = false;
    pdf.addImage(sliceData, 'PNG', margin, margin, imgWidthMm, sliceH);
    sourceY += sliceHeight;
  }

  return pdf.output('blob');
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) {
    return Promise.resolve();
  }
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => undefined);
}
