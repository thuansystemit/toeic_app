import { api } from './client';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  preferredLocale: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export async function getProfile(): Promise<Profile> {
  const res = await api.get<Profile>('/profile');
  return res.data;
}

export async function updateProfile(patch: {
  displayName?: string;
  preferredLocale?: string;
}): Promise<Profile> {
  const res = await api.patch<Profile>('/profile', patch);
  return res.data;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.post('/profile/password', payload);
}
