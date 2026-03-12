import {
  BLOOM_LEVELS,
  BLOOM_LEVEL_AR_LABELS,
  QUESTION_TYPE_CYCLE,
} from "../types.js";

function toFixedNumber(value, precision = 6) {
  return Number(Number(value).toFixed(precision));
}

function buildTieComparator(extract) {
  return (a, b) => {
    const aKey = extract(a);
    const bKey = extract(b);

    if (bKey.remainder !== aKey.remainder) {
      return bKey.remainder - aKey.remainder;
    }

    if (bKey.weight !== aKey.weight) {
      return bKey.weight - aKey.weight;
    }

    if (aKey.lessonOrder !== bKey.lessonOrder) {
      return aKey.lessonOrder - bKey.lessonOrder;
    }

    if (aKey.levelOrder !== bKey.levelOrder) {
      return aKey.levelOrder - bKey.levelOrder;
    }

    return aKey.index - bKey.index;
  };
}

function allocateByLargestRemainder(items, total, getRawValue, extractTieKeys) {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("total must be a non-negative integer");
  }

  if (items.length === 0) {
    return [];
  }

  const enriched = items.map((item, index) => {
    const raw = Math.max(0, Number(getRawValue(item, index)) || 0);
    const floor = Math.floor(raw);
    const remainder = raw - floor;

    return {
      item,
      index,
      raw,
      floor,
      remainder,
      allocation: floor,
      ...extractTieKeys(item, index),
    };
  });

  let remaining = total - enriched.reduce((sum, entry) => sum + entry.allocation, 0);

  if (remaining > 0) {
    const sorted = [...enriched].sort(
      buildTieComparator((entry) => ({
        remainder: entry.remainder,
        weight: entry.weight,
        lessonOrder: entry.lessonOrder,
        levelOrder: entry.levelOrder,
        index: entry.index,
      })),
    );

    for (let i = 0; i < remaining; i += 1) {
      sorted[i % sorted.length].allocation += 1;
    }
  } else if (remaining < 0) {
    const sorted = [...enriched].sort((a, b) => {
      if (a.remainder !== b.remainder) {
        return a.remainder - b.remainder;
      }
      if (a.weight !== b.weight) {
        return a.weight - b.weight;
      }
      if (b.lessonOrder !== a.lessonOrder) {
        return b.lessonOrder - a.lessonOrder;
      }
      if (b.levelOrder !== a.levelOrder) {
        return b.levelOrder - a.levelOrder;
      }
      return b.index - a.index;
    });

    let toRemove = Math.abs(remaining);
    let cursor = 0;
    while (toRemove > 0 && sorted.length > 0) {
      const entry = sorted[cursor % sorted.length];
      if (entry.allocation > 0) {
        entry.allocation -= 1;
        toRemove -= 1;
      }
      cursor += 1;
      if (cursor > sorted.length * (Math.abs(remaining) + 2)) {
        break;
      }
    }
  }

  return enriched.map((entry) => entry.allocation);
}

function splitIntegerUnits(totalUnits, count) {
  if (!Number.isInteger(totalUnits) || totalUnits < 0) {
    throw new Error("totalUnits must be a non-negative integer");
  }
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }

  const base = Math.floor(totalUnits / count);
  const remainder = totalUnits % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function isQuarterStep(value) {
  const scaled = Number(value) * 4;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function buildObjectivesCountByLevel(classifiedObjectives) {
  const counts = Object.fromEntries(BLOOM_LEVELS.map((level) => [level, 0]));
  for (const objective of classifiedObjectives) {
    if (!objective?.level || !(objective.level in counts)) {
      continue;
    }
    counts[objective.level] += 1;
  }
  return counts;
}

export function buildExamBlueprint({
  lessons,
  classifiedObjectivesByLesson,
  totalQuestions,
  totalMarks,
}) {
  const parsedTotalQuestions = Number(totalQuestions);
  const parsedTotalMarks = Number(totalMarks);

  if (!Number.isInteger(parsedTotalQuestions) || parsedTotalQuestions <= 0) {
    throw new Error("totalQuestions must be a positive integer");
  }
  if (!Number.isFinite(parsedTotalMarks) || parsedTotalMarks <= 0) {
    throw new Error("totalMarks must be a positive number");
  }
  if (!isQuarterStep(parsedTotalMarks)) {
    throw new Error("totalMarks must be in increments of 0.25");
  }
  if (!Array.isArray(lessons) || lessons.length < 1) {
    throw new Error("lessons must contain at least one lesson");
  }

  const periodTotal = lessons.reduce(
    (sum, lesson) => sum + Number(lesson.number_of_periods || 0),
    0,
  );

  if (!Number.isFinite(periodTotal) || periodTotal <= 0) {
    throw new Error("sum of lesson periods must be greater than zero");
  }

  const lessonRows = lessons.map((lesson, lessonOrder) => {
    const objectives = classifiedObjectivesByLesson[lesson.id] || [];
    const objectivesCountByLevel = buildObjectivesCountByLevel(objectives);
    const objectivesCount = objectives.length;
    const topicWeight = Number(lesson.number_of_periods) / periodTotal;

    return {
      lesson_id: Number(lesson.id),
      lesson_name: lesson.name,
      lesson_order: lessonOrder,
      number_of_periods: Number(lesson.number_of_periods),
      topic_weight: toFixedNumber(topicWeight),
      objectives_count: objectivesCount,
      objectives_count_by_level: objectivesCountByLevel,
    };
  });

  const globalLevelCounts = Object.fromEntries(BLOOM_LEVELS.map((level) => [level, 0]));
  for (const lesson of lessonRows) {
    for (const level of BLOOM_LEVELS) {
      globalLevelCounts[level] += lesson.objectives_count_by_level[level] || 0;
    }
  }

  const totalObjectives = Object.values(globalLevelCounts).reduce((sum, value) => sum + value, 0);
  if (totalObjectives <= 0) {
    throw new Error("no objectives available for blueprint calculation");
  }

  const activeLevels = BLOOM_LEVELS.filter((level) => globalLevelCounts[level] > 0);

  const levelRows = activeLevels.map((level, levelOrder) => ({
    level,
    level_label: BLOOM_LEVEL_AR_LABELS[level],
    level_order: levelOrder,
    objectives_count: globalLevelCounts[level],
    level_weight: toFixedNumber(globalLevelCounts[level] / totalObjectives),
  }));

  const levelWeightByLevel = Object.fromEntries(levelRows.map((row) => [row.level, row.level_weight]));

  const cells = [];
  for (const lesson of lessonRows) {
    for (const level of activeLevels) {
      const levelOrder = BLOOM_LEVELS.indexOf(level);
      const cellWeight = lesson.topic_weight * levelWeightByLevel[level];
      cells.push({
        lesson_id: lesson.lesson_id,
        lesson_name: lesson.lesson_name,
        lesson_order: lesson.lesson_order,
        level,
        level_label: BLOOM_LEVEL_AR_LABELS[level],
        level_order: levelOrder,
        topic_weight: toFixedNumber(lesson.topic_weight),
        level_weight: toFixedNumber(levelWeightByLevel[level]),
        cell_weight: toFixedNumber(cellWeight),
      });
    }
  }

  const questionAllocations = allocateByLargestRemainder(
    cells,
    parsedTotalQuestions,
    (cell) => cell.cell_weight * parsedTotalQuestions,
    (cell, index) => ({
      weight: cell.cell_weight,
      lessonOrder: cell.lesson_order,
      levelOrder: cell.level_order,
      index,
    }),
  );

  const cellsWithQuestionsWeightSum = cells.reduce(
    (sum, cell, index) => sum + (questionAllocations[index] > 0 ? cell.cell_weight : 0),
    0,
  );

  const totalMarkUnits = Math.round(parsedTotalMarks * 4);
  if (totalMarkUnits < parsedTotalQuestions) {
    throw new Error("totalMarks must allocate at least 0.25 marks per question");
  }

  const extraMarkAllocationsUnits = allocateByLargestRemainder(
    cells,
    totalMarkUnits - parsedTotalQuestions,
    (cell, index) => {
      if (questionAllocations[index] <= 0 || cellsWithQuestionsWeightSum <= 0) {
        return 0;
      }
      const normalizedWeight = cell.cell_weight / cellsWithQuestionsWeightSum;
      const desiredCellUnits = normalizedWeight * totalMarkUnits;
      return Math.max(0, desiredCellUnits - questionAllocations[index]);
    },
    (cell, index) => ({
      weight: cell.cell_weight,
      lessonOrder: cell.lesson_order,
      levelOrder: cell.level_order,
      index,
    }),
  );

  const finalizedCells = cells.map((cell, index) => {
    const questionCount = questionAllocations[index] || 0;
    const cellMarkUnits =
      questionCount > 0 ? questionCount + (extraMarkAllocationsUnits[index] || 0) : 0;
    const perQuestionUnits = splitIntegerUnits(cellMarkUnits, questionCount);

    return {
      ...cell,
      question_count: questionCount,
      cell_marks: toFixedNumber(cellMarkUnits / 4, 2),
      per_question_marks: perQuestionUnits.map((units) =>
        toFixedNumber(units / 4, 2),
      ),
    };
  });

  return {
    lessons: lessonRows.map((lesson) => ({
      lesson_id: lesson.lesson_id,
      lesson_name: lesson.lesson_name,
      number_of_periods: lesson.number_of_periods,
      topic_weight: lesson.topic_weight,
      objectives_count: lesson.objectives_count,
    })),
    levels: levelRows.map((levelRow) => ({
      level: levelRow.level,
      level_label: levelRow.level_label,
      objectives_count: levelRow.objectives_count,
      level_weight: levelRow.level_weight,
    })),
    cells: finalizedCells,
    totals: {
      total_lessons: lessonRows.length,
      total_objectives: totalObjectives,
      total_periods: periodTotal,
      total_questions: parsedTotalQuestions,
      total_marks: toFixedNumber(parsedTotalMarks, 2),
    },
  };
}

export function buildQuestionSlotsFromBlueprint(blueprint) {
  const cells = Array.isArray(blueprint?.cells) ? blueprint.cells : [];
  const orderedCells = [...cells].sort((a, b) => {
    if (a.lesson_order !== b.lesson_order) {
      return a.lesson_order - b.lesson_order;
    }
    if (a.level_order !== b.level_order) {
      return a.level_order - b.level_order;
    }
    return a.lesson_id - b.lesson_id;
  });

  const slots = [];
  let questionIndex = 0;

  for (const cell of orderedCells) {
    const perQuestionMarks = Array.isArray(cell.per_question_marks)
      ? cell.per_question_marks
      : [];

    for (let i = 0; i < Number(cell.question_count || 0); i += 1) {
      const assignedType = QUESTION_TYPE_CYCLE[questionIndex % QUESTION_TYPE_CYCLE.length];
      slots.push({
        slot_id: `q_${questionIndex + 1}`,
        question_number: questionIndex + 1,
        lesson_id: cell.lesson_id,
        lesson_name: cell.lesson_name,
        bloom_level: cell.level,
        bloom_level_label: cell.level_label,
        marks: Number(perQuestionMarks[i] ?? 0),
        question_type: assignedType,
      });
      questionIndex += 1;
    }
  }

  return slots;
}
