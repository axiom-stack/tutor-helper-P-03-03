import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function login(username: string, password: string) {
  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
    username,
    password,
  });
  return response.data;
}

export async function logout() {
  const response = await axios.post(`${BACKEND_URL}/api/auth/logout`);
  return response.data;
}
