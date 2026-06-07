import { create } from 'zustand';
import type { PublicUser } from '../types/user';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: PublicUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (patch: Partial<PublicUser>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (patch) =>
    set((state) => ({ user: state.user ? { ...state.user, ...patch } : null })),
  clear: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}));
