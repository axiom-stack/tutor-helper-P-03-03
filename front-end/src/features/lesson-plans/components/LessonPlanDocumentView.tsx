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

interface LessonPlanDocumentViewProps {
  planType: PlanType;
  planJson: Record<string, unknown> | null | undefined;
  fallback?: PlanDocumentFallbackContext;
  className?: string;
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

export default function LessonPlanDocumentView({
  planType,
  planJson,
  fallback,
  className,
}: LessonPlanDocumentViewProps) {
  const planObject = asRecord(planJson) ?? {};
  const header = asRecord(planObject.header) ?? {};

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
                <p>{toDisplayText(header.date)}</p>
              </div>
              <div>
                <label>اليوم</label>
                <p>{toDisplayText(header.day)}</p>
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
                <p>
                  {resolveHeaderValue(
                    header,
                    'lesson_title',
                    fallback?.lessonTitle ?? undefined
                  )}
                </p>
              </div>
              <div>
                <label>العنوان</label>
                <p>
                  {resolveHeaderValue(
                    header,
                    'lesson_title',
                    fallback?.lessonTitle ?? undefined
                  )}
                </p>
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
              <p>{traditionalIntro}</p>
              <h4>المفاهيم</h4>
              <ul>
                {traditionalConcepts.length > 0 ? (
                  traditionalConcepts.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))
                ) : (
                  <li>لا توجد مفاهيم مدخلة.</li>
                )}
              </ul>
            </div>

            <div className="lpdv__traditional-grid">
              <section>
                <h4>الأهداف / المخرجات التعليمية</h4>
                <ul>
                  {traditionalLearningOutcomes.length > 0 ? (
                    traditionalLearningOutcomes.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))
                  ) : (
                    <li>لا توجد أهداف مدخلة.</li>
                  )}
                </ul>
              </section>
              <section>
                <h4>الاستراتيجيات / طرق التدريس</h4>
                <ul>
                  {traditionalTeachingStrategies.length > 0 ? (
                    traditionalTeachingStrategies.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))
                  ) : (
                    <li>لا توجد استراتيجيات مدخلة.</li>
                  )}
                </ul>
              </section>
              <section>
                <h4>الأنشطة</h4>
                <ul>
                  {traditionalActivities.length > 0 ? (
                    traditionalActivities.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))
                  ) : (
                    <li>لا توجد أنشطة مدخلة.</li>
                  )}
                </ul>
              </section>
              <section>
                <h4>الوسائل / مصادر التعلم</h4>
                <ul>
                  {traditionalResources.length > 0 ? (
                    traditionalResources.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))
                  ) : (
                    <li>لا توجد وسائل مدخلة.</li>
                  )}
                </ul>
              </section>
              <section>
                <h4>التقويم</h4>
                <ul>
                  {traditionalAssessment.length > 0 ? (
                    traditionalAssessment.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))
                  ) : (
                    <li>لا توجد أدوات تقويم مدخلة.</li>
                  )}
                </ul>
              </section>
            </div>

            <div className="lpdv__traditional-footer">
              <div>
                <h4>الواجب</h4>
                <p>{traditionalHomework}</p>
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
                <p>{toDisplayText(header.date)}</p>
              </div>
              <div>
                <label>اليوم</label>
                <p>{toDisplayText(header.day)}</p>
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
                <p>
                  {resolveHeaderValue(
                    header,
                    'lesson_title',
                    fallback?.lessonTitle ?? undefined
                  )}
                </p>
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
              <ul>
                {activeObjectives.length > 0 ? (
                  activeObjectives.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))
                ) : (
                  <li>لا توجد أهداف مدخلة.</li>
                )}
              </ul>
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
                        const resources = Array.isArray(row.learning_resources)
                          ? row.learning_resources
                              .map((item) => toDisplayText(item))
                              .join('، ')
                          : '—';

                        return (
                          <tr key={`flow-${index}`}>
                            <td>{toDisplayText(row.time)}</td>
                            <td>{toDisplayText(row.content)}</td>
                            <td>{toActivityTypeLabel(row.activity_type)}</td>
                            <td>{toDisplayText(row.teacher_activity)}</td>
                            <td>{toDisplayText(row.student_activity)}</td>
                            <td>{resources || '—'}</td>
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
              <p>{toDisplayText(planObject.homework)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
