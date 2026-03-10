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

/** Sync cookie to match profile language. Returns true if a reload is needed so the page matches. */
export function syncDisplayLanguageCookie(profileLanguage: DisplayLanguage): boolean {
  const current = getDisplayLanguageFromCookie();
  const desiredEn = profileLanguage === 'en';

  if (desiredEn) {
    document.cookie = `${GOOGTRANS_COOKIE}=${GOOGTRANS_EN}; path=/`;
    return !current; // reload if we weren't in English (so page will translate)
  } else {
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0`;
    return current; // reload if we were in English (so page shows Arabic again)
  }
}

/** Set display language (cookie) and reload so the app shows in that language. */
export function applyDisplayLanguageAndReload(lang: DisplayLanguage): void {
  if (lang === 'en') {
    document.cookie = `${GOOGTRANS_COOKIE}=${GOOGTRANS_EN}; path=/`;
  } else {
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0`;
  }
  window.location.reload();
}
