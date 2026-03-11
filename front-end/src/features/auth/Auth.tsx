import React, { useState } from 'react';
import { MdMenuBook, MdErrorOutline } from 'react-icons/md';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import './auth.css';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router';

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

  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      user?.userRole === 'admin' ? navigate('/admin') : navigate('/teacher');
    }
  }, [isAuthenticated, navigate]);

  const clearError = () => setError(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

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
      await login(username, password);
      navigate('/');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء تسجيل الدخول';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth">
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
                  className="auth-error"
                  role="alert"
                  data-purpose="error-message"
                  aria-live="polite"
                >
                  <MdErrorOutline className="auth-error__icon" />
                  <p id="auth-error-desc" className="auth-error__text">
                    {error}
                  </p>
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
                    clearError();
                  }}
                  autoComplete="username"
                  disabled={isSubmitting}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'auth-error-desc' : undefined}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="auth-password">
                  كلمة المرور
                </label>
                <div className="auth-field__password-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-field__input auth-field__input--password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    autoComplete="off"
                    disabled={isSubmitting}
                    aria-invalid={!!error}
                  />
                  <button
                    type="button"
                    className="auth-field__toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    title={
                      showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
                    }
                    aria-label={
                      showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
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
