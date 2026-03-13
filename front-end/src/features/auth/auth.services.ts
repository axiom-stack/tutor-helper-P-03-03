import axios from 'axios';
import type { AuthUser } from '../../types';
import { clearGoogTransCookie } from '../../utils/displayLanguage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  setStoredUser(user);
}

function clearClientAuthArtifacts() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.clear();
    } catch { /* ignore */ }
  }

  if (typeof document !== 'undefined') {
    try {
      clearGoogTransCookie();
    } catch { /* ignore */ }
  }
}

/** Use for API calls that require the JWT (sends Bearer token from storage). */
export function authAxios() {
  const token = getStoredToken();
  const instance = axios.create({
    baseURL: BACKEND_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        clearClientAuthArtifacts();

        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname || '';
          if (!currentPath.startsWith('/authentication')) {
            window.location.href = '/authentication';
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

export async function login(username: string, password: string) {
  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
    username,
    password,
  });
  console.log(response.data, 'FROM LOGIN SERVICE');
  const { token, user } = response.data;
  setAuth(token, user);
  return response.data;
}

export async function logout() {
  const api = authAxios();
  try {
    await api.post('/api/auth/logout');
  } finally {
    clearClientAuthArtifacts();
  }
}
