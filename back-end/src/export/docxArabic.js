import { AlignmentType, Paragraph, Table, TextRun } from "docx";

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function createArabicTextRun(text, options = {}) {
  return new TextRun({
    ...options,
    text: normalizeText(text),
    rightToLeft: true,
    rtl: true,
  });
}

export function createArabicParagraph(childrenOrText, options = {}) {
  const {
    alignment = AlignmentType.RIGHT,
    textRunOptions = {},
    children: explicitChildren,
    ...rest
  } = options;

  let children = explicitChildren;
  if (!children) {
    if (Array.isArray(childrenOrText)) {
      children = childrenOrText;
    } else {
      children = [createArabicTextRun(childrenOrText, textRunOptions)];
    }
  }

  return new Paragraph({
    ...rest,
    alignment,
    bidirectional: true,
    bidi: true,
    children,
  });
}

export function createArabicCenteredParagraph(childrenOrText, options = {}) {
  return createArabicParagraph(childrenOrText, {
    ...options,
    alignment: AlignmentType.CENTER,
  });
}

export function createRtlTable(options) {
  return new Table({
    ...options,
    alignment: AlignmentType.RIGHT,
    visuallyRightToLeft: true,
  });
}
