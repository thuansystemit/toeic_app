import { api } from './client';
import type { UserRole } from '../types/user';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'deactivated';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: 'active' | 'deactivated';
}

export async function listUsers(
  params: ListUsersParams,
): Promise<Paginated<AdminUser>> {
  const res = await api.get<Paginated<AdminUser>>('/admin/users', { params });
  return res.data;
}

export async function changeUserRole(
  userId: string,
  role: UserRole,
): Promise<AdminUser> {
  const res = await api.patch<AdminUser>(`/admin/users/${userId}/role`, { role });
  return res.data;
}

export async function deactivateUser(userId: string): Promise<AdminUser> {
  const res = await api.post<AdminUser>(`/admin/users/${userId}/deactivate`);
  return res.data;
}

export async function reactivateUser(userId: string): Promise<AdminUser> {
  const res = await api.post<AdminUser>(`/admin/users/${userId}/reactivate`);
  return res.data;
}

/** Permanently delete a user and all their content (irreversible). */
export async function hardDeleteUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}
