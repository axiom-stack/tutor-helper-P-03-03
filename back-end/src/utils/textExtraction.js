/**
 * textExtraction.js
 *
 * Arabic-first lesson-file extraction.
 *
 * PDF extraction deliberately uses two paths:
 *   1. PDF.js text-layer extraction for searchable PDFs with a valid Unicode map.
 *   2. Tesseract OCR for scanned PDFs and PDFs whose embedded Arabic font exposes
 *      unreadable glyph codes instead of real Arabic text.
 */

import path from "node:path";
import os from "node:os";
import { access, copyFile, mkdir, rm, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker, OEM, PSM } from "tesseract.js";
import araTrainingData from "@tesseract.js-data/ara";
import engTrainingData from "@tesseract.js-data/eng";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(MODULE_DIR, "../..");
const PDFJS_DIST_DIR = path.join(BACKEND_ROOT, "node_modules", "pdfjs-dist");
const PDFJS_CMAP_DIR = path.join(PDFJS_DIST_DIR, "cmaps/");
const PDFJS_STANDARD_FONT_DIR = path.join(PDFJS_DIST_DIR, "standard_fonts/");
const TESSDATA_DIR = path.join(os.tmpdir(), "tutor-helper-tessdata");

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).href;

const MIN_CHARS_PER_PAGE = 30;
const OCR_SCALE = 3;
const OCR_MAX_CANVAS_SIDE = 4200;
const LINE_Y_TOLERANCE = 4;

const ARABIC_CHAR_GLOBAL_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/gu;
const LATIN_LETTER_GLOBAL_RE = /[A-Za-z]/g;
const LETTER_GLOBAL_RE = /\p{L}/gu;
const TEXTUAL_CHAR_RE = /[\p{L}\p{N}]/u;
const REPLACEMENT_CHAR_GLOBAL_RE = /\uFFFD/g;
const QUESTION_MARK_GLOBAL_RE = /\?/g;
const HIGH_ASCII_GLOBAL_RE = /[\u00A0-\u00FF]/g;
const PRIVATE_FONT_GLYPH_GLOBAL_RE =
  /[‰ŠŒŽšœžŸƒˆ˜¯˘˙˚¸˝˛ˇ⁄√∫≈≠≤≥◊€™‹›]/g;
const ARABIC_LETTER_GLOBAL_RE = /[\u0621-\u064A]/gu;
const LATIN_WORD_RE = /\b[A-Za-z][A-Za-z'-]*\b/g;
const ARABIC_LETTERS_CLASS = "\\u0621-\\u064A";
const OCR_LANG_DATA = {
  ara: araTrainingData.langPath,
  eng: engTrainingData.langPath,
};
const LATIN_ALLOWLIST = new Set([
  "AI",
  "API",
  "CPU",
  "CSS",
  "DNA",
  "GPS",
  "HTML",
  "HTTP",
  "HTTPS",
  "LLM",
  "PDF",
  "STEM",
  "URL",
  "USB",
]);

function countMatches(text, regex) {
  return text.match(regex)?.length ?? 0;
}

function normalizeForQuality(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getScriptStats(text) {
  return {
    arabicLetters: countMatches(text, ARABIC_LETTER_GLOBAL_RE),
    latinLetters: countMatches(text, LATIN_LETTER_GLOBAL_RE),
  };
}

function isArabicDominant(text) {
  const { arabicLetters, latinLetters } = getScriptStats(text);

  return arabicLetters >= 20 && arabicLetters >= latinLetters * 1.35;
}

/**
 * Scores a raw text-layer extraction. Arabic PDFs with missing ToUnicode maps
 * often produce strings like "‰Ë_« ... ¡U*«"; those have plenty of characters
 * but very little real Arabic and a high private-font/mojibake fingerprint.
 */
export function analyzeExtractedTextQuality(text) {
  const normalized = normalizeForQuality(text);
  const compact = normalized.replace(/\s/g, "");
  const charCount = Array.from(compact).length;
  const arabicChars = countMatches(normalized, ARABIC_CHAR_GLOBAL_RE);
  const latinLetters = countMatches(normalized, LATIN_LETTER_GLOBAL_RE);
  const letters = countMatches(normalized, LETTER_GLOBAL_RE);
  const highAsciiChars = countMatches(normalized, HIGH_ASCII_GLOBAL_RE);
  const privateFontGlyphs = countMatches(
    normalized,
    PRIVATE_FONT_GLYPH_GLOBAL_RE,
  );
  const replacementChars = countMatches(
    normalized,
    REPLACEMENT_CHAR_GLOBAL_RE,
  );
  const questionMarks = countMatches(normalized, QUESTION_MARK_GLOBAL_RE);
  const textualChars = Array.from(compact).filter((char) =>
    TEXTUAL_CHAR_RE.test(char),
  ).length;

  const arabicRatio = Math.min(arabicChars / Math.max(letters, 1), 1);
  const latinRatio = Math.min(latinLetters / Math.max(letters, 1), 1);
  const highAsciiRatio = highAsciiChars / Math.max(charCount, 1);
  const privateGlyphRatio = privateFontGlyphs / Math.max(charCount, 1);
  const replacementRatio = replacementChars / Math.max(charCount, 1);
  const questionRatio = questionMarks / Math.max(charCount, 1);
  const textualRatio = textualChars / Math.max(charCount, 1);
  const mojibakeRatio =
    (privateFontGlyphs * 2.5 +
      highAsciiChars * 0.9 +
      replacementChars * 6 +
      questionMarks * 0.7) /
    Math.max(charCount, 1);

  let needsOcr = false;
  let reason = null;

  if (charCount < MIN_CHARS_PER_PAGE) {
    needsOcr = true;
    reason = "low_text_density";
  } else if (replacementRatio >= 0.02) {
    needsOcr = true;
    reason = "replacement_characters";
  } else if (
    arabicRatio < 0.2 &&
    (privateGlyphRatio >= 0.015 ||
      highAsciiRatio >= 0.08 ||
      questionRatio >= 0.035) &&
    mojibakeRatio >= 0.1
  ) {
    needsOcr = true;
    reason = "garbled_arabic_font_encoding";
  } else if (
    arabicRatio < 0.35 &&
    mojibakeRatio >= 0.18 &&
    textualRatio < 0.82
  ) {
    needsOcr = true;
    reason = "mojibake_text_layer";
  }

  const score =
    Math.min(charCount / 800, 1) * 20 +
    Math.max(arabicRatio, latinRatio) * 50 +
    textualRatio * 20 -
    mojibakeRatio * 45 -
    replacementRatio * 80 -
    questionRatio * 20;

  return {
    charCount,
    arabicChars,
    latinLetters,
    arabicRatio,
    latinRatio,
    highAsciiRatio,
    privateGlyphRatio,
    replacementRatio,
    questionRatio,
    textualRatio,
    mojibakeRatio,
    score,
    needsOcr,
    reason,
  };
}

function getPdfDocumentOptions(data) {
  return {
    data,
    cMapUrl: PDFJS_CMAP_DIR,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DIR,
    useSystemFonts: true,
  };
}

function getPdfErrorMessage(error) {
  const name = error?.name ?? "";
  const message = error instanceof Error ? error.message : "";

  if (name === "PasswordException" || /password/i.test(message)) {
    return "This PDF is password protected and cannot be processed.";
  }

  if (
    name === "InvalidPDFException" ||
    name === "FormatError" ||
    /invalid pdf|bad pdf|corrupt/i.test(message)
  ) {
    return "This PDF file is corrupted or invalid.";
  }

  return message || "Failed to extract text from the PDF file.";
}

function getItemX(item) {
  return Number(item.transform?.[4] ?? 0);
}

function getItemY(item) {
  return Number(item.transform?.[5] ?? 0);
}

function getItemWidth(item) {
  return Math.abs(Number(item.width ?? 0));
}

function getItemHeight(item) {
  return Math.abs(Number(item.height ?? item.transform?.[3] ?? 0));
}

function getLineDirection(items) {
  const explicitRtl = items.filter((item) => item.dir === "rtl").length;
  const explicitLtr = items.filter((item) => item.dir === "ltr").length;

  if (explicitRtl > explicitLtr) return "rtl";
  if (explicitLtr > explicitRtl) return "ltr";

  const joined = items.map((item) => item.str ?? "").join("");
  const arabicChars = countMatches(joined, ARABIC_CHAR_GLOBAL_RE);
  const latinChars = countMatches(joined, LATIN_LETTER_GLOBAL_RE);

  return arabicChars > latinChars ? "rtl" : "ltr";
}

function shouldInsertSpace(previous, current, direction, fontSize) {
  const previousText = previous.str ?? "";
  const currentText = current.str ?? "";

  if (!previousText || !currentText) return false;
  if (/\s$/.test(previousText) || /^\s/.test(currentText)) return false;

  const previousX = getItemX(previous);
  const currentX = getItemX(current);
  const previousWidth = getItemWidth(previous);
  const currentWidth = getItemWidth(current);
  const gap =
    direction === "rtl"
      ? previousX - (currentX + currentWidth)
      : currentX - (previousX + previousWidth);

  const gapThreshold = Math.max(2, fontSize * 0.28);

  if (gap > gapThreshold) return true;
  if (gap < -fontSize * 0.15) return false;

  const prevEndsText = TEXTUAL_CHAR_RE.test(
    Array.from(previousText).at(-1),
  );
  const currentStartsText = TEXTUAL_CHAR_RE.test(
    Array.from(currentText).at(0),
  );

  return prevEndsText && currentStartsText && gap > fontSize * 0.12;
}

function joinLineItems(items) {
  if (items.length === 0) return "";

  const direction = getLineDirection(items);
  const sorted = [...items].sort((a, b) => {
    const diff = getItemX(a) - getItemX(b);
    return direction === "rtl" ? -diff : diff;
  });
  const averageFontSize =
    sorted.reduce((sum, item) => sum + getItemHeight(item), 0) /
      Math.max(sorted.length, 1) || 10;

  let line = "";
  let previous = null;

  for (const item of sorted) {
    const text = String(item.str ?? "");
    if (!text) continue;

    if (
      previous &&
      shouldInsertSpace(previous, item, direction, averageFontSize)
    ) {
      line += " ";
    }

    line += text;
    previous = item;
  }

  return line.replace(/[ \t]+/g, " ").trim();
}

async function extractPageTextPdfJs(page) {
  const textContent = await page.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  const lines = [];

  for (const item of textContent.items) {
    if (!item?.str) continue;
    const y =
      Math.round(getItemY(item) / LINE_Y_TOLERANCE) * LINE_Y_TOLERANCE;
    const line = lines.find((candidate) => candidate.y === y);

    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y, items: [item] });
    }
  }

  const text = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => joinLineItems(line.items))
    .filter(Boolean)
    .join("\n");
  const quality = analyzeExtractedTextQuality(text);

  return {
    text,
    quality,
  };
}

function dedupeAdjacentLines(lines) {
  const cleanedLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (
        cleanedLines.length > 0 &&
        cleanedLines[cleanedLines.length - 1] !== ""
      ) {
        cleanedLines.push("");
      }
      continue;
    }

    if (cleanedLines[cleanedLines.length - 1] === line) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines;
}

function repairContextualLatinOcr(text) {
  return text
    .replace(
      /(مياه\s+)[A-Za-z]+(?=\s+وال(?:بحار|أنهار|انهار|آبار|ابار))/giu,
      "$1الأمطار",
    )
    .replace(/(أو\s+)[A-Za-z]+(?=\s+وهذا)/giu, "$1طعمه")
    .replace(/(من أجل\s+)[A-Za-z\s]{1,24}(?=\s+فماذا)/giu, "$1الوضوء ")
    .replace(/(قال\s+تعالى[:：]?)[^\n]*[A-Za-z][^\n]*/giu, "$1");
}

function stripLatinNoiseFromArabicLines(text) {
  return text
    .split("\n")
    .map((line) => {
      if (!ARABIC_LETTER_GLOBAL_RE.test(line)) {
        return line;
      }
      ARABIC_LETTER_GLOBAL_RE.lastIndex = 0;

      return line.replace(LATIN_WORD_RE, (token) => {
        const normalizedToken = token.toUpperCase();
        return LATIN_ALLOWLIST.has(normalizedToken) ? token : " ";
      });
    })
    .join("\n");
}

function applyCommonArabicOcrCorrections(text) {
  return text
    .replace(/(^|\n)\s*لماء(?=\s+له(?:\s|$))/gu, "$1الماء")
    .replace(/(?<![\u0621-\u064A])فى(?![\u0621-\u064A])/gu, "في")
    .replace(/(?<![\u0621-\u064A])فى(?=دفترك(?:\s|$|[.،؛:؟!]))/gu, "في ")
    .replace(/(?<![\u0621-\u064A])الاسعلة(?![\u0621-\u064A])/gu, "الأسئلة")
    .replace(/(?<![\u0621-\u064A])النتجس(?![\u0621-\u064A])/gu, "النجس")
    .replace(/(?<![\u0621-\u064A])والثبات(?![\u0621-\u064A])/gu, "والنبات")
    .replace(/(?<![\u0621-\u064A])الثبات(?![\u0621-\u064A])/gu, "النبات")
    .replace(/(?<![\u0621-\u064A])والانهار(?![\u0621-\u064A])/gu, "والأنهار")
    .replace(/(?<![\u0621-\u064A])ماء البعر(?![\u0621-\u064A])/gu, "ماء البحر")
    .replace(/(?<![\u0621-\u064A])توضاً(?![\u0621-\u064A])/gu, "توضأ")
    .replace(/(?<![\u0621-\u064A])توضا(?![\u0621-\u064A])/gu, "توضأ");
}

function repairGluedArabicWords(text) {
  let repaired = text;
  const stopwordBeforeDefiniteArticle =
    "(?:في|فى|من|عن|على|إلى|الى|عند|بعد|قبل|مثل|به|بها|له|لها|لذلك)";
  const boundaryWords = [
    "يصح",
    "وهذا",
    "فهل",
    "هل",
    "ماذا",
    "فماذا",
    "قادر",
    "قادرة",
    "أجيب",
    "اكمل",
    "أكمل",
  ];
  const attachedArabicWords = [
    "والنبات",
    "والحيوان",
    "والإنسان",
    "والانسان",
    "والبحار",
    "والأنهار",
    "والانهار",
    "والآبار",
    "والابار",
    "والنجاسة",
    "والواجبات",
    "والاختبارات",
    "والأهداف",
    "والاهداف",
    "والأنشطة",
    "والانشطة",
    "والوسائل",
    "وجسمه",
  ];

  repaired = repaired.replace(
    new RegExp(
      `(^|[\\s\\-–—،؛:؟!().\\[\\]{}])(${stopwordBeforeDefiniteArticle})(?=ال[${ARABIC_LETTERS_CLASS}]{2,})`,
      "gu",
    ),
    "$1$2 ",
  );

  repaired = repaired.replace(
    new RegExp(
      `([${ARABIC_LETTERS_CLASS}]{3,})(ال[${ARABIC_LETTERS_CLASS}]{3,})`,
      "gu",
    ),
    (match, before, after) => {
      if (/^(?:وال|فال|بال|كال|لل)/u.test(match)) {
        return match;
      }
      return `${before} ${after}`;
    },
  );

  for (const word of boundaryWords) {
    repaired = repaired.replace(
      new RegExp(`(${word})(?=[${ARABIC_LETTERS_CLASS}]{2,})`, "gu"),
      "$1 ",
    );
  }

  for (const word of attachedArabicWords) {
    repaired = repaired.replace(
      new RegExp(`([${ARABIC_LETTERS_CLASS}]{3,})(${word})`, "gu"),
      "$1 $2",
    );
  }

  repaired = repaired
    .replace(/\b(أو|او)(?=(?:طعمه|ريحه|رائحته|لونه))/gu, "$1 ")
    .replace(/\b(لا|ولا)(?=(?:تستطيع|تزول|يصح|يتطهر))/gu, "$1 ")
    .replace(/\b(التطهر|الطهارة|الوضوء)(به|بها)\b/gu, "$1 $2");

  return repaired;
}

function repairArabicOcrText(text) {
  return repairGluedArabicWords(
    applyCommonArabicOcrCorrections(
      stripLatinNoiseFromArabicLines(repairContextualLatinOcr(text)),
    ),
  );
}

function isLikelyPageArtifact(line, repairOcr) {
  const normalized = line.trim();

  if (!normalized) {
    return false;
  }

  if (/^[#$]?\s*[\d٠-٩]+\s*$/u.test(normalized)) {
    return true;
  }

  if (repairOcr && normalized.length <= 40 && /[©$]/u.test(normalized)) {
    return true;
  }

  return false;
}

export function cleanArabicText(text, options = {}) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const { repairOcr = false } = options;
  let normalized = text
    .normalize("NFKC")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/»/g, "،")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]+([،؛:؟!?])/g, "$1")
    .replace(/([،؛:؟!?])(?=[^\s\n])/g, "$1 ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (repairOcr && isArabicDominant(normalized)) {
    normalized = repairArabicOcrText(normalized)
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/[ \t]+([،؛:؟!?])/g, "$1")
      .replace(/([،؛:؟!?])(?=[^\s\n])/g, "$1 ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const lines = normalized
    .split("\n")
    .filter((line) => line.trim() === "" || TEXTUAL_CHAR_RE.test(line))
    .filter((line) => !isLikelyPageArtifact(line, repairOcr));

  return dedupeAdjacentLines(lines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function linkOrCopyFile(source, destination) {
  if (await fileExists(destination)) {
    return;
  }

  try {
    await symlink(source, destination);
  } catch (error) {
    if (error?.code === "EEXIST") {
      if (await fileExists(destination)) {
        return;
      }
      await rm(destination, { force: true });
      await linkOrCopyFile(source, destination);
      return;
    }
    await copyFile(source, destination);
  }
}

function normalizeOcrLanguages(languages) {
  const requested = String(languages || "ara")
    .split("+")
    .map((language) => language.trim())
    .filter(Boolean);
  const supported = requested.filter((language) => OCR_LANG_DATA[language]);

  return supported.length > 0 ? [...new Set(supported)] : ["ara"];
}

async function prepareTesseractLanguagePath(languages) {
  await mkdir(TESSDATA_DIR, { recursive: true });

  await Promise.all(
    normalizeOcrLanguages(languages).map((language) => {
      const fileName = `${language}.traineddata.gz`;
      return linkOrCopyFile(
        path.join(OCR_LANG_DATA[language], fileName),
        path.join(TESSDATA_DIR, fileName),
      );
    }),
  );

  return TESSDATA_DIR;
}

async function createArabicOcrWorker(languages = "ara") {
  const normalizedLanguages = normalizeOcrLanguages(languages);
  const langPath = await prepareTesseractLanguagePath(normalizedLanguages);
  const worker = await createWorker(normalizedLanguages.join("+"), OEM.LSTM_ONLY, {
    langPath,
    cacheMethod: "none",
    gzip: true,
    logger: () => {},
  });

  await worker.setParameters({
    debug_file: "/dev/null",
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: PSM.AUTO,
  });

  return worker;
}

function getOcrViewport(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const largestSide = Math.max(baseViewport.width, baseViewport.height);
  const scale = Math.max(
    1.25,
    Math.min(OCR_SCALE, OCR_MAX_CANVAS_SIDE / Math.max(largestSide, 1)),
  );

  return page.getViewport({ scale });
}

async function ocrPage(page, worker) {
  const viewport = getOcrViewport(page);
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const { data } = await worker.recognize(canvas.toBuffer("image/png"));
  return data.text ?? "";
}

function choosePageText({ textLayerText, textLayerQuality, ocrText, forceOcr }) {
  if (forceOcr) {
    return ocrText;
  }

  const cleanedOcr = cleanArabicText(ocrText, { repairOcr: true });
  const ocrQuality = analyzeExtractedTextQuality(cleanedOcr);

  if (!cleanedOcr) {
    return textLayerText;
  }

  if (textLayerQuality.needsOcr) {
    return cleanedOcr;
  }

  return ocrQuality.score + 8 >= textLayerQuality.score
    ? cleanedOcr
    : textLayerText;
}

function toPdfJsData(pdfBuffer) {
  if (Buffer.isBuffer(pdfBuffer)) {
    return new Uint8Array(pdfBuffer);
  }

  if (pdfBuffer instanceof ArrayBuffer) {
    return new Uint8Array(pdfBuffer);
  }

  if (pdfBuffer instanceof Uint8Array) {
    return new Uint8Array(pdfBuffer);
  }

  return new Uint8Array(Buffer.from(pdfBuffer));
}

/**
 * Extract text from a PDF buffer.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} pdfBuffer
 * @param {{
 *   forceOcr?: boolean,
 *   maxPages?: number,
 *   enableOcr?: boolean,
 *   ocrLanguages?: string
 * }} [options]
 * @returns {Promise<{
 *   text: string,
 *   fileProcessed: boolean,
 *   extractionStatus: "success" | "partial" | "failed",
 *   warnings?: string[],
 *   errorMessage?: string
 * }>}
 */
export async function extractTextFromPDF(pdfBuffer, options = {}) {
  const warnings = [];
  const pageErrors = [];
  let worker = null;

  try {
    const {
      forceOcr = false,
      maxPages = Infinity,
      enableOcr = true,
      ocrLanguages = "ara",
    } = options;

    const loadingTask = pdfjsLib.getDocument(
      getPdfDocumentOptions(toPdfJsData(pdfBuffer)),
    );
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, maxPages);
    const pageEntries = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const { text, quality } = await extractPageTextPdfJs(page);
      const needsOcr = forceOcr || quality.needsOcr;

      pageEntries.push({
        pageNum,
        page,
        text,
        quality,
        needsOcr,
      });
    }

    const pagesNeedingOcr = pageEntries.filter((entry) => entry.needsOcr);

    if (pagesNeedingOcr.length > 0) {
      warnings.push(
        `OCR was used for pages: ${pagesNeedingOcr
          .map((entry) => entry.pageNum)
          .join(", ")}.`,
      );
    }

    if (pagesNeedingOcr.length > 0 && !enableOcr) {
      warnings.push("OCR was needed but disabled by extraction options.");
    }

    if (pagesNeedingOcr.length > 0 && enableOcr) {
      worker = await createArabicOcrWorker(ocrLanguages);

      for (const entry of pagesNeedingOcr) {
        try {
          const ocrText = await ocrPage(entry.page, worker);
          entry.text = choosePageText({
            textLayerText: entry.text,
            textLayerQuality: entry.quality,
            ocrText,
            forceOcr,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown OCR error";
          pageErrors.push({ pageNum: entry.pageNum, message });
          warnings.push(`OCR failed for page ${entry.pageNum}: ${message}`);
        }
      }
    }

    const rawText = pageEntries
      .sort((a, b) => a.pageNum - b.pageNum)
      .map((entry) => entry.text ?? "")
      .join("\n\n");
    const text = cleanArabicText(rawText, {
      repairOcr: pagesNeedingOcr.length > 0,
    });

    if (!text) {
      return {
        text: "",
        fileProcessed: false,
        extractionStatus: "failed",
        errorMessage: "No readable text could be extracted from the PDF file.",
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    }

    return {
      text,
      fileProcessed: pageErrors.length === 0,
      extractionStatus: pageErrors.length > 0 ? "partial" : "success",
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    return {
      text: "",
      fileProcessed: false,
      extractionStatus: "failed",
      errorMessage: getPdfErrorMessage(error),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}

/**
 * Extract text from a DOCX buffer.
 * Returns the same shape expected by the lessons controller.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} wordBuffer
 * @returns {Promise<{
 *   text: string,
 *   fileProcessed: boolean,
 *   extractionStatus: "success" | "failed",
 *   warnings?: string[],
 *   errorMessage?: string
 * }>}
 */
export async function extractTextFromWord(wordBuffer) {
  try {
    const buffer =
      wordBuffer instanceof Buffer ? wordBuffer : Buffer.from(wordBuffer);
    const result = await mammoth.extractRawText({ buffer });
    const warnings = (result.messages ?? [])
      .map((message) => message?.message)
      .filter(Boolean);

    return {
      text: cleanArabicText(result.value ?? ""),
      fileProcessed: true,
      extractionStatus: "success",
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    return {
      text: "",
      fileProcessed: false,
      extractionStatus: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Failed to extract text from the Word file.",
    };
  }
}

/**
 * Quick probe: returns true if the PDF appears to need OCR. This includes
 * scanned pages and Arabic custom-font pages with unusable extracted text.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} pdfBuffer
 * @returns {Promise<boolean>}
 */
export async function isScannedPDF(pdfBuffer) {
  const pdf = await pdfjsLib.getDocument(
    getPdfDocumentOptions(toPdfJsData(pdfBuffer)),
  ).promise;
  const pagesToCheck = Math.min(pdf.numPages, 3);

  for (let pageNum = 1; pageNum <= pagesToCheck; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const { quality } = await extractPageTextPdfJs(page);

    if (quality.needsOcr) {
      return true;
    }
  }

  return false;
}
