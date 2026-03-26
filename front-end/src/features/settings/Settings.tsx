import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdDownload, MdImage, MdSave } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { UserProfileUpdatePayload } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { getMyProfile, updateMyProfile } from '../users/users.services';
import { applyDisplayLanguageAndReload } from '../../utils/displayLanguage';
import {
  LANGUAGE_OPTIONS,
  PLAN_TYPE_OPTIONS,
} from '../../constants/dropdown-options';
import './settings.css';

type LanguageValue = 'ar' | 'en';
type PlanTypeValue = 'traditional' | 'active_learning';

export default function Settings() {
  const { user, updateUserProfile } = useAuth();

  const [language, setLanguage] = useState<LanguageValue>('ar');
  const [defaultPlanType, setDefaultPlanType] =
    useState<PlanTypeValue>('traditional');
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [logoFileName, setLogoFileName] = useState('');

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
        setLanguage(profile.language === 'en' ? 'en' : 'ar');
        setDefaultPlanType(
          profile.default_plan_type === 'active_learning'
            ? 'active_learning'
            : 'traditional'
        );
        setSchoolName(profile.school_name ?? '');
        setSchoolLogoUrl(profile.school_logo_url ?? '');
        setLogoFileName(profile.school_logo_url ? 'شعار المدرسة الحالي' : '');
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

  const handleLogoFileChange = (file: File | null) => {
    if (!file) {
      setSchoolLogoUrl('');
      setLogoFileName('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      const message = 'شعار المدرسة يجب أن يكون صورة.';
      setError(message);
      toast.error(message);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      setSchoolLogoUrl(value);
      setLogoFileName(file.name);
    };
    reader.onerror = () => {
      const message = 'تعذر قراءة ملف الشعار.';
      setError(message);
      toast.error(message);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadTemplate = () => {
    const template = [
      'قالب عرض الخطة المولدة',
      '',
      '1. اكتب عنوان الخطة في الأعلى.',
      '2. اترك مساحة واضحة للمحتوى المولد.',
      '3. أضف ملاحظات المعلم ونطاق التعديل أسفل الخطة.',
      '4. احفظ الملف بصيغة PDF أو DOCX عند الحاجة.',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lesson-plan-template.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: UserProfileUpdatePayload = {
      language,
      default_plan_type: defaultPlanType,
      school_name: schoolName.trim() || null,
      school_logo_url: schoolLogoUrl.trim() || null,
    };

    try {
      const response = await updateMyProfile(payload);
      updateUserProfile(response.profile);
      setSuccess('تم حفظ الإعدادات بنجاح.');
      toast.success('تم حفظ الإعدادات بنجاح.');
      setTimeout(() => {
        applyDisplayLanguageAndReload(language);
      }, 250);
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
          <p>
            اللغة الافتراضية، نوع التحضير، وبيانات المدرسة التي تظهر في قالب
            الاختبار.
          </p>
        </div>

        <div className="st__role-chip">
          {user.userRole === 'admin' ? 'حساب مدير' : 'حساب معلم'}
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
          <label className="st__field" htmlFor="settings-language">
            <span>اللغة *</span>
            <select
              id="settings-language"
              className="notranslate"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageValue)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="st__field" htmlFor="settings-plan-type">
            <span>نوع التحضير *</span>
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

          <label className="st__field st__field--full" htmlFor="settings-school-name">
            <span>المدرسة *</span>
            <input
              id="settings-school-name"
              type="text"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="اسم المدرسة"
            />
          </label>

          <div className="st__field st__field--full">
            <span>شعار المدرسة</span>
            <label className="st__upload">
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleLogoFileChange(event.target.files?.[0] ?? null)
                }
              />
              <div className="st__upload-copy">
                <MdImage aria-hidden />
                <div>
                  <strong>رفع صورة الشعار</strong>
                  <p>{logoFileName || 'لم يتم اختيار شعار بعد'}</p>
                </div>
              </div>
            </label>

            <div className="st__logo-preview" aria-live="polite">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt="شعار المدرسة" />
              ) : (
                <span>لا يوجد شعار مرفوع حالياً</span>
              )}
            </div>
          </div>
        </div>

        <div className="st__template-row">
          <div>
            <h2>قالب عرض الخطة المولدة</h2>
            <p>حمّل قالباً بسيطاً لتنسيق الخطة كما يظهر في صفحة العرض.</p>
          </div>
          <button
            type="button"
            className="st__template-link"
            onClick={handleDownloadTemplate}
          >
            <MdDownload aria-hidden />
            تحميل القوالب من هنا
          </button>
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
