import { useEffect, useMemo, useState } from 'react';
import { MdEdit, MdRefresh, MdSave } from 'react-icons/md';
import { normalizeApiError } from '../../utils/apiErrors';
import type { TeacherManagementRow, UserProfileUpdatePayload } from '../../types';
import { listTeachers, updateTeacherProfile } from '../users/users.services';
import './teachers-management.css';

interface EditDraft {
  teacherId: number;
  language: 'ar' | 'en';
  educational_stage: string;
  subject: string;
  preparation_type: string;
  default_lesson_duration_minutes: number;
}

function formatDateAr(value: string): string {
  try {
    return new Date(value).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function toEditDraft(teacher: TeacherManagementRow): EditDraft {
  return {
    teacherId: teacher.id,
    language: teacher.profile.language,
    educational_stage: teacher.profile.educational_stage ?? '',
    subject: teacher.profile.subject ?? '',
    preparation_type: teacher.profile.preparation_type ?? '',
    default_lesson_duration_minutes:
      teacher.profile.default_lesson_duration_minutes ?? 45,
  };
}

export default function TeachersManagement() {
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers]
  );

  const loadTeachers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listTeachers();
      setTeachers(response.teachers ?? []);
    } catch (loadError: unknown) {
      setError(normalizeApiError(loadError, 'فشل تحميل قائمة المعلمين.').message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeachers();
  }, []);

  const handleSave = async () => {
    if (!editDraft) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: UserProfileUpdatePayload = {
      language: editDraft.language,
      educational_stage: editDraft.educational_stage.trim() || null,
      subject: editDraft.subject.trim() || null,
      preparation_type: editDraft.preparation_type.trim() || null,
      default_lesson_duration_minutes: editDraft.default_lesson_duration_minutes,
    };

    try {
      const response = await updateTeacherProfile(editDraft.teacherId, payload);

      setTeachers((current) =>
        current.map((teacher) =>
          teacher.id === editDraft.teacherId
            ? {
                ...teacher,
                profile: {
                  language: response.profile.language,
                  educational_stage: response.profile.educational_stage,
                  subject: response.profile.subject,
                  preparation_type: response.profile.preparation_type,
                  default_lesson_duration_minutes:
                    response.profile.default_lesson_duration_minutes,
                },
              }
            : teacher
        )
      );
      setSuccess('تم تحديث ملف المعلم بنجاح.');
      setEditDraft(null);
    } catch (saveError: unknown) {
      setError(normalizeApiError(saveError, 'فشل حفظ ملف المعلم.').message);
    } finally {
      setSaving(false);
    }
  };

  const selectedTeacher = editDraft
    ? teacherById.get(editDraft.teacherId) ?? null
    : null;

  return (
    <div className="tm" dir="rtl">
      <header className="tm__header">
        <h1>إدارة المعلمين</h1>
        <p>عرض سياق المعلمين التعليمي وسجل الاستخدام مع إمكانية تحديث الملف.</p>
      </header>

      <div className="tm__top-actions">
        <button type="button" onClick={() => void loadTeachers()} disabled={loading}>
          <MdRefresh aria-hidden />
          {loading ? 'جارٍ التحديث...' : 'تحديث القائمة'}
        </button>
      </div>

      {error ? <div className="tm__alert tm__alert--error">{error}</div> : null}
      {success ? <div className="tm__alert tm__alert--success">{success}</div> : null}

      <section className="tm__layout">
        <article className="tm__table-card">
          <h2>المعلمون</h2>
          {loading ? (
            <p className="tm__state">جاري التحميل...</p>
          ) : teachers.length === 0 ? (
            <p className="tm__state">لا يوجد معلمون حتى الآن.</p>
          ) : (
            <div className="tm__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المعلم</th>
                    <th>المرحلة</th>
                    <th>المادة</th>
                    <th>الخطط</th>
                    <th>الاختبارات</th>
                    <th>الواجبات</th>
                    <th>تعديلات الواجبات</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <div className="tm__teacher-cell">
                          <strong>{teacher.username}</strong>
                          <small>منذ {formatDateAr(teacher.created_at)}</small>
                        </div>
                      </td>
                      <td>{teacher.profile.educational_stage || '—'}</td>
                      <td>{teacher.profile.subject || '—'}</td>
                      <td>{teacher.usage.generated_plans_count}</td>
                      <td>{teacher.usage.generated_exams_count}</td>
                      <td>{teacher.usage.generated_assignments_count}</td>
                      <td>{teacher.usage.edited_assignments_count}</td>
                      <td>
                        <button
                          type="button"
                          className="tm__edit-btn"
                          onClick={() => setEditDraft(toEditDraft(teacher))}
                        >
                          <MdEdit aria-hidden />
                          تعديل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="tm__editor-card">
          <h2>تعديل ملف المعلم</h2>
          {!editDraft || !selectedTeacher ? (
            <p className="tm__state">اختر معلماً من الجدول لتعديل ملفه.</p>
          ) : (
            <div className="tm__editor-grid">
              <label className="tm__field" htmlFor="tm-language">
                <span>اللغة</span>
                <select
                  id="tm-language"
                  value={editDraft.language}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? {
                            ...current,
                            language: event.target.value as 'ar' | 'en',
                          }
                        : current
                    )
                  }
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>

              <label className="tm__field" htmlFor="tm-stage">
                <span>المرحلة التعليمية</span>
                <input
                  id="tm-stage"
                  value={editDraft.educational_stage}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? { ...current, educational_stage: event.target.value }
                        : current
                    )
                  }
                />
              </label>

              <label className="tm__field" htmlFor="tm-subject">
                <span>المادة</span>
                <input
                  id="tm-subject"
                  value={editDraft.subject}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, subject: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className="tm__field" htmlFor="tm-preparation-type">
                <span>نوع التحضير</span>
                <input
                  id="tm-preparation-type"
                  value={editDraft.preparation_type}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? { ...current, preparation_type: event.target.value }
                        : current
                    )
                  }
                />
              </label>

              <label className="tm__field" htmlFor="tm-duration">
                <span>المدة الافتراضية (دقيقة)</span>
                <input
                  id="tm-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={editDraft.default_lesson_duration_minutes}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? {
                            ...current,
                            default_lesson_duration_minutes:
                              Number(event.target.value) || 45,
                          }
                        : current
                    )
                  }
                />
              </label>

              <div className="tm__editor-actions">
                <button type="button" onClick={() => void handleSave()} disabled={saving}>
                  <MdSave aria-hidden />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
