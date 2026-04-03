import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { MdDeleteOutline, MdImage, MdSave } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { PreparationType, UserProfileUpdatePayload } from '../../types';
import { PREPARATION_TYPE_OPTIONS } from '../../types';
import { LANGUAGE_OPTIONS } from '../../constants/dropdown-options';
import { normalizeApiError } from '../../utils/apiErrors';
import { normalizeImageUploadError } from '../../utils/imageUploadErrors';
import { syncDisplayLanguageCookie } from '../../utils/displayLanguage';
import { getMyProfile, updateMyProfile } from '../users/users.services';
import './settings.css';

export default function Settings() {
  const { user, updateUserProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoPreviewRef = useRef<HTMLImageElement | null>(null);

  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [preparationType, setPreparationType] = useState<PreparationType | ''>(
    ''
  );
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showLogoError = (errorValue: unknown, fallback: string) => {
    const message = normalizeImageUploadError(errorValue, fallback);
    setLogoError(message);
    toast.error(message);
  };

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
        setPreparationType(
          profile.preparation_type === 'daily' ||
            profile.preparation_type === 'weekly' ||
            profile.preparation_type === 'other'
            ? profile.preparation_type
            : ''
        );
        setSchoolName(profile.school_name?.trim() ?? '');
        setSchoolLogoUrl(profile.school_logo_url ?? null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          const message = normalizeApiError(
            loadError,
            'تعذر تحميل الإعدادات.'
          ).message;
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

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showLogoError(
        { code: 'INVALID_IMAGE_TYPE' },
        'يرجى اختيار ملف صورة صالح.'
      );
      return;
    }

    const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showLogoError(
        { code: 'IMAGE_FILE_TOO_LARGE' },
        'حجم الصورة كبير جدًا. الرجاء اختيار صورة أقل من 2 ميغابايت.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        showLogoError(
          reader.error ?? { code: 'IMAGE_READ_FAILED' },
          'تعذر قراءة صورة الشعار.'
        );
        return;
      }

      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const minWidth = 512;
        const minHeight = 256;
        const maxWidth = 2048;
        const maxHeight = 1024;

        if (
          width < minWidth ||
          height < minHeight ||
          width > maxWidth ||
          height > maxHeight
        ) {
          const message =
            `أبعاد الصورة غير مناسبة. الموصى به: ${minWidth}×${minHeight} إلى ${maxWidth}×${maxHeight} بكسل. ` +
            `الصورة الحالية: ${width}×${height} بكسل.`;
          setLogoError(message);
          toast.error(message);
          return;
        }

        setSchoolLogoUrl(result);
        setLogoError(null);
        toast.success(
          `تم قبول الصورة: ${width}×${height} بكسل. الأبعاد الموصى بها مناسبة.`
        );
      };
      image.onerror = () => {
        showLogoError(
          { code: 'IMAGE_CORRUPT' },
          'الصورة تالفة أو غير قابلة للقراءة.'
        );
      };
      image.src = result;
    };
    reader.onerror = () => {
      showLogoError(
        reader.error ?? { code: 'IMAGE_READ_FAILED' },
        'تعذر قراءة صورة الشعار.'
      );
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setSchoolLogoUrl(null);
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: UserProfileUpdatePayload = {
      language,
      preparation_type: preparationType || null,
      school_name: schoolName.trim() || null,
      school_logo_url: schoolLogoUrl,
    };

    try {
      const response = await updateMyProfile(payload);
      updateUserProfile(response.profile);

      const needsReload = syncDisplayLanguageCookie(response.profile.language);
      setSuccess('تم حفظ الإعدادات بنجاح.');
      toast.success('تم حفظ الإعدادات بنجاح.');

      if (needsReload) {
        setTimeout(() => window.location.reload(), 100);
      }
    } catch (saveError: unknown) {
      const message = normalizeImageUploadError(
        saveError,
        normalizeApiError(saveError, 'فشل حفظ الإعدادات.').message
      );
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
          <p>اضبط اللغة، ونوع التحضير، واسم المدرسة، وشعارها من هنا.</p>
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

      <section className="st__panel" aria-labelledby="settings-core-title">
        <div className="st__panel-head">
          <h2 id="settings-core-title">الإعدادات الأساسية</h2>
        </div>

        <form
          className="st__form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="st__grid">
            <label className="st__field" htmlFor="settings-language">
              <span>اللغة *</span>
              <div className="st__select-shell">
                <select
                  id="settings-language"
                  name="language"
                  className="st__select"
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as 'ar' | 'en')
                  }
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="st__select-chevron" aria-hidden="true" />
              </div>
            </label>

            <label className="st__field" htmlFor="settings-preparation-type">
              <span>نوع التحضير *</span>
              <div className="st__select-shell">
                <select
                  id="settings-preparation-type"
                  name="preparation_type"
                  className="st__select st__select--placeholder"
                  value={preparationType}
                  onChange={(event) =>
                    setPreparationType(
                      event.target.value as PreparationType | ''
                    )
                  }
                >
                  <option value="">-- اختر نوع التحضير --</option>
                  {PREPARATION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="st__select-chevron" aria-hidden="true" />
              </div>
            </label>

            <label
              className="st__field st__field--full"
              htmlFor="settings-school-name"
            >
              <span>المدرسة *</span>
              <input
                id="settings-school-name"
                name="school_name"
                type="text"
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="مثال: مدرسة النور الأساسية"
                autoComplete="organization"
              />
            </label>

            <div className="st__field st__field--full">
              <span>شعار المدرسة</span>
              <div className="st__logo-spec">
                <strong>الأبعاد الموصى بها: 1024×512 بكسل</strong>
                <span>الحد الأدنى المقبول: 512×256 بكسل</span>
              </div>

              <div className="st__logo-area">
                <label className="st__upload" htmlFor="settings-school-logo">
                  <input
                    ref={fileInputRef}
                    id="settings-school-logo"
                    name="school_logo_url"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                  />
                  <div className="st__upload-copy">
                    <span className="st__upload-icon" aria-hidden>
                      <MdImage />
                    </span>
                    <div>
                      <strong>
                        {schoolLogoUrl
                          ? 'تحديث صورة الشعار'
                          : 'رفع صورة الشعار'}
                      </strong>
                      <p>
                        PNG أو JPG أو WEBP. ستُرسل الصورة كبيانات مضمنة. أي
                        مشكلة في النوع أو الحجم أو الأبعاد ستظهر هنا بوضوح.
                      </p>
                    </div>
                  </div>
                </label>

                <div className="st__logo-preview">
                  {schoolLogoUrl ? (
                    <img
                      ref={logoPreviewRef}
                      src={schoolLogoUrl}
                      width={320}
                      height={160}
                      alt={schoolName ? `شعار ${schoolName}` : 'شعار المدرسة'}
                    />
                  ) : (
                    <span>لا توجد صورة حالياً</span>
                  )}
                </div>
              </div>

              {logoError ? (
                <p className="st__logo-error" role="alert">
                  {logoError}
                </p>
              ) : null}

              <div className="st__logo-actions">
                <button
                  type="button"
                  className="st__secondary-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MdImage aria-hidden />
                  اختيار ملف
                </button>
                <button
                  type="button"
                  className="st__secondary-btn st__secondary-btn--danger"
                  onClick={clearLogo}
                  disabled={!schoolLogoUrl}
                >
                  <MdDeleteOutline aria-hidden />
                  إزالة الشعار
                </button>
              </div>
            </div>
          </div>

          <div className="st__actions">
            <button type="submit" disabled={saving}>
              {saving && <span className="ui-button-spinner" aria-hidden />}
              {!saving && <MdSave aria-hidden />}
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
