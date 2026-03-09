import { useEffect, useState } from 'react';
import { MdCheckCircle, MdErrorOutline, MdSave } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { UserProfileUpdatePayload } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { getMyProfile, updateMyProfile } from '../users/users.services';
import './settings.css';

type LanguageValue = 'ar' | 'en';

export default function Settings() {
  const { user } = useAuth();

  const [language, setLanguage] = useState<LanguageValue>('ar');
  const [educationalStage, setEducationalStage] = useState('');
  const [subject, setSubject] = useState('');
  const [preparationType, setPreparationType] = useState('');
  const [defaultLessonDuration, setDefaultLessonDuration] = useState<number>(45);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getMyProfile()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const profile = response.profile;
        setLanguage(profile.language);
        setEducationalStage(profile.educational_stage ?? '');
        setSubject(profile.subject ?? '');
        setPreparationType(profile.preparation_type ?? '');
        setDefaultLessonDuration(profile.default_lesson_duration_minutes ?? 45);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            normalizeApiError(loadError, 'تعذر تحميل الإعدادات الشخصية.').message
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: UserProfileUpdatePayload = {
      language,
      educational_stage: educationalStage.trim() || null,
      subject: subject.trim() || null,
      preparation_type: preparationType.trim() || null,
      default_lesson_duration_minutes: defaultLessonDuration,
    };

    try {
      await updateMyProfile(payload);
      setSuccess('تم حفظ الإعدادات بنجاح.');
    } catch (saveError: unknown) {
      setError(normalizeApiError(saveError, 'فشل حفظ الإعدادات.').message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="st" dir="rtl">
      <header className="st__header">
        <h1>الإعدادات العامة</h1>
        <p>
          {user.userRole === 'admin'
            ? 'تحديث إعدادات حسابك الإداري، وإدارة إعدادات المعلمين من صفحة إدارة المعلمين.'
            : 'تحديث تفضيلاتك التعليمية الافتراضية المستخدمة ضمن لوحة التحكم.'}
        </p>
      </header>

      <section className="st__panel">
        {loading ? <p className="st__state">جاري تحميل الإعدادات...</p> : null}

        {!loading ? (
          <div className="st__form-grid">
            <label className="st__field" htmlFor="settings-language">
              <span>لغة النظام</span>
              <select
                id="settings-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as LanguageValue)}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="st__field" htmlFor="settings-stage">
              <span>المرحلة التعليمية الافتراضية</span>
              <input
                id="settings-stage"
                value={educationalStage}
                onChange={(event) => setEducationalStage(event.target.value)}
                placeholder="مثال: المرحلة الإعدادية"
              />
            </label>

            <label className="st__field" htmlFor="settings-subject">
              <span>المادة الافتراضية</span>
              <input
                id="settings-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="مثال: الرياضيات"
              />
            </label>

            <label className="st__field" htmlFor="settings-preparation-type">
              <span>نوع التحضير</span>
              <input
                id="settings-preparation-type"
                value={preparationType}
                onChange={(event) => setPreparationType(event.target.value)}
                placeholder="مثال: تحضير يومي"
              />
            </label>

            <label className="st__field" htmlFor="settings-duration">
              <span>المدة الافتراضية للحصة (دقيقة)</span>
              <input
                id="settings-duration"
                type="number"
                min={1}
                step={1}
                value={defaultLessonDuration}
                onChange={(event) =>
                  setDefaultLessonDuration(Number(event.target.value) || 45)
                }
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <div className="st__message st__message--error">
            <MdErrorOutline aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="st__message st__message--success">
            <MdCheckCircle aria-hidden />
            <span>{success}</span>
          </div>
        ) : null}

        <div className="st__actions">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving}
          >
            <MdSave aria-hidden />
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </section>
    </div>
  );
}
