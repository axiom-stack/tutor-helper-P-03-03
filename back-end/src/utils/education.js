// Grade label reference
export const GRADE_LABEL_OPTIONS = [
  "الصف الأول",
  "الصف الثاني",
  "الصف الثالث",
  "الصف الرابع",
  "الصف الخامس",
  "الصف السادس",
  "الصف السابع",
  "الصف الثامن",
  "الصف التاسع",
  "الصف العاشر",
  "الصف الحادي عشر",
  "الصف الثاني عشر",
];

export function getAllGrades() {
  return [...GRADE_LABEL_OPTIONS];
}

export function isValidGradeLabel(label) {
  return GRADE_LABEL_OPTIONS.includes(label);
}


