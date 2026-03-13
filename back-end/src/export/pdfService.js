import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const PDF_TIMEOUT_MS = 30_000;

/**
 * Launch options for PDF generation.
 * - On Render/serverless: uses @sparticuz/chromium (no system Chrome needed).
 * - Local dev: set PUPPETEER_EXECUTABLE_PATH to use system Chrome, or leave unset to use bundled Chromium.
 */
async function getLaunchOptions() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    };
  }

  const executablePath = await chromium.executablePath();
  return {
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  };
}

/**
 * Generate PDF buffer from full HTML string.
 * Uses @sparticuz/chromium on Render/serverless; optional local Chrome via PUPPETEER_EXECUTABLE_PATH.
 * @param {string} html - Full HTML document (with style, dir="rtl", etc.)
 * @param {{ landscape?: boolean }} [options] - Optional. Default landscape: true (plan/assignment/stats). Use landscape: false for exam PDFs (portrait).
 * @returns {Promise<Buffer>}
 */
export async function htmlToPdf(html, options = {}) {
  const landscape = options.landscape !== false;
  let browser;
  try {
    const launchOptions = await getLaunchOptions();
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: PDF_TIMEOUT_MS,
    });
    const buffer = await page.pdf({
      format: "A4",
      landscape,
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    return Buffer.from(buffer);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
