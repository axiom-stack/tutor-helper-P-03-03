// Validation utility functions used across controllers
// They return a boolean indicating whether the input is valid or not

import { getFileExtension } from "./normalization.js";

export function isPdfUpload(file) {
  const extension = getFileExtension(file?.originalname);
  return file?.mimetype === "application/pdf" || extension === ".pdf";
}

export function isDocxUpload(file) {
  const extension = getFileExtension(file?.originalname);
  const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file?.mimetype === DOCX_MIME || extension === ".docx";
}

export function isLegacyDocUpload(file) {
  const extension = getFileExtension(file?.originalname);
  return file?.mimetype === "application/msword" || extension === ".doc";
}

export function isValidPlanId(id) {
  return typeof id === "string" && /^(trd|act)_\d+$/.test(id.trim());
}

export function isValidAssignmentId(id) {
  return (
    typeof id === "string" &&
    id.trim().startsWith("asn_") &&
    /^asn_\d+$/.test(id.trim())
  );
}

export function isValidExamId(id) {
  return typeof id === "string" && /^exm_\d+$/.test(id.trim());
}
