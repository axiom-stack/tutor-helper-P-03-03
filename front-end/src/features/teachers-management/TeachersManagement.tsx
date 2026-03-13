import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MdClose,
  MdDeleteOutline,
  MdEdit,
  MdLockReset,
  MdPersonAdd,
  MdRefresh,
  MdSave,
} from 'react-icons/md';
import { normalizeApiError } from '../../utils/apiErrors';
import type {
  AdminTeacherProfileUpdatePayload,
  TeacherManagementRow,
} from '../../types';
import {
  createTeacher,
  deleteTeacher,
  listTeachers,
  resetTeacherPassword,
  updateTeacherProfile,
} from '../users/users.services';
import './teachers-management.css';

interface EditDraft {
  teacherId: number;
  username: string;
  language: 'ar' | 'en';
  educational_stage: string;
  subject: string;
  preparation_type: string;
  default_plan_type: 'traditional' | 'active_learning';
  default_lesson_duration_minutes: number;
}

interface DeleteDraft {
  teacherId: number;
  username: string;
}

interface ResetPasswordDraft {
  teacherId: number;
  username: string;
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
    username: teacher.username,
    language: teacher.profile.language,
    educational_stage: teacher.profile.educational_stage ?? '',
    subject: teacher.profile.subject ?? '',
    preparation_type: teacher.profile.preparation_type ?? '',
    default_plan_type:
      teacher.profile.default_plan_type === 'active_learning'
        ? 'active_learning'
        : 'traditional',
    default_lesson_duration_minutes:
      teacher.profile.default_lesson_duration_minutes ?? 45,
  };
}

export default function TeachersManagement() {
  const [teachers, setTeachers] = useState<TeacherManagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [, setCreateError] = useState<string | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<DeleteDraft | null>(null);
  const [resetDraft, setResetDraft] = useState<ResetPasswordDraft | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

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
      const message = normalizeApiError(loadError, 'فشل تحميل قائمة المعلمين.').message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeachers();
  }, []);

  const handleCreateTeacher = async () => {
    // Client-side validation
    if (newTeacherUsername.length < 4) {
      setCreateError('اسم المستخدم يجب أن يكون 4 أحرف على الأقل');
      toast.error('اسم المستخدم يجب أن يكون 4 أحرف على الأقل');
      return;
    }

    if (newTeacherPassword.length < 6) {
      setCreateError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      await createTeacher({
        username: newTeacherUsername.trim(),
        password: newTeacherPassword,
      });

      setSuccess('تم إضافة المعلم بنجاح.');
      toast.success('تم إضافة المعلم بنجاح.');
      setShowCreateModal(false);
      setNewTeacherUsername('');
      setNewTeacherPassword('');
      // Reload teachers list
      await loadTeachers();
    } catch (createError: unknown) {
      const message = normalizeApiError(createError, 'فشل إضافة المعلم.').message;
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!editDraft) {
      return;
    }

    const username = editDraft.username.trim();
    if (username.length < 4) {
      setError('اسم المستخدم يجب أن يكون 4 أحرف على الأقل.');
      toast.error('اسم المستخدم يجب أن يكون 4 أحرف على الأقل.');
      return;
    }

    if (editDraft.default_lesson_duration_minutes < 1) {
      setError('المدة الافتراضية يجب أن تكون دقيقة واحدة على الأقل.');
      toast.error('المدة الافتراضية يجب أن تكون دقيقة واحدة على الأقل.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: AdminTeacherProfileUpdatePayload = {
      username,
      language: editDraft.language,
      educational_stage: editDraft.educational_stage.trim() || null,
      subject: editDraft.subject.trim() || null,
      preparation_type: editDraft.preparation_type.trim() || null,
      default_plan_type: editDraft.default_plan_type,
      default_lesson_duration_minutes: editDraft.default_lesson_duration_minutes,
    };

    try {
      const response = await updateTeacherProfile(editDraft.teacherId, payload);

      setTeachers((current) =>
        current.map((teacher) =>
          teacher.id === editDraft.teacherId
            ? {
                ...teacher,
                username: response.profile.username,
                profile: {
                  language: response.profile.language,
                  educational_stage: response.profile.educational_stage,
                  subject: response.profile.subject,
                  preparation_type: response.profile.preparation_type,
                  default_plan_type: response.profile.default_plan_type,
                  default_lesson_duration_minutes:
                    response.profile.default_lesson_duration_minutes,
                },
              }
            : teacher
        )
      );
      setSuccess('تم تحديث ملف المعلم بنجاح.');
      toast.success('تم تحديث ملف المعلم بنجاح.');
      setEditDraft(null);
    } catch (saveError: unknown) {
      const message = normalizeApiError(saveError, 'فشل حفظ ملف المعلم.').message;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteDraft) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteTeacher(deleteDraft.teacherId);

      setTeachers((current) =>
        current.filter((teacher) => teacher.id !== deleteDraft.teacherId)
      );
      setEditDraft((current) =>
        current && current.teacherId === deleteDraft.teacherId ? null : current
      );
      setDeleteDraft(null);
      setSuccess('تم حذف المعلم بنجاح.');
      toast.success('تم حذف المعلم بنجاح.');
    } catch (deleteError: unknown) {
      const message = normalizeApiError(deleteError, 'فشل حذف المعلم.').message;
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetDraft || resetSubmitting) return;
    if (resetNewPassword.length < 6) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error('كلمة المرور وتأكيدها غير متطابقتين.');
      return;
    }
    setResetSubmitting(true);
    try {
      await resetTeacherPassword(resetDraft.teacherId, {
        new_password: resetNewPassword,
      });
      setResetDraft(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
      toast.success('تم تعيين كلمة المرور. يمكن للمعلم تسجيل الدخول بها.');
    } catch (err: unknown) {
      const message = normalizeApiError(err, 'فشل إعادة تعيين كلمة المرور.').message;
      toast.error(message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const selectedTeacher = editDraft
    ? teacherById.get(editDraft.teacherId) ?? null
    : null;

  if (loading && teachers.length === 0) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="tm ui-loaded">
      <header className="tm__header page-header">
        <h1>إدارة المعلمين</h1>
        <p>عرض سياق المعلمين التعليمي وسجل الاستخدام مع إمكانية تحديث الملف.</p>
      </header>

      <div className="tm__top-actions">
        <button type="button" onClick={() => setShowCreateModal(true)}>
          <MdPersonAdd aria-hidden />
          إضافة معلم جديد
        </button>
        <button type="button" onClick={() => void loadTeachers()} disabled={loading}>
          {loading && <span className="ui-button-spinner" aria-hidden />}
          {!loading && <MdRefresh aria-hidden />}
          {loading ? 'جارٍ التحديث...' : 'تحديث القائمة'}
        </button>
      </div>

      <section className="tm__layout">
        <article className="tm__table-card">
          <div className="tm__table-head">
            <h2>المعلمون</h2>
            <span className="tm__count-badge">{teachers.length}</span>
          </div>
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
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className={
                        editDraft?.teacherId === teacher.id
                          ? 'tm__row tm__row--selected animate-fadeIn'
                          : 'tm__row animate-fadeIn'
                      }
                    >
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
                        <div className="tm__actions">
                          <button
                            type="button"
                            className="tm__action-btn tm__action-btn--edit"
                            onClick={() => setEditDraft(toEditDraft(teacher))}
                          >
                            <MdEdit aria-hidden />
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="tm__action-btn tm__action-btn--secondary"
                            onClick={() => {
                              setResetDraft({
                                teacherId: teacher.id,
                                username: teacher.username,
                              });
                              setResetNewPassword('');
                              setResetConfirmPassword('');
                            }}
                            title="إعادة تعيين كلمة المرور"
                          >
                            <MdLockReset aria-hidden />
                            إعادة تعيين كلمة المرور
                          </button>
                          <button
                            type="button"
                            className="tm__action-btn tm__action-btn--delete"
                            onClick={() =>
                              setDeleteDraft({
                                teacherId: teacher.id,
                                username: teacher.username,
                              })
                            }
                          >
                            <MdDeleteOutline aria-hidden />
                            حذف
                          </button>
                        </div>
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
              <div className="tm__editor-selected">
                <strong>{selectedTeacher.username}</strong>
              </div>

              <label className="tm__field" htmlFor="tm-username">
                <span>اسم المعلم (اسم المستخدم)</span>
                <input
                  id="tm-username"
                  value={editDraft.username}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, username: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className="tm__field" htmlFor="tm-language">
                <span>اللغة</span>
                <select
                  id="tm-language"
                  className="notranslate"
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

              <label className="tm__field" htmlFor="tm-default-plan-type">
                <span>نوع الخطة الافتراضي</span>
                <select
                  id="tm-default-plan-type"
                  value={editDraft.default_plan_type}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? {
                            ...current,
                            default_plan_type: event.target
                              .value as 'traditional' | 'active_learning',
                          }
                        : current
                    )
                  }
                >
                  <option value="traditional">تقليدية</option>
                  <option value="active_learning">تعلم نشط</option>
                </select>
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
                  {saving && <span className="ui-button-spinner" aria-hidden />}
                  {!saving && <MdSave aria-hidden />}
                  {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* Create Teacher Modal */}
      {showCreateModal && (
        <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="create-teacher-title">
          <div className="tm-modal__backdrop" onClick={() => setShowCreateModal(false)} />
          <div className="tm-modal__panel">
            <header className="tm-modal__header">
              <h3 id="create-teacher-title">إضافة معلم جديد</h3>
              <button
                type="button"
                className="tm-modal__close"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                aria-label="إغلاق نافذة إضافة المعلم"
              >
                <MdClose aria-hidden />
              </button>
            </header>

            <form
              className="tm-modal__form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateTeacher();
              }}
            >
              <label className="tm-modal__field" htmlFor="new-teacher-username">
                <span>اسم المستخدم</span>
                <input
                  id="new-teacher-username"
                  type="text"
                  value={newTeacherUsername}
                  onChange={(e) => setNewTeacherUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم (4 أحرف على الأقل)"
                  disabled={creating}
                  required
                />
              </label>

              <label className="tm-modal__field" htmlFor="new-teacher-password">
                <span>كلمة المرور</span>
                <input
                  id="new-teacher-password"
                  type="password"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                  disabled={creating}
                  required
                />
              </label>

              <div className="tm-modal__actions">
                <button
                  type="button"
                  className="tm-modal__btn tm-modal__btn--secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="tm-modal__btn tm-modal__btn--primary"
                  disabled={creating}
                >
                  {creating && <span className="ui-button-spinner" aria-hidden />}
                  {creating ? 'جارٍ الإضافة...' : 'إضافة المعلم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteDraft && (
        <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-teacher-title">
          <div
            className="tm-modal__backdrop"
            onClick={() => {
              if (!deleting) {
                setDeleteDraft(null);
              }
            }}
          />
          <div className="tm-modal__panel tm-modal__panel--danger">
            <header className="tm-modal__header">
              <h3 id="delete-teacher-title">تأكيد حذف المعلم</h3>
              <button
                type="button"
                className="tm-modal__close"
                onClick={() => setDeleteDraft(null)}
                disabled={deleting}
                aria-label="إغلاق نافذة حذف المعلم"
              >
                <MdClose aria-hidden />
              </button>
            </header>
            <div className="tm-modal__form">
              <p className="tm-modal__delete-message">
                سيتم حذف المعلم <strong>{deleteDraft.username}</strong> مع جميع البيانات المرتبطة
                به. لا يمكن التراجع عن هذه العملية.
              </p>

              <div className="tm-modal__actions">
                <button
                  type="button"
                  className="tm-modal__btn tm-modal__btn--secondary"
                  onClick={() => setDeleteDraft(null)}
                  disabled={deleting}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="tm-modal__btn tm-modal__btn--danger"
                  onClick={() => void handleDeleteTeacher()}
                  disabled={deleting}
                >
                  {deleting && <span className="ui-button-spinner" aria-hidden />}
                  {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetDraft && (
        <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
          <div className="tm-modal__backdrop" onClick={() => setResetDraft(null)} />
          <div className="tm-modal__panel">
            <header className="tm-modal__header">
              <h3 id="reset-password-title">إعادة تعيين كلمة المرور</h3>
              <button
                type="button"
                className="tm-modal__close"
                onClick={() => setResetDraft(null)}
                disabled={resetSubmitting}
                aria-label="إغلاق نافذة إعادة تعيين كلمة المرور"
              >
                <MdClose aria-hidden />
              </button>
            </header>
            <div className="tm-modal__form">
              <p className="tm-modal__delete-message">
                تعيين كلمة مرور جديدة للمعلم <strong>{resetDraft.username}</strong>. سيتمكن المعلم من تسجيل الدخول بهذه الكلمة.
              </p>
              <label className="tm-modal__field" htmlFor="reset-new-password">
                كلمة المرور الجديدة (6 أحرف على الأقل)
                <input
                  id="reset-new-password"
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  disabled={resetSubmitting}
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              <label className="tm-modal__field" htmlFor="reset-confirm-password">
                تأكيد كلمة المرور
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  disabled={resetSubmitting}
                  autoComplete="new-password"
                />
              </label>
              <div className="tm-modal__actions">
                <button
                  type="button"
                  className="tm-modal__btn tm-modal__btn--secondary"
                  onClick={() => setResetDraft(null)}
                  disabled={resetSubmitting}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="tm-modal__btn tm-modal__btn--primary"
                  onClick={() => void handleResetPasswordSubmit()}
                  disabled={resetSubmitting || resetNewPassword.length < 6 || resetNewPassword !== resetConfirmPassword}
                >
                  {resetSubmitting && <span className="ui-button-spinner" aria-hidden />}
                  {resetSubmitting ? 'جارٍ الحفظ...' : 'تعيين كلمة المرور'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
