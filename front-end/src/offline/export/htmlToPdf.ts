import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface HtmlToPdfOptions {
  /** Lesson plans use landscape on the server; exams use portrait. */
  landscape?: boolean;
  /** Outer width for layout before capture (helps wide tables). */
  contentWidthPx?: number;
}

async function waitForDocumentFonts(doc: Document): Promise<void> {
  if ('fonts' in doc && doc.fonts && 'ready' in doc.fonts) {
    try {
      await doc.fonts.ready;
    } catch {
      // Continue even if a font fails to load. We still want a PDF.
    }
  }
}

async function waitForPaint(win: Window, frames = 2): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await new Promise<void>((resolve) => {
      win.requestAnimationFrame(() => resolve());
    });
  }
}

function normalizeExportViewport(doc: Document, widthPx: number): void {
  const root = doc.documentElement;
  const body = doc.body;

  root.style.margin = '0';
  root.style.padding = '0';
  root.style.width = `${widthPx}px`;
  root.style.minWidth = `${widthPx}px`;
  root.style.background = '#ffffff';
  root.style.overflow = 'visible';
  (root.style as CSSStyleDeclaration & { webkitTextSizeAdjust?: string }).webkitTextSizeAdjust =
    '100%';

  body.style.margin = '0';
  body.style.padding = '0';
  body.style.width = `${widthPx}px`;
  body.style.minWidth = `${widthPx}px`;
  body.style.background = '#ffffff';
  body.style.overflow = 'visible';
  (body.style as CSSStyleDeclaration & { webkitTextSizeAdjust?: string }).webkitTextSizeAdjust =
    '100%';
}

function measureExportViewport(doc: Document, fallbackWidthPx: number): {
  widthPx: number;
  heightPx: number;
} {
  const root = doc.documentElement;
  const body = doc.body;
  const widthPx = Math.ceil(
    Math.max(
      fallbackWidthPx,
      root.scrollWidth,
      root.offsetWidth,
      body.scrollWidth,
      body.offsetWidth
    )
  );
  const heightPx = Math.ceil(
    Math.max(
      root.scrollHeight,
      root.offsetHeight,
      body.scrollHeight,
      body.offsetHeight
    )
  );

  return { widthPx, heightPx };
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
  iframe.style.height = '1px';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      throw new Error('تعذر إعداد إطار التصدير.');
    }

    doc.open();
    doc.write(fullHtmlDocument);
    doc.close();

    normalizeExportViewport(doc, contentWidthPx);
    await waitForDocumentFonts(doc);
    await waitForPaint(win, 2);
    await waitForImages(doc.body);
    await waitForPaint(win, 1);

    const { widthPx, heightPx } = measureExportViewport(doc, contentWidthPx);
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = `${heightPx}px`;
    normalizeExportViewport(doc, widthPx);
    await waitForPaint(win, 1);

    let canvas: HTMLCanvasElement;
    const captureOptions = {
      scale: Math.min(2, win.devicePixelRatio || 2),
      useCORS: true,
      logging: false,
      windowWidth: widthPx,
      windowHeight: heightPx,
      width: widthPx,
      height: heightPx,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
    };

    try {
      canvas = await html2canvas(doc.body, {
        ...captureOptions,
        foreignObjectRendering: true,
      });
    } catch {
      canvas = await html2canvas(doc.body, captureOptions);
    }

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
      sliceCanvas.height = Math.ceil(sliceHeight);
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('تعذر رسم صفحة PDF.');
      }
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height
      );

      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceH = (sliceCanvas.height * imgWidthMm) / canvas.width;

      if (!isFirst) {
        pdf.addPage();
      }
      isFirst = false;
      pdf.addImage(sliceData, 'PNG', margin, margin, imgWidthMm, sliceH);
      sourceY += sliceCanvas.height;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
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
