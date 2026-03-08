import mammoth from "mammoth";
import {
  FormatError,
  InvalidPDFException,
  PasswordException,
  PDFParse,
} from "pdf-parse";

const MIN_TEXT_PER_PAGE = 12;

function buildFailureResult(errorMessage) {
  return {
    text: "",
    fileProcessed: false,
    extractionStatus: "failed",
    warnings: [],
    errorMessage,
  };
}

function getPdfErrorMessage(error) {
  if (error instanceof PasswordException) {
    return "This PDF is password protected and cannot be processed.";
  }

  if (error instanceof InvalidPDFException || error instanceof FormatError) {
    return "This PDF file is corrupted or invalid.";
  }

  return "Failed to extract text from the PDF file.";
}

export async function extractTextFromPDF(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = result?.text ?? "";
    const pageCount = result?.total ?? 1;
    const nonWhitespaceLength = text.replace(/\s/gu, "").length;
    const warnings = [];
    let extractionStatus = "success";

    if (
      nonWhitespaceLength > 0 &&
      nonWhitespaceLength < Math.max(MIN_TEXT_PER_PAGE, pageCount * 8)
    ) {
      extractionStatus = "partial";
      warnings.push(
        "This PDF appears to contain very little embedded text and may be scanned or image-based.",
      );
    }

    return {
      text,
      fileProcessed: nonWhitespaceLength > 0,
      extractionStatus,
      warnings,
    };
  } catch (error) {
    return buildFailureResult(getPdfErrorMessage(error));
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function extractTextFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result?.value ?? "";
    const warnings =
      result?.messages?.map((message) => message.message).filter(Boolean) ?? [];

    return {
      text,
      fileProcessed: text.trim().length > 0,
      extractionStatus: warnings.length > 0 ? "partial" : "success",
      warnings,
    };
  } catch (_error) {
    return buildFailureResult("Failed to extract text from the DOCX file.");
  }
}
