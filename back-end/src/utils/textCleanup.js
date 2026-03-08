function dedupeAdjacentLines(lines) {
  const cleanedLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (cleanedLines[cleanedLines.length - 1] !== "") {
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

export function cleanExtractedText(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const normalizedText = text
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gimu, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  const dedupedLines = dedupeAdjacentLines(normalizedText.split("\n"));

  return dedupedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
