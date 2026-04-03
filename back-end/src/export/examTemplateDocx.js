import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import PizZip from "pizzip";
import sharp from "sharp";

import { QUESTION_TYPES } from "../exams/types.js";
import { parseImageDataUrl } from "../utils/imageDataUrl.js";
import {
  getVisiblePlaceholderDataUrl,
  resolveSchoolLogoForExport,
} from "./schoolLogoResolver.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, "../../template.docx");
const IMAGE_MODULE_NAME = "open-xml-templating/docxtemplater-image-module";

const ARABIC_DIGITS = Object.freeze({
  0: "٠",
  1: "١",
  2: "٢",
  3: "٣",
  4: "٤",
  5: "٥",
  6: "٦",
  7: "٧",
  8: "٨",
  9: "٩",
});

const SECTION_TITLES = Object.freeze({
  true_false: "أجب بنعم أو لا",
  mcq: "اختر الإجابة الصحيحة",
  fill_blank: "أكمل الفراغ",
  written: "أجب عن الأسئلة الآتية",
});

const EMPTY_LOGO_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const EMPTY_LOGO_BUFFER = Buffer.from(EMPTY_LOGO_PNG_BASE64, "base64");
const EMPTY_LOGO_DATA_URL = `data:image/png;base64,${EMPTY_LOGO_PNG_BASE64}`;
const SCHOOL_LOGO_SIZE = Object.freeze([44, 44]);
const DEFAULT_MINISTRY_NAME = "وزارة التربية والتعليم";
const DEFAULT_GOVERNORATE_NAME = "محافظة عدن";
export const QUESTION_SLOT_COUNTS = Object.freeze({
  true_false: 3,
  mcq: 3,
  fill_blank: 2,
  written: 2,
});
const HEADER_NAMESPACE_DECLARATIONS = Object.freeze([
  [
    "wp",
    "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  ],
  [
    "r",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  ],
]);
const SCHOOL_LOGO_MIME_EXTENSION_MAP = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "png",
  "image/gif": "png",
  "image/bmp": "png",
  "image/tiff": "png",
  "image/x-icon": "png",
  "image/vnd.microsoft.icon": "png",
  "image/svg+xml": "png",
});
const TEMPLATE_LOGO_TOKEN_PATTERN = /school_logo(?:_url)?/iu;
const TEMPLATE_TAG_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/gu;
const BIDI_CONTROL_CHAR_PATTERN = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const DYNAMIC_QUESTION_LOOP_PATHS = Object.freeze([
  "true_false_questions",
  "mcq_questions",
  "fill_blank_questions",
  "written_questions",
]);
const EXAM_DOCX_STRICT_LOGO_PLACEHOLDER = /^(1|true|yes|on)$/iu.test(
  String(process.env.EXAM_DOCX_STRICT_LOGO_PLACEHOLDER ?? ""),
);
const templateQuestionLoopSupportCache = new Map();

function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).replace(/\r\n/g, "\n").trim();
  return text.length ? text : fallback;
}

function toArabicDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

function displayText(value, fallback = "") {
  return toArabicDigits(safeText(value, fallback));
}

function displayIdentifier(value, fallback = "") {
  return safeText(value, fallback);
}

function rawText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\r\n/g, "\n");
}

function normalizeQuestionType(question) {
  return safeText(question?.question_type ?? question?.type).toLowerCase();
}

function splitFillBlankQuestionText(questionText) {
  const text = rawText(questionText);
  const match = text.match(/^(.*?)(_+)(.*)$/s);

  if (!match) {
    return {
      prefix: displayText(text, ""),
      suffix: "",
    };
  }

  return {
    prefix: displayText(match[1], ""),
    suffix: displayText(match[3], ""),
  };
}

function normalizeOptions(question) {
  const rawOptions = Array.isArray(question?.options)
    ? question.options
    : Array.isArray(question?.choices)
      ? question.choices
      : [];

  return Array.from({ length: 4 }, (_, index) => displayText(rawOptions[index] ?? ""));
}

function normalizeQuestion(question, displayNumber) {
  const questionType = normalizeQuestionType(question);
  const markRaw = Number(question?.marks ?? question?.mark ?? 0) || 0;
  const questionTextRaw = rawText(question?.question_text ?? question?.text);
  const options = normalizeOptions(question);
  const correctOptionIndex = Number.isInteger(question?.correct_option_index)
    ? question.correct_option_index
    : Number.isInteger(question?.correctIndex)
      ? question.correctIndex
      : null;
  const correctAnswer =
    typeof question?.correct_answer === "boolean"
      ? question.correct_answer
      : typeof question?.correctAnswer === "boolean"
        ? question.correctAnswer
        : null;
  const answerText = displayText(question?.answer_text ?? question?.answerText);
  const fillBlankParts =
    questionType === QUESTION_TYPES.FILL_BLANK
      ? splitFillBlankQuestionText(questionTextRaw)
      : { prefix: "", suffix: "" };

  return {
    number_raw: displayNumber,
    number: toArabicDigits(displayNumber),
    text: displayText(questionTextRaw),
    prefix: fillBlankParts.prefix,
    suffix: fillBlankParts.suffix,
    mark_raw: markRaw,
    mark: toArabicDigits(markRaw),
    options,
    option_a: options[0] ?? "",
    option_b: options[1] ?? "",
    option_c: options[2] ?? "",
    option_d: options[3] ?? "",
    answer_text:
      answerText ||
      (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && correctOptionIndex != null
        ? options[correctOptionIndex] ?? ""
        : questionType === QUESTION_TYPES.TRUE_FALSE && correctAnswer != null
          ? correctAnswer
            ? "صح"
            : "خطأ"
          : ""),
    correct_option_index: correctOptionIndex,
    correct_answer: correctAnswer,
    answer_area: "",
    rubric: Array.isArray(question?.rubric)
      ? question.rubric.map((item) => displayText(item)).filter(Boolean)
      : [],
    question_type: questionType,
  };
}

function bucketQuestions(rawQuestions) {
  const buckets = {
    true_false: [],
    mcq: [],
    fill_blank: [],
    written: [],
  };

  for (const question of rawQuestions) {
    if (!question || typeof question !== "object") {
      continue;
    }

    const questionType = normalizeQuestionType(question);

    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
      buckets.true_false.push(question);
    } else if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
      buckets.mcq.push(question);
    } else if (questionType === QUESTION_TYPES.FILL_BLANK) {
      buckets.fill_blank.push(question);
    } else if (questionType === QUESTION_TYPES.OPEN_ENDED) {
      buckets.written.push(question);
    }
  }

  return buckets;
}

function buildQuestions(rawQuestions) {
  return rawQuestions.map((question, index) => normalizeQuestion(question, index + 1));
}

function sumMarks(questions) {
  return questions.reduce((sum, question) => sum + (Number(question?.mark_raw) || 0), 0);
}

function formatUniformMark(questions) {
  if (!questions.length) {
    return "—";
  }

  const firstMark = Number(questions[0]?.mark_raw) || 0;
  const uniform = questions.every((question) => (Number(question?.mark_raw) || 0) === firstMark);
  return uniform ? toArabicDigits(firstMark) : "متفاوت";
}

function buildSummaryFields(prefix, questions) {
  const totalMarks = sumMarks(questions);

  return {
    [`${prefix}_count`]: toArabicDigits(questions.length),
    [`${prefix}_mark_each`]: formatUniformMark(questions),
    [`${prefix}_section_marks`]: toArabicDigits(totalMarks),
    [`${prefix}_total_marks`]: toArabicDigits(totalMarks),
  };
}

function buildLegacyFields(
  prefix,
  questions,
  { slotCount = 2, includeOptions = false, includeFillParts = false } = {},
) {
  const fields = {};

  for (let index = 0; index < slotCount; index += 1) {
    const question = questions[index];
    const slot = index + 1;

    fields[`${prefix}_${slot}_number`] = question?.number ?? "";
    fields[`${prefix}_${slot}_text`] = question?.text ?? "";
    fields[`${prefix}_${slot}_mark`] = question?.mark ?? "";

    if (includeOptions) {
      fields[`${prefix}_${slot}_option_a`] = question?.option_a ?? "";
      fields[`${prefix}_${slot}_option_b`] = question?.option_b ?? "";
      fields[`${prefix}_${slot}_option_c`] = question?.option_c ?? "";
      fields[`${prefix}_${slot}_option_d`] = question?.option_d ?? "";
    }

    if (includeFillParts) {
      fields[`${prefix}_${slot}_prefix`] = question?.prefix ?? "";
      fields[`${prefix}_${slot}_suffix`] = question?.suffix ?? "";
    }

    if (prefix === "fill" || prefix === "written") {
      fields[`${prefix}_${slot}_answer_area`] = question?.answer_area ?? "";
    }
  }

  return fields;
}

function formatDateLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return displayText(value);
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDurationLabel(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "";
  }

  return `${toArabicDigits(Math.round(minutes))} دقيقة`;
}

function buildSectionQuestions(title, questions, type) {
  return {
    id: type,
    title,
    has_questions: questions.length > 0,
    question_count: toArabicDigits(questions.length),
    total_marks: toArabicDigits(sumMarks(questions)),
    questions,
  };
}

function buildSchoolLogoError(message) {
  return new Error(`school_logo render failed: ${message}`);
}

function decodeXmlEntities(text) {
  return String(text ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function extractVisibleWordText(xmlText) {
  return Array.from(String(xmlText ?? "").matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs))
    .map((match) => decodeXmlEntities(match[1]))
    .join("");
}

function normalizeSchoolLogoPlaceholderTag(placeHolderContent) {
  const compact = safeText(placeHolderContent)
    .replace(BIDI_CONTROL_CHAR_PATTERN, "")
    .replace(/\s+/gu, "")
    .replace(/^\{+|\}+$/gu, "")
    .toLowerCase();

  if (!compact) {
    return null;
  }

  const match = compact.match(/^(%*)(school_logo(?:_url)?)(%*)$/u);
  if (!match) {
    return null;
  }

  const totalPercentCount = (match[1]?.length ?? 0) + (match[3]?.length ?? 0);
  return {
    value: "school_logo",
    centered: totalPercentCount >= 2,
  };
}

async function getFallbackSchoolLogoBuffer() {
  const fallbackDataUrl = await getVisiblePlaceholderDataUrl();
  const parsedFallback = parseImageDataUrl(fallbackDataUrl);
  if (!parsedFallback) {
    return {
      buffer: EMPTY_LOGO_BUFFER,
      extension: "png",
    };
  }
  return {
    buffer: Buffer.from(parsedFallback.base64Data, "base64"),
    extension: "png",
  };
}

function normalizeSchoolLogoMimeType(mimeType) {
  const normalizedMimeType = safeText(mimeType).toLowerCase();
  if (!normalizedMimeType) {
    throw buildSchoolLogoError("missing image MIME type");
  }

  if (!SCHOOL_LOGO_MIME_EXTENSION_MAP[normalizedMimeType]) {
    throw buildSchoolLogoError(
      `unsupported image MIME type "${normalizedMimeType}". Use PNG, JPG, or JPEG.`,
    );
  }

  return {
    mimeType: normalizedMimeType,
  };
}

async function normalizeSchoolLogoBuffer(tagValue) {
  const rawTagValue = typeof tagValue === "string" ? tagValue.trim() : "";
  if (!rawTagValue) {
    return await getFallbackSchoolLogoBuffer();
  }

  const parsedLogo = parseImageDataUrl(rawTagValue);
  if (!parsedLogo) {
    return await getFallbackSchoolLogoBuffer();
  }

  let mimeType;
  try {
    mimeType = normalizeSchoolLogoMimeType(parsedLogo.mimeType).mimeType;
  } catch {
    return await getFallbackSchoolLogoBuffer();
  }

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(parsedLogo.base64Data, "base64");
  } catch {
    return await getFallbackSchoolLogoBuffer();
  }

  if (!imageBuffer.length) {
    return await getFallbackSchoolLogoBuffer();
  }

  if (mimeType === "image/png") {
    return {
      buffer: imageBuffer,
      extension: "png",
    };
  }

  try {
    const pngBuffer = await sharp(imageBuffer).png().toBuffer();
    return {
      buffer: pngBuffer,
      extension: "png",
    };
  } catch {
    return await getFallbackSchoolLogoBuffer();
  }
}

function createSchoolLogoModule() {
  const runtimeState = {
    nextImageExtension: "png",
  };

  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    setParser(placeHolderContent) {
      const normalizedTag = normalizeSchoolLogoPlaceholderTag(placeHolderContent);
      if (normalizedTag) {
        return {
          type: "placeholder",
          value: normalizedTag.value,
          module: IMAGE_MODULE_NAME,
          centered: normalizedTag.centered,
        };
      }

      return null;
    },
    async getImage(tagValue) {
      const normalizedLogo = await normalizeSchoolLogoBuffer(tagValue);
      runtimeState.nextImageExtension = normalizedLogo.extension;
      return normalizedLogo.buffer;
    },
    getSize() {
      return SCHOOL_LOGO_SIZE;
    },
  });

  imageModule.getNextImageName = function getNextImageNameWithMime() {
    const extension = runtimeState.nextImageExtension || "png";
    const name = `image_generated_${this.imageNumber}.${extension}`;
    this.imageNumber += 1;
    runtimeState.nextImageExtension = "png";
    return name;
  };

  return imageModule;
}

function ensureHeaderNamespaceDeclarations(xmlText) {
  const rootStart = xmlText.indexOf("<w:hdr");
  if (rootStart < 0) {
    return xmlText;
  }

  const rootEnd = xmlText.indexOf(">", rootStart);
  if (rootEnd < 0) {
    return xmlText;
  }

  const openingTag = xmlText.slice(rootStart, rootEnd);
  let patched = xmlText;
  let offset = 0;

  for (const [prefix, uri] of HEADER_NAMESPACE_DECLARATIONS) {
    if (openingTag.includes(`xmlns:${prefix}=`)) {
      continue;
    }

    const insertion = ` xmlns:${prefix}="${uri}"`;
    patched =
      patched.slice(0, rootEnd + offset) + insertion + patched.slice(rootEnd + offset);
    offset += insertion.length;
  }

  return patched;
}

function patchRenderedHeaderNamespaces(zip) {
  const headerFileNames = Object.keys(zip.files).filter((name) =>
    /^word\/header\d+\.xml$/.test(name),
  );

  for (const fileName of headerFileNames) {
    const file = zip.file(fileName);
    if (!file) {
      continue;
    }

    const headerXml = file.asText();
    if (headerXml.includes('xmlns:wp=') && headerXml.includes('xmlns:r=')) {
      continue;
    }

    zip.file(fileName, ensureHeaderNamespaceDeclarations(headerXml));
  }
}

function templateContainsSchoolLogoPlaceholder(zip) {
  const xmlNames = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/u.test(name),
  );

  const unrecognizedTags = new Set();
  let hasSupportedLogoTag = false;

  for (const fileName of xmlNames) {
    const file = zip.file(fileName);
    const xml = file?.asText?.() ?? "";
    const tagSources = [xml, extractVisibleWordText(xml)];

    for (const source of tagSources) {
      for (const match of source.matchAll(TEMPLATE_TAG_PATTERN)) {
        const tagContent = safeText(match[1]);
        if (!tagContent || !TEMPLATE_LOGO_TOKEN_PATTERN.test(tagContent)) {
          continue;
        }

        const normalized = normalizeSchoolLogoPlaceholderTag(tagContent);
        if (normalized) {
          hasSupportedLogoTag = true;
        } else {
          unrecognizedTags.add(tagContent);
        }
      }
    }
  }

  return {
    hasSupportedLogoTag,
    unrecognizedTags: Array.from(unrecognizedTags).slice(0, 6),
  };
}

function normalizeTemplateTagText(value) {
  return safeText(value)
    .replace(BIDI_CONTROL_CHAR_PATTERN, "")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function collectTemplateTags(zip) {
  const xmlNames = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/u.test(name),
  );

  const tags = [];
  for (const fileName of xmlNames) {
    const file = zip.file(fileName);
    const xml = file?.asText?.() ?? "";
    const tagSources = [xml, extractVisibleWordText(xml)];

    for (const source of tagSources) {
      for (const match of source.matchAll(TEMPLATE_TAG_PATTERN)) {
        const normalized = normalizeTemplateTagText(match[1]);
        if (normalized) {
          tags.push(normalized);
        }
      }
    }
  }

  return tags;
}

function detectDynamicQuestionLoopSupport(zip) {
  const tags = collectTemplateTags(zip);
  const tagSet = new Set(tags);

  const hasExplicitQuestionLoops = DYNAMIC_QUESTION_LOOP_PATHS.some(
    (path) => tagSet.has(`#${path}`) && tagSet.has(`/${path}`),
  );
  if (hasExplicitQuestionLoops) {
    return true;
  }

  const hasSectionsLoop = tagSet.has("#sections") && tagSet.has("/sections");
  const hasQuestionLoop = tagSet.has("#questions") && tagSet.has("/questions");
  return hasSectionsLoop && hasQuestionLoop;
}

export async function templateSupportsDynamicQuestionLoops(options = {}) {
  const templatePath =
    options.templatePath ?? process.env.EXAM_DOCX_TEMPLATE_PATH ?? DEFAULT_TEMPLATE_PATH;

  if (!templateQuestionLoopSupportCache.has(templatePath)) {
    const task = (async () => {
      const templateBuffer = await fs.readFile(templatePath);
      const zip = new PizZip(templateBuffer);
      return detectDynamicQuestionLoopSupport(zip);
    })().catch((error) => {
      templateQuestionLoopSupportCache.delete(templatePath);
      throw error;
    });
    templateQuestionLoopSupportCache.set(templatePath, task);
  }

  return await templateQuestionLoopSupportCache.get(templatePath);
}

export function buildExamTemplateContext(enrichedExam) {
  const rawQuestions = Array.isArray(enrichedExam?.questions) ? enrichedExam.questions : [];
  const buckets = bucketQuestions(rawQuestions);

  const trueFalseQuestions = buildQuestions(buckets.true_false);
  const mcqQuestions = buildQuestions(buckets.mcq);
  const fillBlankQuestions = buildQuestions(buckets.fill_blank);
  const writtenQuestions = buildQuestions(buckets.written);

  const computedTotalMarks = sumMarks([
    ...trueFalseQuestions,
    ...mcqQuestions,
    ...fillBlankQuestions,
    ...writtenQuestions,
  ]);
  const totalQuestions = Number(enrichedExam?.total_questions ?? rawQuestions.length) || 0;
  const totalMarks = Number(enrichedExam?.total_marks ?? computedTotalMarks) || computedTotalMarks;
  const q1Marks = sumMarks(trueFalseQuestions);
  const q2Marks = sumMarks(mcqQuestions);
  const q3Marks = sumMarks([...fillBlankQuestions, ...writtenQuestions]);

  return {
    institution_name: displayText(
      enrichedExam?.institution_name ?? enrichedExam?.school_name,
      "",
    ),
    school_name: displayText(enrichedExam?.school_name ?? enrichedExam?.institution_name, ""),
    ministry_name: displayText(enrichedExam?.ministry_name, DEFAULT_MINISTRY_NAME),
    governorate_name: displayText(enrichedExam?.governorate_name, DEFAULT_GOVERNORATE_NAME),
    faculty_name: displayText(enrichedExam?.faculty_name, ""),
    department_name: displayText(enrichedExam?.department_name, ""),
    exam_title: displayText(enrichedExam?.title, "—"),

    subject_name: displayText(enrichedExam?.subject_name, "—"),
    semester: displayText(enrichedExam?.semester ?? enrichedExam?.term, "—"),
    academic_year: displayText(enrichedExam?.academic_year, "—"),
    exam_date: formatDateLabel(enrichedExam?.exam_date ?? enrichedExam?.date ?? enrichedExam?.created_at),
    exam_duration: formatDurationLabel(enrichedExam?.duration_minutes),
    total_marks: toArabicDigits(totalMarks),
    total_questions: toArabicDigits(totalQuestions),
    exam_form_code: displayIdentifier(enrichedExam?.form_code ?? enrichedExam?.public_id, ""),
    instructor_name: displayText(enrichedExam?.teacher_name, "—"),
    grade_level: displayText(enrichedExam?.class_grade_label ?? enrichedExam?.class_name, "—"),

    student_name: displayText(enrichedExam?.student_name, ""),
    student_id: displayIdentifier(enrichedExam?.student_id, ""),
    student_section: displayText(
      enrichedExam?.student_section ?? enrichedExam?.class_section_label,
      "",
    ),
    seat_number: displayIdentifier(enrichedExam?.seat_number, ""),

    reviewer_name: displayText(enrichedExam?.reviewer_name, ""),
    approver_name: displayText(enrichedExam?.approver_name, ""),
    footer_note: displayText(enrichedExam?.footer_note, ""),
    school_logo_url: safeText(enrichedExam?.school_logo_url, ""),
    school_logo: safeText(enrichedExam?.school_logo_url, EMPTY_LOGO_DATA_URL),
    q1_marks: toArabicDigits(q1Marks),
    q2_marks: toArabicDigits(q2Marks),
    q3_marks: toArabicDigits(q3Marks),

    ...buildSummaryFields("true_false", trueFalseQuestions),
    ...buildSummaryFields("mcq", mcqQuestions),
    ...buildSummaryFields("fill_blank", fillBlankQuestions),
    ...buildSummaryFields("written", writtenQuestions),

    ...buildLegacyFields("tf", trueFalseQuestions, {
      slotCount: QUESTION_SLOT_COUNTS.true_false,
    }),
    ...buildLegacyFields("mcq", mcqQuestions, {
      slotCount: QUESTION_SLOT_COUNTS.mcq,
      includeOptions: true,
    }),
    ...buildLegacyFields("fill", fillBlankQuestions, {
      slotCount: QUESTION_SLOT_COUNTS.fill_blank,
      includeFillParts: true,
    }),
    ...buildLegacyFields("written", writtenQuestions, {
      slotCount: QUESTION_SLOT_COUNTS.written,
    }),

    true_false_questions: trueFalseQuestions,
    mcq_questions: mcqQuestions,
    fill_blank_questions: fillBlankQuestions,
    written_questions: writtenQuestions,

    sections: [
      buildSectionQuestions(SECTION_TITLES.true_false, trueFalseQuestions, "true_false"),
      buildSectionQuestions(SECTION_TITLES.mcq, mcqQuestions, "mcq"),
      buildSectionQuestions(SECTION_TITLES.fill_blank, fillBlankQuestions, "fill_blank"),
      buildSectionQuestions(SECTION_TITLES.written, writtenQuestions, "written"),
    ],
  };
}

export async function renderExamDocxFromTemplate(enrichedExam, options = {}) {
  const templatePath =
    options.templatePath ?? process.env.EXAM_DOCX_TEMPLATE_PATH ?? DEFAULT_TEMPLATE_PATH;

  let templateBuffer;
  try {
    templateBuffer = await fs.readFile(templatePath);
  } catch (error) {
    throw new Error(
      `Failed to read exam template at ${templatePath}: ${error?.message ?? error}`,
    );
  }

  const zip = new PizZip(templateBuffer);
  const logoTagInfo = templateContainsSchoolLogoPlaceholder(zip);
  if (!logoTagInfo.hasSupportedLogoTag) {
    const examplesSuffix =
      logoTagInfo.unrecognizedTags.length > 0
        ? ` Found unrecognized logo tags: ${logoTagInfo.unrecognizedTags
            .map((tag) => `"${tag}"`)
            .join(", ")}.`
        : "";
    const message =
      `Exam DOCX template "${templatePath}" does not include a supported school logo placeholder tag.` +
      " Supported variants: {{school_logo}}, {{%school_logo}}, {{%%school_logo}}, {{school_logo%%}}." +
      examplesSuffix;
    if (EXAM_DOCX_STRICT_LOGO_PLACEHOLDER) {
      throw new Error(message);
    }
    if (options.logger?.warn) {
      options.logger.warn({ template_path: templatePath }, message);
    } else {
      console.warn(message);
    }
  } else if (logoTagInfo.unrecognizedTags.length > 0) {
    const message =
      `Exam DOCX template "${templatePath}" contains unrecognized school logo placeholders that were ignored.`;
    if (options.logger?.warn) {
      options.logger.warn(
        {
          template_path: templatePath,
          unrecognized_logo_tags: logoTagInfo.unrecognizedTags,
        },
        message,
      );
    } else {
      console.warn(`${message} Tags: ${logoTagInfo.unrecognizedTags.join(", ")}`);
    }
  }

  const imageModule = createSchoolLogoModule();
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  const { exam: logoReadyExam } = await resolveSchoolLogoForExport(enrichedExam, {
    logger: options.logger,
  });
  const context = buildExamTemplateContext(logoReadyExam);

  try {
    await doc.renderAsync(context);
  } catch (error) {
    const details = error?.properties?.errors
      ?.map((item) => item?.message ?? item?.explanation ?? item?.properties?.explanation)
      .filter(Boolean);

    const message =
      details?.length > 0
        ? details.join("; ")
        : error?.message ?? "Unknown DOCX render error";

    throw new Error(`Failed to render exam template: ${message}`);
  }

  const renderedZip = doc.getZip();
  patchRenderedHeaderNamespaces(renderedZip);

  return Buffer.from(
    renderedZip.generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
  );
}
