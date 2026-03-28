import type { Class, Subject } from '../types';

const DEFAULT_SEMESTER_LABEL = 'الأول';

type ClassIdentityLike = Pick<
  Class,
  'academic_year' | 'semester' | 'grade_label' | 'section_label' | 'section'
>;

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAcademicYearLabel(
  value: string | null | undefined
): string {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (!match) {
    return normalized;
  }
  return `${match[1]} - ${match[2]}`;
}

export function normalizeSemesterLabel(
  value: string | null | undefined
): string {
  const normalized = normalizeText(value);
  return normalized || DEFAULT_SEMESTER_LABEL;
}

function resolveSectionLabel(classItem: ClassIdentityLike): string {
  const sectionLabel = normalizeText(classItem.section_label);
  if (sectionLabel) {
    return sectionLabel;
  }

  const section = normalizeText(classItem.section);
  return section || '—';
}

export function formatClassShortLabel(classItem: ClassIdentityLike): string {
  const gradeLabel = normalizeText(classItem.grade_label);
  const sectionLabel = resolveSectionLabel(classItem);

  if (gradeLabel && sectionLabel && sectionLabel !== '—') {
    return `${gradeLabel} - ${sectionLabel}`;
  }

  return gradeLabel || sectionLabel || '—';
}

export function formatClassSelectLabel(classItem: ClassIdentityLike): string {
  const yearLabel = normalizeAcademicYearLabel(classItem.academic_year) || '—';
  const semesterLabel = normalizeSemesterLabel(classItem.semester);
  const gradeLabel = normalizeText(classItem.grade_label) || '—';
  const sectionLabel = resolveSectionLabel(classItem);

  return `العام: ${yearLabel} | الفصل: ${semesterLabel} | الصف: ${gradeLabel} | الشعبة: ${sectionLabel}`;
}

export function formatSubjectSelectLabel(
  subjectItem: Pick<Subject, 'name' | 'class_id'>,
  classItem?: ClassIdentityLike | null
): string {
  const classLabel = classItem
    ? formatClassShortLabel(classItem)
    : `#${subjectItem.class_id}`;

  return `${subjectItem.name} | ${classLabel}`;
}

export function isSameClassIdentity(
  classItem: ClassIdentityLike,
  candidate: {
    academicYear: string;
    semester: string;
    gradeLabel: string;
    sectionLabel: string;
  }
): boolean {
  return (
    normalizeAcademicYearLabel(classItem.academic_year) ===
      normalizeAcademicYearLabel(candidate.academicYear) &&
    normalizeSemesterLabel(classItem.semester) ===
      normalizeSemesterLabel(candidate.semester) &&
    normalizeText(classItem.grade_label) === normalizeText(candidate.gradeLabel) &&
    normalizeText(classItem.section_label) ===
      normalizeText(candidate.sectionLabel)
  );
}
