import Docxtemplater from 'docxtemplater';
// @ts-expect-error No type declarations available for docxtemplater-image-module-free
import ImageModule from 'docxtemplater-image-module-free';
import PizZip from 'pizzip';

import { TEMPLATE_CACHE_NAME } from '../examTemplateCache';
import examTemplateUrl from './templates/examTemplate.docx?url';
import { buildExamExportViewModel, toArabicDigits } from './examViewModel';
import { parseImageDataUrl } from './imageDataUrl';

const EMPTY_LOGO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const EMPTY_LOGO_DATA_URL = `data:image/png;base64,${EMPTY_LOGO_PNG_BASE64}`;
const IMAGE_MODULE_NAME = 'open-xml-templating/docxtemplater-image-module';
const SCHOOL_LOGO_SIZE = Object.freeze<[number, number]>([44, 44]);
const BIDI_CONTROL_CHAR_PATTERN =
  /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type TemplateQuestion = {
  number: string;
  text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  prefix?: string;
  suffix?: string;
};

type TemplateContext = {
  exam_title: string;
  grade_level: string;
  semester: string;
  school_logo: string;
  school_name: string;
  total_marks: string;
  q1_marks: string;
  q2_marks: string;
  q3_marks: string;
  true_false_questions: TemplateQuestion[];
  mcq_questions: TemplateQuestion[];
  fill_blank_questions: TemplateQuestion[];
  written_questions: TemplateQuestion[];
};

type QuestionLike = {
  displayNumber?: number;
  number?: number;
  text?: string;
  options?: Array<{ text?: string; label?: string } | string> | string[];
};

type SectionLike = {
  id: string;
  questions: QuestionLike[];
};

function safeText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).replace(/\r\n/g, '\n').trim();
  return text.length > 0 ? text : fallback;
}

function displayText(value: unknown, fallback = ''): string {
  return toArabicDigits(safeText(value, fallback));
}

function rawText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\r\n/g, '\n');
}

function splitFillBlankQuestionText(questionText: unknown): {
  prefix: string;
  suffix: string;
} {
  const text = rawText(questionText);
  const match = text.match(/^(.*?)(_+)(.*)$/s);

  if (!match) {
    return {
      prefix: displayText(text, ''),
      suffix: '',
    };
  }

  return {
    prefix: displayText(match[1], ''),
    suffix: displayText(match[3], ''),
  };
}

function getSectionQuestions(
  vm: ReturnType<typeof buildExamExportViewModel>,
  sectionId: string
) {
  return (
    vm.sections?.find((section: SectionLike) => section.id === sectionId)
      ?.questions ?? []
  );
}

function getFirstMatchingSectionQuestions(
  vm: ReturnType<typeof buildExamExportViewModel>,
  sectionIds: string[]
) {
  for (const sectionId of sectionIds) {
    const questions = getSectionQuestions(vm, sectionId);
    if (questions.length > 0) {
      return questions;
    }
  }

  return [];
}

function normalizeQuestionNumber(question: QuestionLike): string {
  return toArabicDigits(question.displayNumber ?? question.number ?? '');
}

function normalizeTrueFalseQuestions(
  questions: QuestionLike[]
): TemplateQuestion[] {
  return questions.map((question) => ({
    number: normalizeQuestionNumber(question),
    text: displayText(question.text, ''),
  }));
}

function normalizeMcqQuestions(questions: QuestionLike[]): TemplateQuestion[] {
  return questions.map((question) => {
    const options = Array.isArray(question.options) ? question.options : [];
    return {
      number: normalizeQuestionNumber(question),
      text: displayText(question.text, ''),
      option_a: displayText(
        typeof options[0] === 'string' ? options[0] : (options[0]?.text ?? '')
      ),
      option_b: displayText(
        typeof options[1] === 'string' ? options[1] : (options[1]?.text ?? '')
      ),
      option_c: displayText(
        typeof options[2] === 'string' ? options[2] : (options[2]?.text ?? '')
      ),
      option_d: displayText(
        typeof options[3] === 'string' ? options[3] : (options[3]?.text ?? '')
      ),
    };
  });
}

function normalizeFillBlankQuestions(
  questions: QuestionLike[]
): TemplateQuestion[] {
  return questions.map((question) => {
    const parts = splitFillBlankQuestionText(question.text);
    return {
      number: normalizeQuestionNumber(question),
      text: displayText(question.text, ''),
      prefix: parts.prefix,
      suffix: parts.suffix,
    };
  });
}

function normalizeWrittenQuestions(
  questions: QuestionLike[]
): TemplateQuestion[] {
  return questions.map((question) => ({
    number: normalizeQuestionNumber(question),
    text: displayText(question.text, ''),
  }));
}

function sumMarks(questions: QuestionLike[]): number {
  return questions.reduce(
    (sum, question) =>
      sum + (Number((question as { marks?: unknown }).marks) || 0),
    0
  );
}

function normalizeSchoolLogoPlaceholderTag(placeHolderContent: string) {
  const compact = safeText(placeHolderContent)
    .replace(BIDI_CONTROL_CHAR_PATTERN, '')
    .replace(/\s+/gu, '')
    .replace(/^\{+|\}+$/gu, '')
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
    value: 'school_logo',
    centered: totalPercentCount >= 2,
  };
}

function createSchoolLogoModule() {
  const runtimeState = {
    nextImageExtension: 'png',
  };

  const imageModule = new ImageModule({
    centered: false,
    fileType: 'docx',
    setParser(placeHolderContent: string) {
      const normalizedTag =
        normalizeSchoolLogoPlaceholderTag(placeHolderContent);
      if (normalizedTag) {
        return {
          type: 'placeholder',
          value: normalizedTag.value,
          module: IMAGE_MODULE_NAME,
          centered: normalizedTag.centered,
        };
      }

      return null;
    },
    async getImage(tagValue: string) {
      const parsedLogo = parseImageDataUrl(tagValue);
      if (!parsedLogo) {
        runtimeState.nextImageExtension = 'png';
        return decodeBase64ToBytes(EMPTY_LOGO_PNG_BASE64);
      }

      if (
        parsedLogo.mimeType === 'image/jpeg' ||
        parsedLogo.mimeType === 'image/jpg'
      ) {
        runtimeState.nextImageExtension = 'jpg';
        return decodeBase64ToBytes(parsedLogo.base64Data);
      }

      if (parsedLogo.mimeType === 'image/png') {
        runtimeState.nextImageExtension = 'png';
        return decodeBase64ToBytes(parsedLogo.base64Data);
      }

      runtimeState.nextImageExtension = 'png';
      return decodeBase64ToBytes(EMPTY_LOGO_PNG_BASE64);
    },
    getSize() {
      return SCHOOL_LOGO_SIZE;
    },
  });

  imageModule.getNextImageName = function getNextImageNameWithMime() {
    const extension = runtimeState.nextImageExtension || 'png';
    const name = `image_generated_${this.imageNumber}.${extension}`;
    this.imageNumber += 1;
    runtimeState.nextImageExtension = 'png';
    return name;
  };

  return imageModule;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/gu, '');
  if (typeof atob === 'function') {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return new Uint8Array();
}

async function readTemplateBuffer(): Promise<ArrayBuffer> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(TEMPLATE_CACHE_NAME);
      const cached = await cache.match(examTemplateUrl);
      if (cached) {
        return await cached.arrayBuffer();
      }
    } catch {
      // Cache lookup is best-effort only.
    }
  }

  const response = await fetch(examTemplateUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load offline DOCX template: ${response.status}`);
  }

  const clonedResponse = response.clone();
  const templateBuffer = await response.arrayBuffer();

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(TEMPLATE_CACHE_NAME);
      void cache.put(examTemplateUrl, clonedResponse).catch(() => {});
    } catch {
      // Ignore cache write failures and return the fetched bytes.
    }
  }

  return templateBuffer;
}

function buildTemplateContext(
  enrichedExam: Record<string, unknown>
): TemplateContext {
  const vm = buildExamExportViewModel(enrichedExam);
  const trueFalseQuestions = normalizeTrueFalseQuestions(
    getSectionQuestions(vm, 'true_false')
  );
  const mcqQuestions = normalizeMcqQuestions(getSectionQuestions(vm, 'mcq'));
  const fillBlankQuestions = normalizeFillBlankQuestions(
    getFirstMatchingSectionQuestions(vm, ['other_fill_blank', 'fill_blank'])
  );
  const writtenQuestions = normalizeWrittenQuestions(
    getFirstMatchingSectionQuestions(vm, ['written', 'other_open_ended'])
  );

  const totalMarks = Number(vm.examMeta.totalMarks) || 0;

  return {
    exam_title: displayText(vm.examMeta.title, '—'),
    grade_level: displayText(vm.examMeta.grade ?? vm.examMeta.className, '—'),
    semester: displayText(vm.examMeta.semester ?? vm.examMeta.term, '—'),
    school_logo: safeText(enrichedExam.school_logo_url, EMPTY_LOGO_DATA_URL),
    school_name: displayText(
      vm.examMeta.schoolName ?? vm.examMeta.institutionName,
      ''
    ),
    total_marks: toArabicDigits(totalMarks),
    q1_marks: toArabicDigits(sumMarks(getSectionQuestions(vm, 'true_false'))),
    q2_marks: toArabicDigits(sumMarks(getSectionQuestions(vm, 'mcq'))),
    q3_marks: toArabicDigits(
      sumMarks(
        getFirstMatchingSectionQuestions(vm, ['other_fill_blank', 'fill_blank'])
      ) +
        sumMarks(
          getFirstMatchingSectionQuestions(vm, ['written', 'other_open_ended'])
        )
    ),
    true_false_questions: trueFalseQuestions,
    mcq_questions: mcqQuestions,
    fill_blank_questions: fillBlankQuestions,
    written_questions: writtenQuestions,
  };
}

async function renderTemplateDocx(
  enrichedExam: Record<string, unknown>
): Promise<Blob> {
  const templateBuffer = await readTemplateBuffer();
  const zip = new PizZip(templateBuffer);
  const imageModule = createSchoolLogoModule();
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
  });

  const context = buildTemplateContext(enrichedExam);
  try {
    await doc.renderAsync(context);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown DOCX render error';
    throw new Error(`Failed to render offline exam Word template: ${message}`);
  }

  const renderedZip = doc.getZip();
  const output = renderedZip.generate({ type: 'uint8array' }) as Uint8Array;
  const outputBuffer = output.buffer.slice(
    output.byteOffset,
    output.byteOffset + output.byteLength
  ) as ArrayBuffer;
  return new Blob([outputBuffer], { type: MIME_DOCX });
}

export async function buildOfflineExamTemplateDocx(
  enrichedExam: Record<string, unknown>
): Promise<Blob> {
  return await renderTemplateDocx(enrichedExam);
}
