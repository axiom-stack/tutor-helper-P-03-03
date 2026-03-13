/**
 * Display language is synced with user profile.language (system language).
 * Persisted in cookie for Google Translate; refreshed on auth change and Settings save.
 */

const GOOGTRANS_COOKIE = 'googtrans';
const GOOGTRANS_EN = '/ar/en';

export type DisplayLanguage = 'ar' | 'en';

export function getDisplayLanguageFromCookie(): DisplayLanguage {
  if (typeof document === 'undefined') return 'ar';
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${GOOGTRANS_COOKIE}=([^;]*)`)
  );
  const value = match ? match[1].trim() : '';
  return value === GOOGTRANS_EN ? 'en' : 'ar';
}

/**
 * Set (or clear) the googtrans cookie in every scope Google Translate may
 * check: with path, without path, and on the deployment domain.
 */
function setGoogTransCookie(value: string): void {
  if (value) {
    document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/`;
    document.cookie = `${GOOGTRANS_COOKIE}=${value}`;
    try {
      const h = window.location.hostname;
      if (h && h !== 'localhost' && h !== '127.0.0.1') {
        document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/; domain=.${h}`;
      }
    } catch { /* ignore */ }
  } else {
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0`;
    document.cookie = `${GOOGTRANS_COOKIE}=; max-age=0`;
    try {
      const h = window.location.hostname;
      if (h && h !== 'localhost' && h !== '127.0.0.1') {
        document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0; domain=.${h}`;
      }
    } catch { /* ignore */ }
  }
}

/** Sync cookie to match profile language. Returns true if a reload is needed so the page matches. */
export function syncDisplayLanguageCookie(profileLanguage: DisplayLanguage): boolean {
  const current = getDisplayLanguageFromCookie();
  const desiredEn = profileLanguage === 'en';

  if (desiredEn) {
    setGoogTransCookie(GOOGTRANS_EN);
    return current !== 'en';
  } else {
    setGoogTransCookie('');
    return current === 'en';
  }
}

/** Set display language (cookie) and reload so the app shows in that language. */
export function applyDisplayLanguageAndReload(lang: DisplayLanguage): void {
  setGoogTransCookie(lang === 'en' ? GOOGTRANS_EN : '');
  window.location.reload();
}

/**
 * After a page reload the googtrans cookie should make Google Translate
 * auto-translate, but this is unreliable across environments (Vercel, etc).
 * As a safety net, poll for the GT combo-box and programmatically trigger it.
 */
export function ensureGoogleTranslation(targetLang: DisplayLanguage): void {
  if (targetLang === 'ar') return;

  let attempts = 0;
  const maxAttempts = 30;

  const tryTrigger = () => {
    attempts++;
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select) {
      if (select.value !== targetLang) {
        select.value = targetLang;
        select.dispatchEvent(new Event('change'));
      }
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryTrigger, 500);
    }
  };

  setTimeout(tryTrigger, 1000);
}

/** Clear all googtrans cookies (used on logout). */
export function clearGoogTransCookie(): void {
  setGoogTransCookie('');
}
