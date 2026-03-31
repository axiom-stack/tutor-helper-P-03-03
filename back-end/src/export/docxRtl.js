import JSZip from "jszip";

const DOCUMENT_XML = "word/document.xml";

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
  const xmlFile = zip.file(DOCUMENT_XML);

  if (!xmlFile) {
    return buffer;
  }

  const documentXml = await xmlFile.async("string");
  const updatedXml = addRunRtlFlags(
    addParagraphBidiFlags(addSectionBidiFlag(documentXml)),
  );

  if (updatedXml === documentXml) {
    return buffer;
  }

  zip.file(DOCUMENT_XML, updatedXml);
  return await zip.generateAsync({ type: "nodebuffer" });
}

function addSectionBidiFlag(documentXml) {
  const startToken = "<w:sectPr>";
  const endToken = "</w:sectPr>";
  const startIndex = documentXml.lastIndexOf(startToken);

  if (startIndex === -1) {
    return documentXml;
  }

  const endIndex = documentXml.indexOf(endToken, startIndex);
  if (endIndex === -1) {
    return documentXml;
  }

  const sectionXml = documentXml.slice(startIndex, endIndex + endToken.length);
  if (sectionXml.includes("<w:bidi/>")) {
    return documentXml;
  }

  const insertAt = startIndex + startToken.length;
  return (
    documentXml.slice(0, insertAt) +
    "<w:bidi/>" +
    documentXml.slice(insertAt)
  );
}

function addParagraphBidiFlags(documentXml) {
  return documentXml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (match, inner) => {
    if (inner.includes("<w:bidi/>")) {
      return match;
    }
    return `<w:pPr><w:bidi/>${inner}</w:pPr>`;
  });
}

function addRunRtlFlags(documentXml) {
  return documentXml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (match, inner) => {
    if (inner.includes("<w:rtl/>")) {
      return match;
    }
    return `<w:rPr><w:rtl/>${inner}</w:rPr>`;
  });
}
