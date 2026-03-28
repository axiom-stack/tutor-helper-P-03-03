import type { ChangeEvent } from 'react';
import type { PlanType } from '../../../types';
import {
  asRecord,
  toActivityTypeLabel,
  toDisplayText,
  toTextList,
} from '../planDisplay';
import './lesson-plan-document-view.css';

interface PlanDocumentFallbackContext {
  lessonTitle?: string | null;
  subject?: string | null;
  grade?: string | null;
  unit?: string | null;
  section?: string | null;
  durationMinutes?: number | null;
}

type LessonPlanViewMode = 'view' | 'edit';

interface LessonPlanDocumentViewProps {
  planType: PlanType;
  planJson: Record<string, unknown> | null | undefined;
  fallback?: PlanDocumentFallbackContext;
  className?: string;
  mode?: LessonPlanViewMode;
  lessonTitle?: string;
  onLessonTitleChange?: (value: string) => void;
  onPlanJsonChange?: (planJson: Record<string, unknown>) => void;
}

function clonePlanJson(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value));
}

function toEditableText(value: unknown): string {
  const displayValue = toDisplayText(value);
  return displayValue === '—' ? '' : displayValue;
}

function toEditableList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return toTextList(value);
  }

  const displayValue = toDisplayText(value);
  return displayValue === '—' ? [] : [displayValue];
}

function toEditableListText(value: unknown): string {
  return toEditableList(value).join('\n');
}

function toLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveHeaderValue(
  header: Record<string, unknown>,
  key: string,
  fallbackValue?: string
): string {
  const headerValue = toDisplayText(header[key]);
  if (headerValue !== '—') {
    return headerValue;
  }

  const fallbackText = toDisplayText(fallbackValue);
  return fallbackText === '—' ? '—' : fallbackText;
}

function resolveDurationValue(
  header: Record<string, unknown>,
  fallbackDuration?: number | null
): string {
  const headerValue = toDisplayText(header.duration);
  if (headerValue !== '—') {
    return headerValue;
  }

  if (typeof fallbackDuration === 'number' && Number.isFinite(fallbackDuration)) {
    return `${fallbackDuration} دقيقة`;
  }

  return '—';
}

function renderStaticList(items: string[], emptyText: string) {
  return (
    <ul>
      {items.length > 0 ? (
        items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
      ) : (
        <li>{emptyText}</li>
      )}
    </ul>
  );
}

function FieldInput({
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  value: string;
  onChange?: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  if (multiline) {
    return (
      <textarea
        className="lpdv__field-textarea"
        value={value}
        rows={rows}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  }

  return (
    <input
      className="lpdv__field-input"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export default function LessonPlanDocumentView({
  planType,
  planJson,
  fallback,
  className,
  mode = 'view',
  lessonTitle,
  onLessonTitleChange,
  onPlanJsonChange,
}: LessonPlanDocumentViewProps) {
  const planObject = asRecord(planJson) ?? {};
  const header = asRecord(planObject.header) ?? {};
  const resolvedLessonTitle =
    lessonTitle ??
    resolveHeaderValue(header, 'lesson_title', fallback?.lessonTitle ?? undefined);
  const isEditMode = mode === 'edit';

  const updatePlanJson = (updater: (draft: Record<string, unknown>) => void) => {
    if (!onPlanJsonChange) {
      return;
    }

    const nextPlanJson = clonePlanJson(planObject);
    updater(nextPlanJson);
    onPlanJsonChange(nextPlanJson);
  };

  const updateTopLevelText = (key: string, value: string) => {
    updatePlanJson((draft) => {
      draft[key] = value;
    });
  };

  const updateTopLevelList = (key: string, value: string) => {
    updatePlanJson((draft) => {
      draft[key] = toLines(value);
    });
  };

  const updateHeaderText = (key: string, value: string) => {
    updatePlanJson((draft) => {
      const nextHeader = asRecord(draft.header) ?? {};
      draft.header = {
        ...nextHeader,
        [key]: value,
      };
    });
  };

  const updateLessonFlowValue = (
    index: number,
    key: string,
    value: string | string[]
  ) => {
    updatePlanJson((draft) => {
      const nextFlow = Array.isArray(draft.lesson_flow)
        ? draft.lesson_flow.map((item) => {
            const row = asRecord(item);
            return row ? { ...row } : {};
          })
        : [];
      const currentRow = asRecord(nextFlow[index]) ?? {};
      nextFlow[index] = {
        ...currentRow,
        [key]: value,
      };
      draft.lesson_flow = nextFlow;
    });
  };

  const handleLessonTitleChange = (value: string) => {
    onLessonTitleChange?.(value);
    updateHeaderText('lesson_title', value);
  };

  const traditionalConcepts = toTextList(planObject.concepts);
  const traditionalLearningOutcomes = toTextList(planObject.learning_outcomes);
  const traditionalTeachingStrategies = toTextList(planObject.teaching_strategies);
  const traditionalActivities = toTextList(planObject.activities);
  const traditionalResources = toTextList(planObject.learning_resources);
  const traditionalAssessment = toTextList(planObject.assessment);
  const traditionalIntro = toDisplayText(planObject.intro);
  const traditionalHomework = toDisplayText(planObject.homework);
  const traditionalSource = toDisplayText(planObject.source);

  const activeObjectives = toTextList(planObject.objectives);
  const lessonFlow = Array.isArray(planObject.lesson_flow)
    ? planObject.lesson_flow.filter((item): item is Record<string, unknown> =>
        asRecord(item) !== null
      )
    : [];

  const rootClassName = className ? `lpdv ${className}` : 'lpdv';

  return (
    <div className={rootClassName}>
      {planType === 'traditional' ? (
        <div className="lpdv__traditional-card">
          <div className="lpdv__traditional-shell">
            <div className="lpdv__traditional-header-grid">
              <div>
                <label>التاريخ</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.date)}
                    onChange={(value) => updateHeaderText('date', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.date)}</p>
                )}
              </div>
              <div>
                <label>اليوم</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.day)}
                    onChange={(value) => updateHeaderText('day', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.day)}</p>
                )}
              </div>
              <div>
                <label>الساعة</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.time)}
                    onChange={(value) => updateHeaderText('time', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.time)}</p>
                )}
              </div>
              <div>
                <label>الصف</label>
                <p>{resolveHeaderValue(header, 'grade', fallback?.grade ?? undefined)}</p>
              </div>
              <div>
                <label>الشعبة</label>
                <p>{resolveHeaderValue(header, 'section', fallback?.section ?? undefined)}</p>
              </div>
              <div>
                <label>الحصة</label>
                <p>{toDisplayText(header.time)}</p>
              </div>
              <div>
                <label>العنوان</label>
                {isEditMode ? (
                  <FieldInput
                    value={resolvedLessonTitle === '—' ? '' : resolvedLessonTitle}
                    onChange={handleLessonTitleChange}
                  />
                ) : (
                  <p>{resolvedLessonTitle}</p>
                )}
              </div>
              <div>
                <label>الوحدة</label>
                <p>{resolveHeaderValue(header, 'unit', fallback?.unit ?? undefined)}</p>
              </div>
              <div>
                <label>الوقت</label>
                <p>{resolveDurationValue(header, fallback?.durationMinutes)}</p>
              </div>
            </div>

            <div className="lpdv__traditional-intro">
              <h3>التمهيد</h3>
              {isEditMode ? (
                <FieldInput
                  multiline
                  rows={4}
                  value={toEditableText(planObject.intro)}
                  onChange={(value) => updateTopLevelText('intro', value)}
                />
              ) : (
                <p>{traditionalIntro}</p>
              )}
              <h4>المفاهيم</h4>
              {isEditMode ? (
                <FieldInput
                  multiline
                  rows={4}
                  value={toEditableListText(planObject.concepts)}
                  onChange={(value) => updateTopLevelList('concepts', value)}
                />
              ) : (
                renderStaticList(traditionalConcepts, 'لا توجد مفاهيم مدخلة.')
              )}
            </div>

            <div className="lpdv__traditional-grid">
              <section>
                <h4>الأهداف / المخرجات التعليمية</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={7}
                    value={toEditableListText(planObject.learning_outcomes)}
                    onChange={(value) => updateTopLevelList('learning_outcomes', value)}
                  />
                ) : (
                  renderStaticList(traditionalLearningOutcomes, 'لا توجد أهداف مدخلة.')
                )}
              </section>
              <section>
                <h4>الاستراتيجيات / طرق التدريس</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={7}
                    value={toEditableListText(planObject.teaching_strategies)}
                    onChange={(value) => updateTopLevelList('teaching_strategies', value)}
                  />
                ) : (
                  renderStaticList(traditionalTeachingStrategies, 'لا توجد استراتيجيات مدخلة.')
                )}
              </section>
              <section>
                <h4>الأنشطة</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={7}
                    value={toEditableListText(planObject.activities)}
                    onChange={(value) => updateTopLevelList('activities', value)}
                  />
                ) : (
                  renderStaticList(traditionalActivities, 'لا توجد أنشطة مدخلة.')
                )}
              </section>
              <section>
                <h4>الوسائل / مصادر التعلم</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={7}
                    value={toEditableListText(planObject.learning_resources)}
                    onChange={(value) => updateTopLevelList('learning_resources', value)}
                  />
                ) : (
                  renderStaticList(traditionalResources, 'لا توجد وسائل مدخلة.')
                )}
              </section>
              <section>
                <h4>التقويم</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={7}
                    value={toEditableListText(planObject.assessment)}
                    onChange={(value) => updateTopLevelList('assessment', value)}
                  />
                ) : (
                  renderStaticList(traditionalAssessment, 'لا توجد أدوات تقويم مدخلة.')
                )}
              </section>
            </div>

            <div className="lpdv__traditional-footer">
              <div>
                <h4>الواجب</h4>
                {isEditMode ? (
                  <FieldInput
                    multiline
                    rows={4}
                    value={toEditableText(planObject.homework)}
                    onChange={(value) => updateTopLevelText('homework', value)}
                  />
                ) : (
                  <p>{traditionalHomework}</p>
                )}
              </div>
              <div>
                <h4>المصدر</h4>
                <p>{traditionalSource}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="lpdv__active-card">
          <div className="lpdv__active-shell">
            <div className="lpdv__active-header-grid">
              <div>
                <label>التاريخ</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.date)}
                    onChange={(value) => updateHeaderText('date', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.date)}</p>
                )}
              </div>
              <div>
                <label>اليوم</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.day)}
                    onChange={(value) => updateHeaderText('day', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.day)}</p>
                )}
              </div>
              <div>
                <label>الساعة</label>
                {isEditMode ? (
                  <FieldInput
                    value={toEditableText(header.time)}
                    onChange={(value) => updateHeaderText('time', value)}
                  />
                ) : (
                  <p>{toDisplayText(header.time)}</p>
                )}
              </div>
              <div>
                <label>المادة</label>
                <p>{resolveHeaderValue(header, 'subject', fallback?.subject ?? undefined)}</p>
              </div>
              <div>
                <label>الصف</label>
                <p>{resolveHeaderValue(header, 'grade', fallback?.grade ?? undefined)}</p>
              </div>
              <div>
                <label>الشعبة</label>
                <p>{resolveHeaderValue(header, 'section', fallback?.section ?? undefined)}</p>
              </div>
              <div>
                <label>العنوان</label>
                {isEditMode ? (
                  <FieldInput
                    value={resolvedLessonTitle === '—' ? '' : resolvedLessonTitle}
                    onChange={handleLessonTitleChange}
                  />
                ) : (
                  <p>{resolvedLessonTitle}</p>
                )}
              </div>
              <div>
                <label>الوحدة</label>
                <p>{resolveHeaderValue(header, 'unit', fallback?.unit ?? undefined)}</p>
              </div>
              <div>
                <label>المدة</label>
                <p>{resolveDurationValue(header, fallback?.durationMinutes)}</p>
              </div>
            </div>

            <div className="lpdv__active-objectives">
              <h3>الأهداف التعليمية</h3>
              {isEditMode ? (
                <FieldInput
                  multiline
                  rows={6}
                  value={toEditableListText(planObject.objectives)}
                  onChange={(value) => updateTopLevelList('objectives', value)}
                />
              ) : (
                renderStaticList(activeObjectives, 'لا توجد أهداف مدخلة.')
              )}
            </div>

            <div className="lpdv__active-flow">
              <h3>تدفق الدرس</h3>
              <div className="lpdv__table-wrap lpdv__table-wrap--active">
                <table className="lpdv__flow-table lpdv__flow-table--active">
                  <thead>
                    <tr>
                      <th>الزمن</th>
                      <th>المحتوى</th>
                      <th>نوع النشاط</th>
                      <th>دور المعلم</th>
                      <th>دور الطالب</th>
                      <th>الوسائل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessonFlow.length > 0 ? (
                      lessonFlow.map((row, index) => {
                        const resources = toEditableList(row.learning_resources);
                        const activityType = toEditableText(row.activity_type) || 'activity';

                        return (
                          <tr key={`flow-${index}`}>
                            <td>
                              {isEditMode ? (
                                <FieldInput
                                  value={toEditableText(row.time)}
                                  onChange={(value) =>
                                    updateLessonFlowValue(index, 'time', value)
                                  }
                                />
                              ) : (
                                toDisplayText(row.time)
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <FieldInput
                                  multiline
                                  rows={3}
                                  value={toEditableText(row.content)}
                                  onChange={(value) =>
                                    updateLessonFlowValue(index, 'content', value)
                                  }
                                />
                              ) : (
                                toDisplayText(row.content)
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <select
                                  className="lpdv__field-select"
                                  value={activityType}
                                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                    updateLessonFlowValue(
                                      index,
                                      'activity_type',
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="intro">تمهيد</option>
                                  <option value="presentation">عرض</option>
                                  <option value="activity">نشاط</option>
                                  <option value="assessment">تقويم</option>
                                </select>
                              ) : (
                                toActivityTypeLabel(row.activity_type)
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <FieldInput
                                  multiline
                                  rows={3}
                                  value={toEditableText(row.teacher_activity)}
                                  onChange={(value) =>
                                    updateLessonFlowValue(
                                      index,
                                      'teacher_activity',
                                      value
                                    )
                                  }
                                />
                              ) : (
                                toDisplayText(row.teacher_activity)
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <FieldInput
                                  multiline
                                  rows={3}
                                  value={toEditableText(row.student_activity)}
                                  onChange={(value) =>
                                    updateLessonFlowValue(
                                      index,
                                      'student_activity',
                                      value
                                    )
                                  }
                                />
                              ) : (
                                toDisplayText(row.student_activity)
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <FieldInput
                                  multiline
                                  rows={3}
                                  value={resources.join('\n')}
                                  onChange={(value) =>
                                    updateLessonFlowValue(
                                      index,
                                      'learning_resources',
                                      toLines(value)
                                    )
                                  }
                                />
                              ) : (
                                resources.join('، ') || '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6}>لا توجد بيانات تدفق.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lpdv__active-footer">
              <h4>الواجب</h4>
              {isEditMode ? (
                <FieldInput
                  multiline
                  rows={4}
                  value={toEditableText(planObject.homework)}
                  onChange={(value) => updateTopLevelText('homework', value)}
                />
              ) : (
                <p>{toDisplayText(planObject.homework)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
