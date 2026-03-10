import puppeteer from "puppeteer";

const PDF_TIMEOUT_MS = 30_000;

/**
 * Generate PDF buffer from full HTML string.
 * @param {string} html - Full HTML document (with style, dir="rtl", etc.)
 * @returns {Promise<Buffer>}
 */
export async function htmlToPdf(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: PDF_TIMEOUT_MS,
    });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
    return Buffer.from(buffer);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
