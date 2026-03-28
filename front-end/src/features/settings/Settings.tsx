import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdSave } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { UserProfileUpdatePayload } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { getMyProfile, updateMyProfile } from '../users/users.services';
import { PLAN_TYPE_OPTIONS } from '../../constants/dropdown-options';
import './settings.css';

type PlanTypeValue = 'traditional' | 'active_learning';

const TEMPLATE_URL =
  'https://drive.google.com/file/d/1dCrgCvRlp3DdhUL7a8Ws5jD7DAJN7vVw/view';

export default function Settings() {
  const { user, updateUserProfile } = useAuth();

  const [defaultPlanType, setDefaultPlanType] =
    useState<PlanTypeValue>('traditional');
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
        setDefaultPlanType(
          profile.default_plan_type === 'active_learning'
            ? 'active_learning'
            : 'traditional'
        );
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          const message = normalizeApiError(loadError, 'تعذر تحميل الإعدادات.').message;
          setError(message);
          toast.error(message);
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
      default_plan_type: defaultPlanType,
    };

    try {
      const response = await updateMyProfile(payload);
      updateUserProfile(response.profile);
      setSuccess('تم حفظ الإعدادات بنجاح.');
      toast.success('تم حفظ الإعدادات بنجاح.');
    } catch (saveError: unknown) {
      const message = normalizeApiError(saveError, 'فشل حفظ الإعدادات.').message;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="ui-loading-screen">
        <div className="ui-loading-shell">
          <span className="ui-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="st ui-loaded">
      <header className="st__header page-header">
        <div>
          <h1>الإعدادات</h1>
          <p>اضبط نوع الخطة الافتراضي وافتح قالب العرض من الرابط المخصص هنا.</p>
        </div>

        <div className="st__role-chip">
          {user.userRole === 'admin' ? 'مدير' : 'معلم'}
        </div>
      </header>

      {error ? (
        <p className="ui-inline-notice ui-inline-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="ui-inline-notice ui-inline-notice--success" role="status">
          {success}
        </p>
      ) : null}

      <section className="st__panel">
        <div className="st__grid">
          <label className="st__field" htmlFor="settings-plan-type">
            <span>نوع الخطة الافتراضي *</span>
            <select
              id="settings-plan-type"
              value={defaultPlanType}
              onChange={(event) =>
                setDefaultPlanType(event.target.value as PlanTypeValue)
              }
            >
              {PLAN_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="st__template-row">
          <div>
            <h2>قالب عرض الخطة المولدة</h2>
            <p>افتح القالب المعتمد مباشرة من رابط Google Drive.</p>
          </div>
          <a
            href={TEMPLATE_URL}
            target="_blank"
            rel="noreferrer"
            className="st__template-link"
          >
            فتح القالب
          </a>
        </div>

        <div className="st__actions">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving && <span className="ui-button-spinner" aria-hidden />}
            {!saving && <MdSave aria-hidden />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </section>
    </div>
  );
}
