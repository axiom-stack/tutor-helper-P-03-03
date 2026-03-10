import { createUsersRepository } from "../users/repositories/users.repository.js";

const VALID_LANGUAGES = ["ar", "en"];

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeOptionalText(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return NaN;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildProfileUpdates(body = {}) {
  const updates = {};
  const errors = [];

  if (Object.prototype.hasOwnProperty.call(body, "language")) {
    if (typeof body.language !== "string") {
      errors.push("language must be a string");
    } else {
      const normalizedLanguage = body.language.trim().toLowerCase();
      if (!VALID_LANGUAGES.includes(normalizedLanguage)) {
        errors.push(`language must be one of: ${VALID_LANGUAGES.join(", ")}`);
      } else {
        updates.language = normalizedLanguage;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "educational_stage")) {
    const parsedValue = normalizeOptionalText(body.educational_stage);
    if (Number.isNaN(parsedValue)) {
      errors.push("educational_stage must be a string or null");
    } else {
      updates.educational_stage = parsedValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "subject")) {
    const parsedValue = normalizeOptionalText(body.subject);
    if (Number.isNaN(parsedValue)) {
      errors.push("subject must be a string or null");
    } else {
      updates.subject = parsedValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "preparation_type")) {
    const parsedValue = normalizeOptionalText(body.preparation_type);
    if (Number.isNaN(parsedValue)) {
      errors.push("preparation_type must be a string or null");
    } else {
      updates.preparation_type = parsedValue;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "default_lesson_duration_minutes")
  ) {
    const parsedDuration = parsePositiveInteger(
      body.default_lesson_duration_minutes,
    );

    if (parsedDuration == null) {
      errors.push("default_lesson_duration_minutes must be a positive integer");
    } else {
      updates.default_lesson_duration_minutes = parsedDuration;
    }
  }

  if (Object.keys(updates).length === 0) {
    errors.push("At least one valid profile field is required");
  }

  return {
    ok: errors.length === 0,
    updates,
    errors,
  };
}

export function createUsersController(usersRepository = createUsersRepository()) {
  return {
    async getMyProfile(req, res) {
      try {
        const profile = await usersRepository.getProfileByUserId(req.user.id);

        if (!profile) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ profile });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to load profile");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async updateMyProfile(req, res) {
      try {
        const validation = buildProfileUpdates(req.body);
        if (!validation.ok) {
          return res.status(400).json({ error: validation.errors.join(", ") });
        }

        const profile = await usersRepository.updateProfileByUserId(
          req.user.id,
          validation.updates,
        );

        if (!profile) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ profile });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to update profile");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async listTeachers(req, res) {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const teachers = await usersRepository.listTeachersWithUsage();
        return res.status(200).json({ teachers });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to list teachers");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async updateTeacherProfile(req, res) {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const teacherId = parsePositiveInteger(req.params.teacherId);
        if (!teacherId) {
          return res.status(400).json({ error: "teacherId must be a positive integer" });
        }

        const teacher = await usersRepository.getUserById(teacherId);
        if (!teacher) {
          return res.status(404).json({ error: "Teacher not found" });
        }

        if (teacher.role !== "teacher") {
          return res
            .status(400)
            .json({ error: "Provided user is not a teacher" });
        }

        const validation = buildProfileUpdates(req.body);
        if (!validation.ok) {
          return res.status(400).json({ error: validation.errors.join(", ") });
        }

        const profile = await usersRepository.updateProfileByUserId(
          teacherId,
          validation.updates,
        );

        return res.status(200).json({ profile });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to update teacher profile");
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  };
}

const usersController = createUsersController();

export const getMyProfile = usersController.getMyProfile;
export const updateMyProfile = usersController.updateMyProfile;
export const listTeachers = usersController.listTeachers;
export const updateTeacherProfile = usersController.updateTeacherProfile;
