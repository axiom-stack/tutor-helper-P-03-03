import axios from 'axios';
import type { AuthUser } from '../../types';

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

function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

/** Use for API calls that require the JWT (sends Bearer token from storage). */
export function authAxios() {
  const token = getStoredToken();
  return axios.create({
    baseURL: BACKEND_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function login(username: string, password: string) {
  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
    username,
    password,
  });
  const { token, user } = response.data;
  setAuth(token, user);
  return response.data;
}

export async function logout() {
  const api = authAxios();
  await api.post('/api/auth/logout');
  clearAuth();
}
