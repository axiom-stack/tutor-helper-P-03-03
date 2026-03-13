import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdSave } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import type { UserProfileUpdatePayload, PreparationType } from '../../types';
import { PREPARATION_TYPE_OPTIONS } from '../../types';
import { normalizeApiError } from '../../utils/apiErrors';
import { getMyProfile, updateMyProfile } from '../users/users.services';
import { applyDisplayLanguageAndReload } from '../../utils/displayLanguage';
import { getAllowedStages, type StageId } from '../../constants/education';
import './settings.css';

type LanguageValue = 'ar' | 'en';
type DefaultPlanTypeValue = 'traditional' | 'active_learning';
type PreparationTypeValue = PreparationType;

function parseStages(value: string): StageId[] {
  if (!value) return [];
  const raw = value
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const allowed = new Set<StageId>(getAllowedStages());
  const result: StageId[] = [];

  for (const part of raw) {
    if (allowed.has(part as StageId) && !result.includes(part as StageId)) {
      result.push(part as StageId);
    }
  }

  return result;
}

function formatStagesForStorage(stages: StageId[]): string {
  if (!stages.length) return '';
  return stages.join('، ');
}

export default function Settings() {
  const { user, updateUserProfile } = useAuth();

  const [language, setLanguage] = useState<LanguageValue>('ar');
  const [educationalStage, setEducationalStage] = useState('');
  const [subject, setSubject] = useState('');
  const [preparationType, setPreparationType] = useState<PreparationTypeValue | ''>(
    () => {
      const pt = user?.profile?.preparation_type;
      return pt === 'daily' || pt === 'weekly' || pt === 'other' ? pt : '';
    }
  );
  const [defaultPlanType, setDefaultPlanType] =
    useState<DefaultPlanTypeValue>(
      () =>
        user?.profile?.default_plan_type === 'active_learning'
          ? 'active_learning'
          : 'traditional'
    );
  const [defaultLessonDuration, setDefaultLessonDuration] = useState<number>(
    () => user?.profile?.default_lesson_duration_minutes ?? 45
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const stageOptions = getAllowedStages();

  useEffect(() => {
    const win = window as Window & { googleTranslateElementInit?: () => void };
    if (typeof win.googleTranslateElementInit === 'function') {
      win.googleTranslateElementInit();
    }
  }, []);

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
        const pt = profile.preparation_type;
        setPreparationType(pt === 'daily' || pt === 'weekly' || pt === 'other' ? pt : '');
        setDefaultPlanType(
          profile.default_plan_type === 'active_learning'
            ? 'active_learning'
            : 'traditional'
        );
        setDefaultLessonDuration(profile.default_lesson_duration_minutes ?? 45);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          const message =
            normalizeApiError(loadError, 'تعذر تحميل الإعدادات الشخصية.').message;
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
      language,
      educational_stage: educationalStage.trim() || null,
      subject: subject.trim() || null,
      preparation_type: preparationType || null,
      default_plan_type: defaultPlanType,
      default_lesson_duration_minutes: defaultLessonDuration,
    };

    try {
      const response = await updateMyProfile(payload);
      updateUserProfile(response.profile);
      setSuccess('تم حفظ الإعدادات بنجاح.');
      toast.success('تم حفظ الإعدادات بنجاح.');
      
      // Ensure the language is applied and page reloaded to sync with Google Translate
      setTimeout(() => {
        applyDisplayLanguageAndReload(language);
      }, 500);
      return;
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
        <h1>الإعدادات العامة</h1>
        <p>
          {user.userRole === 'admin'
            ? 'تحديث إعدادات حسابك الإداري، وإدارة إعدادات المعلمين من صفحة إدارة المعلمين.'
            : 'تحديث تفضيلاتك التعليمية الافتراضية المستخدمة ضمن لوحة التحكم.'}
        </p>
      </header>

      <section className="st__panel">
        <div className="st__form-grid">
          <label className="st__field" htmlFor="settings-language">
            <span>لغة العرض</span>
            <select
              id="settings-language"
              className="notranslate"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageValue)}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="st__field" htmlFor="settings-stage">
            <span>المرحلة التعليمية الافتراضية</span>
            <div className="st__stage-toggle" aria-label="المراحل التعليمية التي تعمل عليها">
              {stageOptions.map((stage) => {
                const currentStages = parseStages(educationalStage);
                const isActive = currentStages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    className={
                      isActive
                        ? 'st__stage-pill st__stage-pill--active'
                        : 'st__stage-pill'
                    }
                    onClick={() => {
                      const existing = parseStages(educationalStage);
                      let next: StageId[];
                      if (existing.includes(stage)) {
                        next = existing.filter((s) => s !== stage);
                      } else {
                        next = [...existing, stage];
                      }
                      setEducationalStage(formatStagesForStorage(next));
                    }}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
            <small className="st__field-hint">
              يمكنك اختيار أكثر من مرحلة، وسيتم اعتبار الأولى كإعداد افتراضي في الواجهة.
            </small>
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
            <select
              id="settings-preparation-type"
              value={preparationType}
              onChange={(event) => setPreparationType(event.target.value as PreparationTypeValue)}
            >
              <option value="">-- اختر نوع التحضير --</option>
              {PREPARATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="st__field" htmlFor="settings-default-plan-type">
            <span>نوع الخطة الافتراضي</span>
            <select
              id="settings-default-plan-type"
              value={defaultPlanType}
              onChange={(event) =>
                setDefaultPlanType(event.target.value as DefaultPlanTypeValue)
              }
            >
              <option value="traditional">تقليدية</option>
              <option value="active_learning">تعلم نشط</option>
            </select>
          </label>

          <label className="st__field" htmlFor="settings-duration">
            <span>المدة الافتراضية للحصة (دقيقة)</span>
            <select
              id="settings-duration"
              value={defaultLessonDuration}
              onChange={(event) =>
                setDefaultLessonDuration(Number(event.target.value) || 45)
              }
            >
              {[30, 35, 40, 45, 50, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} دقيقة
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="st__actions">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving}
          >
            {saving && <span className="ui-button-spinner" aria-hidden />}
            {!saving && <MdSave aria-hidden />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
        <div id="google_translate_element" className="st__translate-widget" aria-hidden="true" />
      </section>
    </div>
  );
}
