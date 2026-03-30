import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdMenuBook, MdRefresh } from 'react-icons/md';
import './auth.css';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router';
import { normalizeApiError } from '../../utils/apiErrors';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const HEALTH_URL = `${BACKEND_URL.replace(/\/$/, '')}/health`;
const HEALTH_TIMEOUT_MS = 5000;
const WAKE_UP_WAIT_MS = 40000;

export type LoginCredentials = {
  username: string;
  password: string;
};

function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverWakingUp, setServerWakingUp] = useState(false);
  const [refreshReady, setRefreshReady] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const wakeNotice = serverWakingUp ? (
    <div className="auth__wake-notice" role="status">
      <p className="auth__wake-notice-text">
        الخادم المجاني قيد التشغيل. يرجى تحديث الصفحة بعد 40 ثانية ثم البدء
        باستخدام التطبيق.
      </p>
      <p className="auth__wake-notice-en">
        The free server is waking up. Please refresh the page after 40 seconds,
        then you can start using the app.
      </p>
      {refreshReady && (
        <button
          type="button"
          className="auth__wake-refresh-btn"
          onClick={() => window.location.reload()}
        >
          <MdRefresh aria-hidden />
          تحديث الصفحة الآن / Refresh now
        </button>
      )}
    </div>
  ) : null;

  // Ping backend health on mount; if > 5s, show "server waking up" and allow refresh after 40s
  useEffect(() => {
    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => {
      ac.abort();
    }, HEALTH_TIMEOUT_MS);

    fetch(HEALTH_URL, { signal: ac.signal })
      .then(() => {
        clearTimeout(timeoutId);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setServerWakingUp(true);
      });

    return () => {
      clearTimeout(timeoutId);
      ac.abort();
    };
  }, []);

  // When showing "waking up", start 40s countdown for refresh
  useEffect(() => {
    if (!serverWakingUp) return;
    const id = window.setTimeout(() => setRefreshReady(true), WAKE_UP_WAIT_MS);
    return () => clearTimeout(id);
  }, [serverWakingUp]);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    if (user?.userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate, user?.userRole]);

  React.useEffect(() => {
    if (error) {
      // Still show toast for accessibility, but main display is on form
      toast.error(error);
    }
  }, [error]);

  const clearError = () => setError(null);

  if (isLoading) {
    return (
      <div
        className={`auth${serverWakingUp ? ' auth--wake-notice-visible' : ''}`}
      >
        {wakeNotice}
        <div className="ui-loading-screen">
          <div className="ui-loading-shell">
            <span className="ui-spinner" aria-hidden />
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Clear previous error
    setError(null);

    // Client-side validation - check if fields are empty first
    if (!username.trim()) {
      setError('يرجى إدخال اسم المستخدم');
      return;
    }

    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    // Client-side validation - we ensure that the password and username are of proper length
    if (username.length < 4) {
      setError('اسم المستخدم يجب أن يكون 4 أحرف على الأقل');
      return;
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login(username, password);
      navigate(response.user.userRole === 'admin' ? '/admin' : '/');
    } catch (error: unknown) {
      // Handle raw axios errors with better user feedback
      let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';

      if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;

        // Check for axios error with status code
        if (
          err.code === 'ERR_BAD_REQUEST' ||
          (err as any).response?.status === 401
        ) {
          errorMessage =
            'اسم المستخدم أو كلمة المرور غير صحيح. يرجى التحقق والمحاولة مرة أخرى.';
        } else if ((err as any).response?.status === 400) {
          const responseData = (err as any).response?.data;
          if (responseData?.error) {
            errorMessage = responseData.error;
          }
        } else {
          const normalizedError = normalizeApiError(error);
          if (normalizedError.message.includes('بيانات الدخول')) {
            errorMessage =
              'اسم المستخدم أو كلمة المرور غير صحيح. يرجى التحقق والمحاولة مرة أخرى.';
          } else {
            errorMessage = normalizedError.message;
          }
        }
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`auth${serverWakingUp ? ' auth--wake-notice-visible' : ''}`}
    >
      {wakeNotice}
      <div className="auth__container">
        <section className="auth__brand" aria-hidden>
          <div className="auth__brand-inner">
            <div className="auth__brand-header">
              <div className="auth__logo auth__logo--light">
                <MdMenuBook className="auth__logo-svg" />
              </div>
              <h1 className="auth__brand-title">مساعد المعلم الذكي</h1>
            </div>
            <div className="auth__brand-content">
              <h2 className="auth__brand-tagline">
                شريكك الذكي في رحلة التعليم
              </h2>
              <p className="auth__brand-desc">
                نحن هنا لتمكين المعلمين بالأدوات والبيانات اللازمة لتحقيق أفضل
                النتائج الأكاديمية.
              </p>
            </div>
          </div>
          <div className="auth__brand-shape" aria-hidden />
          <p className="auth__brand-footer">
            © 2026 مساعد المعلم الذكي. جميع الحقوق محفوظة.
          </p>
        </section>

        <main className="auth__form-wrap">
          <div className="auth__form-inner">
            <div className="auth__mobile-logo">
              <div className="auth__logo auth__logo--brand">
                <MdMenuBook className="auth__logo-svg auth__logo-svg--white" />
              </div>
              <span className="auth__mobile-title">مساعد المعلم الذكي</span>
            </div>

            <div className="auth__form-header">
              <h2 className="auth__form-title">تسجيل الدخول</h2>
              <p className="auth__form-subtitle">
                مرحباً بك مجدداً، يرجى إدخال بياناتك
              </p>
            </div>

            <form
              className="auth__form"
              onSubmit={handleSubmit}
              noValidate
              data-purpose="login-form"
              aria-label="تسجيل الدخول"
            >
              {error && (
                <div
                  id="auth-error-message"
                  className="auth__error-message"
                  role="alert"
                  aria-live="polite"
                >
                  <span className="auth__error-text">{error}</span>
                  <button
                    type="button"
                    className="auth__error-close"
                    onClick={clearError}
                    aria-label="إغلاق رسالة الخطأ"
                    title="إغلاق"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="auth-username">
                  اسم المستخدم
                </label>
                <input
                  id="auth-username"
                  type="text"
                  className="auth-field__input"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    // Clear error that might relate to this field
                    if (error?.includes('اسم المستخدم')) {
                      setError(null);
                    }
                  }}
                  autoComplete="username"
                  disabled={isSubmitting}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'auth-error-message' : undefined}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="auth-password">
                  كلمة المرور
                </label>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-field__input auth-field__input--password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // Clear error that might relate to this field
                    if (error?.includes('كلمة المرور')) {
                      setError(null);
                    }
                  }}
                  autoComplete="off"
                  disabled={isSubmitting}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'auth-error-message' : undefined}
                />
                <label className="auth-field__show-password">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                    disabled={isSubmitting}
                    aria-checked={showPassword}
                    aria-label="إظهار كلمة المرور"
                  />
                  <span>إظهار كلمة المرور</span>
                </label>
              </div>

              <button
                type="submit"
                className="auth__submit"
                disabled={isSubmitting}
                data-purpose="submit-button"
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="auth__submit-text">
                    <span className="auth__spinner" aria-hidden />
                    جاري تسجيل الدخول...
                  </span>
                ) : (
                  'تسجيل الدخول'
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Auth;
