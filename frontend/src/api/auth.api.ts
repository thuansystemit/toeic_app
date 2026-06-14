import { api } from './client';
import type { AuthResponse } from '../types/user';

export async function register(payload: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', payload);
  return res.data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', payload);
  return res.data;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/google', { idToken });
  return res.data;
}

export async function loginWithFacebook(accessToken: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/facebook', { accessToken });
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

/** Silent session restore: exchanges the HttpOnly refresh cookie for a fresh
 *  access token + user. Used on app boot so a reload keeps you signed in. */
export async function refreshSession(): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/refresh', {});
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
