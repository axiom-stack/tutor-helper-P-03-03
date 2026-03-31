import JSZip from "jszip";

const RTL_PART_PATH_PATTERN =
  /^word\/(document\.xml|styles\.xml|numbering\.xml|header\d+\.xml|footer\d+\.xml)$/u;

/**
 * Ensure the final Word section is marked as RTL so Word opens the document
 * in the correct text direction without manual icon clicks.
 *
 * The docx library already emits RTL paragraphs/tables, but it does not
 * serialize the section-level <w:bidi/> flag that Word uses for the initial
 * editing direction.
 *
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function ensureDocxRtl(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlPaths = Object.keys(zip.files).filter((path) =>
    RTL_PART_PATH_PATTERN.test(path),
  );

  if (!xmlPaths.length) return buffer;

  let changed = false;
  for (const path of xmlPaths) {
    const xmlFile = zip.file(path);
    if (!xmlFile) continue;

    const xml = await xmlFile.async("string");
    const updatedXml = ensureRtlInXmlPart(xml);
    if (updatedXml !== xml) {
      zip.file(path, updatedXml);
      changed = true;
    }
  }

  if (!changed) return buffer;
  return await zip.generateAsync({ type: "nodebuffer" });
}

function ensureRtlInXmlPart(xml) {
  let nextXml = xml;
  nextXml = addSectionBidiFlag(nextXml);
  nextXml = addParagraphBidiFlags(nextXml);
  nextXml = addRunRtlFlags(nextXml);
  nextXml = addTableBidiVisual(nextXml);
  return nextXml;
}

function addSectionBidiFlag(xml) {
  let nextXml = xml.replace(/<w:sectPr\b([^>]*)\/>/gu, (full, attrs) => {
    if (full.includes("<w:bidi")) return full;
    return `<w:sectPr${attrs}><w:bidi/></w:sectPr>`;
  });

  nextXml = nextXml.replace(
    /<w:sectPr\b([^>]*)>([\s\S]*?)<\/w:sectPr>/gu,
    (full, attrs, inner) => {
      if (inner.includes("<w:bidi")) return full;
      return `<w:sectPr${attrs}><w:bidi/>${inner}</w:sectPr>`;
    },
  );

  return nextXml;
}

function addParagraphBidiFlags(xml) {
  let nextXml = xml.replace(/<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/gu, (full, attrs, inner) => {
    if (inner.includes("<w:bidi")) return full;
    return `<w:pPr${attrs}><w:bidi/>${inner}</w:pPr>`;
  });

  nextXml = nextXml.replace(/<w:pPr\b([^>]*)\/>/gu, (full, attrs) => {
    if (full.includes("<w:bidi")) return full;
    return `<w:pPr${attrs}><w:bidi/></w:pPr>`;
  });

  nextXml = nextXml.replace(/<w:p\b([^>]*)>(?!\s*<w:pPr\b)/gu, "<w:p$1><w:pPr><w:bidi/></w:pPr>");
  return nextXml;
}

function addRunRtlFlags(xml) {
  let nextXml = xml.replace(/<w:rPr\b([^>]*)>([\s\S]*?)<\/w:rPr>/gu, (full, attrs, inner) => {
    if (inner.includes("<w:rtl")) return full;
    return `<w:rPr${attrs}><w:rtl/>${inner}</w:rPr>`;
  });

  nextXml = nextXml.replace(/<w:rPr\b([^>]*)\/>/gu, (full, attrs) => {
    if (full.includes("<w:rtl")) return full;
    return `<w:rPr${attrs}><w:rtl/></w:rPr>`;
  });

  nextXml = nextXml.replace(/<w:r\b([^>]*)>(?!\s*<w:rPr\b)/gu, "<w:r$1><w:rPr><w:rtl/></w:rPr>");
  return nextXml;
}

function addTableBidiVisual(xml) {
  let nextXml = xml.replace(/<w:tblPr\b([^>]*)>([\s\S]*?)<\/w:tblPr>/gu, (full, attrs, inner) => {
    if (inner.includes("<w:bidiVisual")) return full;
    return `<w:tblPr${attrs}><w:bidiVisual/>${inner}</w:tblPr>`;
  });
  nextXml = nextXml.replace(/<w:tblPr\b([^>]*)\/>/gu, (full, attrs) => {
    if (full.includes("<w:bidiVisual")) return full;
    return `<w:tblPr${attrs}><w:bidiVisual/></w:tblPr>`;
  });
  return nextXml;
}
