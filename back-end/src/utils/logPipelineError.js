// Records why a generation request failed. Server errors are logged as errors,
// rejected requests as warnings. Request content is not logged, only its size.
export function logPipelineError(req, error) {
  const level = error.status >= 500 ? "error" : "warn";
  req.log?.[level]?.(
    {
      status: error.status,
      code: error.code,
      reason: error.message,
      details: error.details,
      total_questions: req.body?.total_questions,
      lesson_count: req.body?.lesson_ids?.length,
    },
    "generation pipeline failure",
  );
}
