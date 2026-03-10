import { createUsersRepository } from "../users/repositories/users.repository.js";
import { hashPassword } from "../utils/utils.js";
import {
  parsePositiveInteger,
  normalizeOptionalText,
} from "../utils/normalization.js";

const VALID_LANGUAGES = ["ar", "en"];
const VALID_PLAN_TYPES = ["traditional", "active_learning"];

function buildProfileUpdates(body = {}, options = {}) {
  const { requireAtLeastOne = true } = options;
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
    Object.prototype.hasOwnProperty.call(
      body,
      "default_lesson_duration_minutes",
    )
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

  if (Object.prototype.hasOwnProperty.call(body, "default_plan_type")) {
    if (typeof body.default_plan_type !== "string") {
      errors.push("default_plan_type must be a string");
    } else {
      const normalized = body.default_plan_type.trim().toLowerCase();
      if (!VALID_PLAN_TYPES.includes(normalized)) {
        errors.push(
          `default_plan_type must be one of: ${VALID_PLAN_TYPES.join(", ")}`,
        );
      } else {
        updates.default_plan_type = normalized;
      }
    }
  }

  if (requireAtLeastOne && Object.keys(updates).length === 0) {
    errors.push("At least one valid profile field is required");
  }

  return {
    ok: errors.length === 0,
    updates,
    errors,
  };
}

export function createUsersController(
  usersRepository = createUsersRepository(),
) {
  return {
    // POST
    // - createTeacher
    async createTeacher(req, res) {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const { username, password } = req.body;

        if (!username || !password) {
          return res
            .status(400)
            .json({ error: "Username and password are required" });
        }

        if (typeof username !== "string" || username.length < 4) {
          return res
            .status(400)
            .json({ error: "Username must be at least 4 characters long" });
        }

        if (typeof password !== "string" || password.length < 6) {
          return res
            .status(400)
            .json({ error: "Password must be at least 6 characters long" });
        }

        // Check if username already exists
        const existingUser = await usersRepository.getUserByUsername(username);
        if (existingUser) {
          return res.status(409).json({ error: "Username already exists" });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Create the teacher
        const teacherId = await usersRepository.createUser({
          username,
          password: hashedPassword,
          role: "teacher",
        });

        return res.status(201).json({
          teacher: {
            id: teacherId,
            username,
            role: "teacher",
          },
        });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to create teacher");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    // GET
    // - getMyProfile
    // - listTeachers
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

    // PUT
    // - updateMyProfile
    // - updateTeacherProfile
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

    async updateTeacherProfile(req, res) {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const teacherId = parsePositiveInteger(req.params.teacherId);
        if (!teacherId) {
          return res
            .status(400)
            .json({ error: "teacherId must be a positive integer" });
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

        let normalizedUsername;
        const hasUsernameField = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "username",
        );

        if (hasUsernameField) {
          if (typeof req.body.username !== "string") {
            return res.status(400).json({ error: "username must be a string" });
          }

          normalizedUsername = req.body.username.trim();
          if (normalizedUsername.length < 4) {
            return res.status(400).json({
              error: "username must be at least 4 characters long",
            });
          }
        }

        const validation = buildProfileUpdates(req.body, {
          requireAtLeastOne: false,
        });
        if (!validation.ok) {
          return res.status(400).json({ error: validation.errors.join(", ") });
        }

        if (!hasUsernameField && Object.keys(validation.updates).length === 0) {
          return res.status(400).json({
            error:
              "At least one valid field is required (username or profile fields)",
          });
        }

        if (hasUsernameField) {
          const existingUser = await usersRepository.getUserByUsername(
            normalizedUsername,
          );
          if (existingUser && Number(existingUser.id) !== teacherId) {
            return res.status(409).json({ error: "Username already exists" });
          }

          await usersRepository.updateUsernameByUserId(
            teacherId,
            normalizedUsername,
          );
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

    async deleteTeacher(req, res) {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const teacherId = parsePositiveInteger(req.params.teacherId);
        if (!teacherId) {
          return res
            .status(400)
            .json({ error: "teacherId must be a positive integer" });
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

        const deletedTeacher = await usersRepository.deleteTeacherById(teacherId);
        return res.status(200).json({ teacher: deletedTeacher });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to delete teacher");
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  };
}

const usersController = createUsersController();

export const getMyProfile = usersController.getMyProfile;
export const updateMyProfile = usersController.updateMyProfile;
export const createTeacher = usersController.createTeacher;
export const listTeachers = usersController.listTeachers;
export const updateTeacherProfile = usersController.updateTeacherProfile;
export const deleteTeacher = usersController.deleteTeacher;
