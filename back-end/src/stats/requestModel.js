import { normalizeStage } from "../utils/education.js";

const VALID_PERIODS = ["all", "30d", "90d", "custom"];

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parsePositiveInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolvePresetRange(period) {
  if (period !== "30d" && period !== "90d") {
    return { date_from: null, date_to: null };
  }

  const days = period === "30d" ? 30 : 90;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    date_from: formatDateOnly(start),
    date_to: formatDateOnly(end),
  };
}

export function validateStatsQuery(query = {}, user = { role: "teacher" }) {
  const normalizedPeriod =
    typeof query.period === "string" ? query.period.trim().toLowerCase() : "all";
  const period = normalizedPeriod || "all";

  if (!VALID_PERIODS.includes(period)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_period",
      message: `period must be one of: ${VALID_PERIODS.join(", ")}`,
    };
  }

  const teacherId = parsePositiveInteger(query.teacher_id);

  if (query.teacher_id != null && teacherId == null) {
    return {
      ok: false,
      status: 400,
      code: "invalid_teacher_id",
      message: "teacher_id must be a positive integer",
    };
  }

  if (teacherId && user.role !== "admin") {
    return {
      ok: false,
      status: 403,
      code: "forbidden_teacher_filter",
      message: "Only admin users can filter by teacher_id",
    };
  }

  const stage =
    typeof query.stage === "string" ? normalizeStage(query.stage) : null;
  if (query.stage != null && query.stage !== "" && !stage) {
    return {
      ok: false,
      status: 400,
      code: "invalid_stage",
      message: "Invalid stage. Allowed values: ابتدائي، اعدادي، ثانوي.",
    };
  }

  if (period === "custom") {
    const dateFromRaw = typeof query.date_from === "string" ? query.date_from.trim() : "";
    const dateToRaw = typeof query.date_to === "string" ? query.date_to.trim() : "";

    if (!dateFromRaw || !dateToRaw) {
      return {
        ok: false,
        status: 400,
        code: "missing_custom_dates",
        message: "date_from and date_to are required when period is custom",
      };
    }

    const dateFrom = parseDateOnly(dateFromRaw);
    const dateTo = parseDateOnly(dateToRaw);

    if (!dateFrom || !dateTo) {
      return {
        ok: false,
        status: 400,
        code: "invalid_custom_dates",
        message: "date_from and date_to must be in YYYY-MM-DD format",
      };
    }

    if (dateFrom.getTime() > dateTo.getTime()) {
      return {
        ok: false,
        status: 400,
        code: "invalid_custom_range",
        message: "date_from must be on or before date_to",
      };
    }

    return {
      ok: true,
      value: {
        period,
        date_from: formatDateOnly(dateFrom),
        date_to: formatDateOnly(dateTo),
        teacher_id: teacherId,
        stage,
      },
    };
  }

  const presetRange = resolvePresetRange(period);

  return {
    ok: true,
    value: {
      period,
      date_from: presetRange.date_from,
      date_to: presetRange.date_to,
      teacher_id: teacherId,
      stage,
    },
  };
}

export const STATS_PERIODS = VALID_PERIODS;
