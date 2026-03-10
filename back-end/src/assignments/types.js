export const ASSIGNMENT_TYPES = Object.freeze({
  WRITTEN: "written",
  VARIED: "varied",
  PRACTICAL: "practical",
});

export const VALID_ASSIGNMENT_TYPES = Object.freeze([
  ASSIGNMENT_TYPES.WRITTEN,
  ASSIGNMENT_TYPES.VARIED,
  ASSIGNMENT_TYPES.PRACTICAL,
]);

export const ASSIGNMENT_PUBLIC_ID_PREFIX = "asn_";
export const ASSIGNMENT_GROUP_PUBLIC_ID_PREFIX = "asg_";

export const ASSIGNMENTS_TABLE = "Assignments";
export const ASSIGNMENT_GROUPS_TABLE = "AssignmentGroups";
