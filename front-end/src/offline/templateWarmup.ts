import examTemplateUrl from './export/templates/examTemplate.docx?url';
import { TEMPLATE_CACHE_NAME } from './examTemplateCache';

/**
 * Best-effort cache warmup for the RTL exam template.
 *
 * The DOCX itself stays as a separate build asset, but we cache the emitted
 * URL while the app is online so the offline exporter can reuse the exact
 * same template later without falling back to the raw layout.
 */
export async function warmOfflineExamTemplate(): Promise<void> {
  if (typeof caches === 'undefined' || typeof fetch === 'undefined') {
    return;
  }

  try {
    const cache = await caches.open(TEMPLATE_CACHE_NAME);
    const cached = await cache.match(examTemplateUrl);
    if (cached) {
      return;
    }

    const response = await fetch(examTemplateUrl, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    await cache.put(examTemplateUrl, response);
  } catch {
    // Warmup is opportunistic; export-time rendering still performs its own read.
  }
}
