import axios from 'axios';

export function getIsOnline() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function isOfflineError(error: unknown): boolean {
  if (!getIsOnline()) {
    return true;
  }

  if (axios.isAxiosError(error)) {
    return !error.response;
  }

  return false;
}

